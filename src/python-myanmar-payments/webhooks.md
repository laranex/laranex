---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a Python app - verify, store, acknowledge, then process once in a background worker with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `handle_callback`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `callback.acknowledgement()`, so the gateway stops retrying.
4. **Process once** in a background worker: claim the row, skip what is already fulfilled, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'HTTP handler', 'Worker']"
  :steps="[
    { from: 'Gateway', to: 'HTTP handler', label: 'Webhook', detail: 'POST /webhooks/payments/<gateway>' },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Verify the signature', detail: 'gateway.handle_callback(request)' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: 'SignatureVerificationError', response: true },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Store the call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Acknowledge immediately', detail: 'callback.acknowledgement()', response: true },
    { from: 'Worker', to: 'Worker', label: 'Claim the next row', detail: 'locked_until, attempts + 1' },
    { from: 'Worker', to: 'Worker', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own orders table. The sample uses the standard library's `sqlite3` module and is framework-independent; with PostgreSQL or MySQL, use your driver's placeholders (`%s`) and the same queries, or express them with the Django ORM or SQLAlchemy.

## Table

```sql
CREATE TABLE payment_webhooks (
    -- BIGINT AUTO_INCREMENT on MySQL, BIGSERIAL on PostgreSQL
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gateway VARCHAR(32) NOT NULL,
    order_id VARCHAR(64) NULL,
    status VARCHAR(16) NULL,               -- PaymentStatus value
    gateway_status VARCHAR(64) NULL,
    gateway_reference VARCHAR(128) NULL,
    amount VARCHAR(32) NULL,               -- as sent, never a float
    verified SMALLINT NOT NULL,
    body TEXT NOT NULL,                    -- the raw request body
    headers TEXT NOT NULL,                 -- JSON
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    available_at INTEGER NOT NULL,         -- unix time of the next attempt
    locked_until INTEGER NULL,
    processed_at INTEGER NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX payment_webhooks_order
    ON payment_webhooks (gateway, order_id, status);
```

## Handler

`handle` takes the gateway name and the `CallbackRequest`, and returns the `Acknowledgement` to send, including the `400` for a rejected call, so every framework writes the answer the same way:

```python
import json
import sqlite3
import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Protocol

from python_myanmar_payments import (
    Acknowledgement,
    CallbackRequest,
    PaymentCallback,
    SignatureVerificationError,
)


class Verifier(Protocol):
    """What every gateway (KbzPay, WaveMoney, AyaPay, YomaMmqr,
    CyberSource) and its async twin have in common."""

    def handle_callback(self, request: CallbackRequest) -> PaymentCallback:
        ...


def now() -> int:
    return int(time.time())


class Webhooks:
    def __init__(
        self,
        database: str,
        # "kbz-pay" => kbz, "wave-money" => wave, ...
        gateways: Mapping[str, Verifier],
    ) -> None:
        self.database = database
        self.gateways = gateways

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        # One connection per call, so the handler and the worker can run
        # in different threads; autocommit for single-statement writes.
        db = sqlite3.connect(self.database, isolation_level=None)
        try:
            yield db
        finally:
            db.close()

    def handle(self, name: str, request: CallbackRequest) -> Acknowledgement:
        """Verifies, stores and acknowledges. Processing happens in work()."""
        gateway = self.gateways.get(name)
        if gateway is None:
            return Acknowledgement(status=404)

        headers = json.dumps(dict(request.headers))
        timestamp = now()

        try:
            callback = gateway.handle_callback(request)
        except SignatureVerificationError as error:
            with self.connect() as db:
                db.execute(
                    """INSERT INTO payment_webhooks
                         (gateway, verified, body, headers, last_error,
                          available_at, created_at)
                       VALUES (?, 0, ?, ?, ?, ?, ?)""",
                    (
                        name,
                        request.body,
                        headers,
                        str(error),
                        timestamp,
                        timestamp,
                    ),
                )
            return Acknowledgement(status=400, body="invalid signature")

        try:
            with self.connect() as db:
                db.execute(
                    """INSERT INTO payment_webhooks
                         (gateway, order_id, status, gateway_status,
                          gateway_reference, amount, verified, body,
                          headers, available_at, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)""",
                    (
                        name,
                        callback.order_id,
                        str(callback.status),
                        callback.gateway_status,
                        callback.gateway_reference,
                        callback.amount,
                        request.body,
                        headers,
                        timestamp,
                        timestamp,
                    ),
                )
        except sqlite3.Error:
            # Not stored: answer 500 so the gateway retries later.
            return Acknowledgement(status=500, body="try again")

        return callback.acknowledgement()
```

## Worker

`work` processes stored webhooks one at a time and is safe to run in several processes:

- **Lock:** a worker claims a row by setting `locked_until`; a crashed worker's claim expires after `LOCK_SECONDS`.
- **Idempotent:** the order is only marked paid while `paid_at IS NULL`, so a retried or duplicated webhook never fulfills twice.
- **Retries:** a failure keeps `last_error` and waits `BACKOFF` before the next attempt, up to `MAX_ATTEMPTS`.

```python
import logging
import sqlite3
import threading

from python_myanmar_payments import Amount, PaymentStatus

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
LOCK_SECONDS = 120
# The wait before each retry, in seconds.
BACKOFF = [10, 60, 300, 900]


class Webhooks:
    # ...__init__(), connect() and handle() from above

    def work(self, stop: threading.Event) -> None:
        """Processes stored webhooks until stop is set. Safe to run in
        several processes."""
        while not stop.is_set():
            found = False
            try:
                found = self.process_next()
            except Exception:
                logger.exception("payment webhooks")
            if not found:
                stop.wait(2)

    def process_next(self) -> bool:
        """Processes one webhook; returns False when there was nothing
        to do."""
        timestamp = now()
        with self.connect() as db:
            db.row_factory = sqlite3.Row
            webhook = db.execute(
                """SELECT id, order_id, status, gateway_reference, amount,
                          attempts
                   FROM payment_webhooks
                   WHERE verified = 1 AND processed_at IS NULL
                     AND attempts < ? AND available_at <= ?
                     AND (locked_until IS NULL OR locked_until < ?)
                   ORDER BY id LIMIT 1""",
                (MAX_ATTEMPTS, timestamp, timestamp),
            ).fetchone()
            if webhook is None:
                return False

            # Claim the row; a worker that read it at the same time
            # changes 0 rows and moves on.
            claimed = db.execute(
                """UPDATE payment_webhooks
                   SET locked_until = ?, attempts = attempts + 1
                   WHERE id = ? AND processed_at IS NULL
                     AND (locked_until IS NULL OR locked_until < ?)""",
                (timestamp + LOCK_SECONDS, webhook["id"], timestamp),
            )
            if claimed.rowcount != 1:
                return True

            try:
                self.fulfill(db, webhook)
            except Exception as error:
                retry = min(webhook["attempts"], len(BACKOFF) - 1)
                db.execute(
                    """UPDATE payment_webhooks
                       SET last_error = ?, available_at = ?,
                           locked_until = NULL
                       WHERE id = ?""",
                    (str(error), now() + BACKOFF[retry], webhook["id"]),
                )
                return True

            db.execute(
                """UPDATE payment_webhooks
                   SET processed_at = ?, last_error = NULL,
                       locked_until = NULL
                   WHERE id = ?""",
                (now(), webhook["id"]),
            )
            return True

    def fulfill(self, db: sqlite3.Connection, webhook: sqlite3.Row) -> None:
        if webhook["status"] != PaymentStatus.SUCCESSFUL:
            return  # record failures, cancellations, ... as your app needs

        order = db.execute(
            "SELECT amount, paid_at FROM orders WHERE number = ?",
            (webhook["order_id"],),
        ).fetchone()
        if order is None:
            raise LookupError(f"order {webhook['order_id']} not found")
        if order["paid_at"] is not None:
            return  # already fulfilled by an earlier webhook
        # Yoma MMQR callbacks carry no amount: Yoma fixed it when the order
        # was checked out.
        if webhook["amount"] is not None and not Amount.parse(
            order["amount"]
        ).equals(webhook["amount"]):
            raise ValueError(
                f"paid {webhook['amount']}, expected {order['amount']}"
                f" for order {webhook['order_id']}"
            )

        # The paid_at IS NULL condition keeps this idempotent even if two
        # webhooks for one order run at once.
        db.execute(
            """UPDATE orders SET paid_at = ?, gateway_reference = ?
               WHERE number = ? AND paid_at IS NULL""",
            (now(), webhook["gateway_reference"], webhook["order_id"]),
        )
```

The sample assumes an `orders` table with a unique `number`, the `amount` as decimal text, and nullable `paid_at` and `gateway_reference`. `Amount.equals` makes `1000`, `1000.0` and `1000.00` compare equal. With an async database driver, make `process_next` and `fulfill` coroutines and `await` each query; the logic stays the same.

## Wiring It Up

With Flask, one route serves every gateway and a thread runs the worker; any other framework builds the `CallbackRequest` and writes the `Acknowledgement` the same way (see [Framework Integration](/python-myanmar-payments/framework-integration)):

```python
import threading

from flask import Flask, Response, request
from python_myanmar_payments import CallbackRequest, KbzPay, WaveMoney

from shop.webhooks import Webhooks

webhooks = Webhooks(
    "payments.sqlite",
    {
        "kbz-pay": KbzPay.from_env(),
        "wave-money": WaveMoney.from_env(),
    },
)

app = Flask(__name__)


@app.post("/webhooks/payments/<gateway>")
def payment_webhook(gateway: str) -> Response:
    callback_request = CallbackRequest(
        body=request.get_data(),
        headers=request.headers,
        query=request.query_string,
    )
    ack = webhooks.handle(gateway, callback_request)
    return Response(ack.body, status=ack.status, headers=dict(ack.headers))


stop = threading.Event()
threading.Thread(target=webhooks.work, args=(stop,), daemon=True).start()
```

Use `https://shop.test/webhooks/payments/kbz-pay` (and so on) as each gateway's callback URL. In production, run the worker as its own process instead (`webhooks.work(threading.Event())` from a management command or a systemd service), or call `process_next()` from Celery, RQ or a cron job.

## Replay and Prune

A row that ran out of attempts keeps `last_error` and `processed_at IS NULL`. After fixing the cause, make it available again and a worker picks it up:

```sql
UPDATE payment_webhooks
SET attempts = 0, available_at = 0, last_error = NULL
WHERE id = 42;
```

To run a stored call through verification again, e.g. after rotating a key, rebuild it from the stored body and headers: `CallbackRequest(body=row["body"], headers=json.loads(row["headers"]))`.

Delete old processed and rejected rows once a day; failed rows stay until you replay or delete them:

```python
with webhooks.connect() as db:
    db.execute(
        """DELETE FROM payment_webhooks
           WHERE created_at < ?
             AND (processed_at IS NOT NULL OR verified = 0)""",
        (now() - 90 * 24 * 60 * 60,),
    )
```
