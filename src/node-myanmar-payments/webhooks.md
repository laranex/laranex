---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a Node.js app - verify, store, acknowledge, then process once in a background worker with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `handleCallback`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `callback.acknowledgement.send(res)`, so the gateway stops retrying.
4. **Process once** in a background worker: claim the row, skip what is already fulfilled, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'HTTP handler', 'Worker']"
  :steps="[
    { from: 'Gateway', to: 'HTTP handler', label: 'Webhook', detail: 'POST /webhooks/payments/:gateway' },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Verify the signature', detail: 'gateway.handleCallback(request)' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: 'SignatureVerificationError', response: true },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Store the call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Acknowledge immediately', detail: 'callback.acknowledgement.send(res)', response: true },
    { from: 'Worker', to: 'Worker', label: 'Claim the next row', detail: 'locked_until, attempts + 1' },
    { from: 'Worker', to: 'Worker', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own orders table. The sample uses `node:http` and the built-in `node:sqlite` module (`DatabaseSync`, available without a flag from Node.js 22.13). On Node.js 20, use [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3), whose `prepare().run()/get()` API is the same; with PostgreSQL or MySQL, use your driver's async queries and placeholders.

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

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import {
  CallbackRequest,
  SignatureVerificationError,
  type PaymentCallback,
} from '@laranex/myanmar-payments';

/**
 * What every gateway (KbzPay, WaveMoney, AyaPay, YomaMmqr, CyberSource)
 * has in common.
 */
interface Verifier {
  handleCallback(request: CallbackRequest): PaymentCallback;
}

const now = (): number => Math.floor(Date.now() / 1000);

export class Webhooks {
  constructor(
    private readonly db: DatabaseSync,
    // 'kbz-pay' => kbz, 'wave-money' => wave, ...
    private readonly gateways: Record<string, Verifier>,
  ) {}

  /** Verifies, stores and acknowledges. Processing happens in work(). */
  async handle(
    name: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const gateway = this.gateways[name];
    if (gateway === undefined) {
      res.writeHead(404).end();
      return;
    }

    const request = await CallbackRequest.fromNodeRequest(req);
    const headers = JSON.stringify(request.headers);
    const time = now();

    let callback: PaymentCallback;
    try {
      callback = gateway.handleCallback(request);
    } catch (error) {
      if (!(error instanceof SignatureVerificationError)) {
        throw error;
      }
      this.db
        .prepare(
          `INSERT INTO payment_webhooks
             (gateway, verified, body, headers, last_error,
              available_at, created_at)
           VALUES (?, 0, ?, ?, ?, ?, ?)`,
        )
        .run(name, request.body, headers, error.message, time, time);
      res.writeHead(400).end('invalid signature');
      return;
    }

    try {
      this.db
        .prepare(
          `INSERT INTO payment_webhooks
             (gateway, order_id, status, gateway_status, gateway_reference,
              amount, verified, body, headers, available_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        )
        .run(
          name,
          callback.orderId,
          callback.status,
          callback.gatewayStatus,
          callback.gatewayReference ?? null,
          callback.amount ?? null,
          request.body,
          headers,
          time,
          time,
        );
    } catch {
      // Not stored: answer 500 so the gateway retries later.
      res.writeHead(500).end('try again');
      return;
    }

    callback.acknowledgement.send(res);
  }
}
```

## Worker

`work` processes stored webhooks one at a time and is safe to run in several processes:

- **Lock:** a worker claims a row by setting `locked_until`; a crashed worker's claim expires after `LOCK_SECONDS`.
- **Idempotent:** the order is only marked paid while `paid_at IS NULL`, so a retried or duplicated webhook never fulfills twice.
- **Retries:** a failure keeps `last_error` and waits `BACKOFF` before the next attempt, up to `MAX_ATTEMPTS`.

```ts
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 120;
/** The wait before each retry, in seconds. */
const BACKOFF = [10, 60, 300, 900];

interface StoredWebhook {
  id: number;
  order_id: string;
  status: string;
  gateway_reference: string | null;
  amount: string | null;
  attempts: number;
}

export class Webhooks {
  // ...constructor and handle() from above

  /**
   * Processes stored webhooks until the signal aborts. Safe to run in
   * several processes.
   */
  async work(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      let found = false;
      try {
        found = this.processNext();
      } catch (error) {
        console.error('payment webhooks:', error);
      }
      if (!found) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  /** Processes one webhook; returns false when there was nothing to do. */
  processNext(): boolean {
    const time = now();
    const webhook = this.db
      .prepare(
        `SELECT id, order_id, status, gateway_reference, amount, attempts
         FROM payment_webhooks
         WHERE verified = 1 AND processed_at IS NULL
           AND attempts < ? AND available_at <= ?
           AND (locked_until IS NULL OR locked_until < ?)
         ORDER BY id LIMIT 1`,
      )
      .get(MAX_ATTEMPTS, time, time) as StoredWebhook | undefined;
    if (webhook === undefined) {
      return false;
    }

    // Claim the row; a worker that read it at the same time changes 0 rows
    // and moves on.
    const claimed = this.db
      .prepare(
        `UPDATE payment_webhooks SET locked_until = ?, attempts = attempts + 1
         WHERE id = ? AND processed_at IS NULL
           AND (locked_until IS NULL OR locked_until < ?)`,
      )
      .run(time + LOCK_SECONDS, webhook.id, time);
    if (Number(claimed.changes) !== 1) {
      return true;
    }

    try {
      this.fulfill(webhook);
    } catch (error) {
      const retry = Math.min(webhook.attempts, BACKOFF.length - 1);
      const delay = BACKOFF[retry] as number;
      const message = error instanceof Error ? error.message : error;
      this.db
        .prepare(
          `UPDATE payment_webhooks
           SET last_error = ?, available_at = ?, locked_until = NULL
           WHERE id = ?`,
        )
        .run(String(message), now() + delay, webhook.id);
      return true;
    }

    this.db
      .prepare(
        `UPDATE payment_webhooks
         SET processed_at = ?, last_error = NULL, locked_until = NULL
         WHERE id = ?`,
      )
      .run(now(), webhook.id);
    return true;
  }

  private fulfill(webhook: StoredWebhook): void {
    if (webhook.status !== 'successful') {
      return; // record failures, cancellations, ... as your app needs
    }

    const order = this.db
      .prepare(`SELECT amount, paid_at FROM orders WHERE number = ?`)
      .get(webhook.order_id) as
      | { amount: string; paid_at: number | null }
      | undefined;
    if (order === undefined) {
      throw new Error(`order ${webhook.order_id} not found`);
    }
    if (order.paid_at !== null) {
      return; // already fulfilled by an earlier webhook
    }
    // Yoma MMQR callbacks carry no amount: Yoma fixed it when the order was
    // checked out.
    if (
      webhook.amount !== null &&
      normalizeAmount(webhook.amount) !== normalizeAmount(order.amount)
    ) {
      throw new Error(
        `paid ${webhook.amount}, expected ${order.amount}` +
          ` for order ${webhook.order_id}`,
      );
    }

    // The paid_at IS NULL condition keeps this idempotent even if two
    // webhooks for one order run at once.
    this.db
      .prepare(
        `UPDATE orders SET paid_at = ?, gateway_reference = ?
         WHERE number = ? AND paid_at IS NULL`,
      )
      .run(now(), webhook.gateway_reference, webhook.order_id);
  }
}

/** Makes "1000", "1000.0" and "1000.00" compare equal. */
function normalizeAmount(amount: string): string {
  return amount.includes('.')
    ? amount.replace(/0+$/, '').replace(/\.$/, '')
    : amount;
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as a decimal string, and nullable `paid_at` and `gateway_reference`. With an async driver, make `processNext` and `fulfill` `async` and `await` each query; the logic stays the same.

## Wiring It Up

```ts
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { KbzPay } from '@laranex/myanmar-payments/kbz-pay';
import { WaveMoney } from '@laranex/myanmar-payments/wave-money';

const db = new DatabaseSync('payments.sqlite');
const webhooks = new Webhooks(db, {
  'kbz-pay': KbzPay.fromEnv(process.env),
  'wave-money': WaveMoney.fromEnv(process.env),
});

createServer((req, res) => {
  const match = /^\/webhooks\/payments\/([\w-]+)$/.exec(req.url ?? '');
  if (req.method === 'POST' && match) {
    webhooks
      .handle(match[1] as string, req, res)
      .catch(() => res.writeHead(500).end());
    return;
  }
  res.writeHead(404).end();
}).listen(8080);

const controller = new AbortController();
void webhooks.work(controller.signal);
process.on('SIGTERM', () => controller.abort());
```

Use `https://shop.test/webhooks/payments/kbz-pay` (and so on) as each gateway's callback URL.

## Replay and Prune

A row that ran out of attempts keeps `last_error` and `processed_at IS NULL`. After fixing the cause, make it available again and a worker picks it up:

```sql
UPDATE payment_webhooks
SET attempts = 0, available_at = 0, last_error = NULL
WHERE id = 42;
```

Delete old processed and rejected rows once a day; failed rows stay until you replay or delete them:

```ts
db.prepare(
  `DELETE FROM payment_webhooks
   WHERE created_at < ? AND (processed_at IS NOT NULL OR verified = 0)`,
).run(now() - 90 * 24 * 60 * 60);
```
