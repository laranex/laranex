---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a PHP app - verify, store, acknowledge, then process once in a background worker with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `handleCallback()`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `$callback->acknowledgement`, so the gateway stops retrying.
4. **Process once** in a background worker: claim the row, skip what is already fulfilled, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'HTTP handler', 'Worker']"
  :steps="[
    { from: 'Gateway', to: 'HTTP handler', label: 'Webhook', detail: 'POST /webhooks/payments/{gateway}' },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Verify the signature', detail: '$gateway->handleCallback($request)' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: 'SignatureVerificationException', response: true },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Store the call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Acknowledge immediately', detail: '$callback->acknowledgement', response: true },
    { from: 'Worker', to: 'Worker', label: 'Claim the next row', detail: 'locked_until, attempts + 1' },
    { from: 'Worker', to: 'Worker', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own orders table. The sample uses PDO and is framework-independent, so it runs on SQLite, MySQL or PostgreSQL with the column types noted in the schema.

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

`handle()` takes the gateway name and the `CallbackRequest`, and returns the `Acknowledgement` to send, including the `400` for a rejected call, so every framework writes the answer the same way:

```php
<?php

// src/PaymentWebhooks.php

use Laranex\PhpMyanmarPayments\Contracts\PaymentGateway;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\Acknowledgement;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

final class PaymentWebhooks
{
    /**
     * PaymentGateway is what every gateway (KbzPay, WaveMoney, AyaPay,
     * YomaMmqr, CyberSource) has in common.
     *
     * @param  array<string, PaymentGateway>  $gateways  'kbz-pay' => $kbz, ...
     */
    public function __construct(
        private readonly PDO $db,
        private readonly array $gateways,
    ) {}

    /** Verifies, stores and acknowledges. Processing happens in work(). */
    public function handle(
        string $name,
        CallbackRequest $request,
    ): Acknowledgement {
        $gateway = $this->gateways[$name] ?? null;
        if ($gateway === null) {
            return new Acknowledgement(404);
        }

        $headers = (string) json_encode($request->headers());
        $now = time();

        try {
            $callback = $gateway->handleCallback($request);
        } catch (SignatureVerificationException $e) {
            $this->db->prepare(
                'INSERT INTO payment_webhooks
                   (gateway, verified, body, headers, last_error,
                    available_at, created_at)
                 VALUES (?, 0, ?, ?, ?, ?, ?)',
            )->execute([
                $name, $request->body, $headers, $e->getMessage(), $now, $now,
            ]);

            return new Acknowledgement(400, 'invalid signature');
        }

        try {
            $this->db->prepare(
                'INSERT INTO payment_webhooks
                   (gateway, order_id, status, gateway_status,
                    gateway_reference, amount, verified, body,
                    headers, available_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
            )->execute([
                $name,
                $callback->orderId,
                $callback->status->value,
                $callback->gatewayStatus,
                $callback->gatewayReference,
                $callback->amount,
                $request->body,
                $headers,
                $now,
                $now,
            ]);
        } catch (PDOException) {
            // Not stored: answer 500 so the gateway retries later.
            return new Acknowledgement(500, 'try again');
        }

        return $callback->acknowledgement;
    }
}
```

## Worker

`work()` processes stored webhooks one at a time and is safe to run in several processes:

- **Lock:** a worker claims a row by setting `locked_until`; a crashed worker's claim expires after `LOCK_SECONDS`.
- **Idempotent:** the order is only marked paid while `paid_at IS NULL`, so a retried or duplicated webhook never fulfills twice.
- **Retries:** a failure keeps `last_error` and waits `BACKOFF` before the next attempt, up to `MAX_ATTEMPTS`.

```php
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;

final class PaymentWebhooks
{
    private const MAX_ATTEMPTS = 5;

    private const LOCK_SECONDS = 120;

    /** The wait before each retry, in seconds. */
    private const BACKOFF = [10, 60, 300, 900];

    // ...__construct() and handle() from above

    /** Processes stored webhooks forever. Safe to run in several processes. */
    public function work(): never
    {
        while (true) {
            $found = false;
            try {
                $found = $this->processNext();
            } catch (Throwable $e) {
                error_log('payment webhooks: '.$e->getMessage());
            }
            if (! $found) {
                sleep(2);
            }
        }
    }

    /** Processes one webhook; returns false when there was nothing to do. */
    public function processNext(): bool
    {
        $now = time();
        $next = $this->db->prepare(
            'SELECT id, order_id, status, gateway_reference, amount, attempts
             FROM payment_webhooks
             WHERE verified = 1 AND processed_at IS NULL
               AND attempts < ? AND available_at <= ?
               AND (locked_until IS NULL OR locked_until < ?)
             ORDER BY id LIMIT 1',
        );
        $next->execute([self::MAX_ATTEMPTS, $now, $now]);
        $webhook = $next->fetch(PDO::FETCH_ASSOC);
        if ($webhook === false) {
            return false;
        }

        // Claim the row; a worker that read it at the same time changes 0
        // rows and moves on.
        $claim = $this->db->prepare(
            'UPDATE payment_webhooks
             SET locked_until = ?, attempts = attempts + 1
             WHERE id = ? AND processed_at IS NULL
               AND (locked_until IS NULL OR locked_until < ?)',
        );
        $claim->execute([$now + self::LOCK_SECONDS, $webhook['id'], $now]);
        if ($claim->rowCount() !== 1) {
            return true;
        }

        try {
            $this->fulfill($webhook);
        } catch (Throwable $e) {
            $retry = min((int) $webhook['attempts'], count(self::BACKOFF) - 1);
            $this->db->prepare(
                'UPDATE payment_webhooks
                 SET last_error = ?, available_at = ?, locked_until = NULL
                 WHERE id = ?',
            )->execute([
                $e->getMessage(),
                time() + self::BACKOFF[$retry],
                $webhook['id'],
            ]);

            return true;
        }

        $this->db->prepare(
            'UPDATE payment_webhooks
             SET processed_at = ?, last_error = NULL, locked_until = NULL
             WHERE id = ?',
        )->execute([time(), $webhook['id']]);

        return true;
    }

    /** @param array<string, mixed> $webhook */
    private function fulfill(array $webhook): void
    {
        if ($webhook['status'] !== PaymentStatus::Successful->value) {
            return; // record failures, cancellations, ... as your app needs
        }

        $find = $this->db->prepare(
            'SELECT amount, paid_at FROM orders WHERE number = ?',
        );
        $find->execute([$webhook['order_id']]);
        $order = $find->fetch(PDO::FETCH_ASSOC);
        if ($order === false) {
            throw new RuntimeException(
                "order {$webhook['order_id']} not found",
            );
        }
        if ($order['paid_at'] !== null) {
            return; // already fulfilled by an earlier webhook
        }
        // Yoma MMQR callbacks carry no amount: Yoma fixed it when the order
        // was checked out.
        if (
            $webhook['amount'] !== null
            && ! Amount::parse((string) $order['amount'])
                ->equals($webhook['amount'])
        ) {
            throw new RuntimeException(
                "paid {$webhook['amount']}, expected {$order['amount']}"
                ." for order {$webhook['order_id']}",
            );
        }

        // The paid_at IS NULL condition keeps this idempotent even if two
        // webhooks for one order run at once.
        $this->db->prepare(
            'UPDATE orders SET paid_at = ?, gateway_reference = ?
             WHERE number = ? AND paid_at IS NULL',
        )->execute([
            time(), $webhook['gateway_reference'], $webhook['order_id'],
        ]);
    }
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as decimal text, and nullable `paid_at` and `gateway_reference`. `Amount::equals()` makes `1000`, `1000.0` and `1000.00` compare equal.

## Wiring It Up

With plain PHP, one script serves every gateway and a second one runs the worker; any other framework builds the `CallbackRequest` and writes the `Acknowledgement` the same way (see [Framework Integration](/php-myanmar-payments/framework-integration)):

```php
<?php

// bootstrap.php
require __DIR__.'/vendor/autoload.php';

use Laranex\PhpMyanmarPayments\MyanmarPayments;

$payments = MyanmarPayments::fromEnv();

$webhooks = new PaymentWebhooks(
    new PDO('sqlite:'.__DIR__.'/payments.sqlite', options: [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]),
    [
        'kbz-pay' => $payments->kbzPay(),
        'wave-money' => $payments->waveMoney(),
    ],
);
```

```php
<?php

// public/webhooks.php, served as POST /webhooks/payments/{gateway}
require __DIR__.'/../bootstrap.php';

use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$path = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$gateway = basename($path);

$webhooks->handle($gateway, CallbackRequest::fromGlobals())->send();
```

```php
<?php

// worker.php: php worker.php
require __DIR__.'/bootstrap.php';

$webhooks->work();
```

Use `https://shop.test/webhooks/payments/kbz-pay` (and so on) as each gateway's callback URL. Run the worker under a process manager such as systemd or Supervisor, or call `processNext()` from a cron job or your queue.

## Replay and Prune

A row that ran out of attempts keeps `last_error` and `processed_at IS NULL`. After fixing the cause, make it available again and a worker picks it up:

```sql
UPDATE payment_webhooks
SET attempts = 0, available_at = 0, last_error = NULL
WHERE id = 42;
```

To run a stored call through verification again, e.g. after rotating a key, rebuild it from the stored body and headers: `new CallbackRequest($row['body'], json_decode($row['headers'], true))`.

Delete old processed and rejected rows once a day; failed rows stay until you replay or delete them:

```php
$db->prepare(
    'DELETE FROM payment_webhooks
     WHERE created_at < ?
       AND (processed_at IS NOT NULL OR verified = 0)',
)->execute([time() - 90 * 24 * 60 * 60]);
```
