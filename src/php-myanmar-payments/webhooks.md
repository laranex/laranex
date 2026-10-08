---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in plain PHP - verify, store, acknowledge, then process once in a worker with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `handleCallback()`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `$callback->acknowledgement()->send()`, so the gateway stops retrying.
4. **Process once** in a worker: claim the row, skip what is already fulfilled, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'webhook.php', 'worker.php']"
  :steps="[
    { from: 'Gateway', to: 'webhook.php', label: 'Webhook', detail: 'POST /webhook.php?gateway=...' },
    { from: 'webhook.php', to: 'webhook.php', label: 'Verify the signature', detail: 'handleCallback($request)' },
    { from: 'webhook.php', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: 'SignatureVerificationException', response: true },
    { from: 'webhook.php', to: 'webhook.php', label: 'Store the call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'webhook.php', to: 'Gateway', label: 'Acknowledge immediately', detail: 'acknowledgement()->send()', response: true },
    { from: 'worker.php', to: 'worker.php', label: 'Claim the next row', detail: 'locked_until, attempts + 1' },
    { from: 'worker.php', to: 'worker.php', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own orders table. It uses PDO, so it runs on SQLite, MySQL or PostgreSQL with the column types noted in the schema.

## Table

```sql
CREATE TABLE payment_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- BIGINT AUTO_INCREMENT on MySQL, BIGSERIAL on PostgreSQL
    gateway VARCHAR(32) NOT NULL,
    order_id VARCHAR(64) NULL,
    status VARCHAR(16) NULL,               -- PaymentStatus value
    gateway_status VARCHAR(64) NULL,
    gateway_reference VARCHAR(128) NULL,
    amount VARCHAR(32) NULL,               -- as the gateway sent it, never a float
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
CREATE INDEX payment_webhooks_order ON payment_webhooks (gateway, order_id, status);
```

## Configuration

```php
<?php

require __DIR__.'/vendor/autoload.php';

use Laranex\PhpMyanmarPayments\MyanmarPayments;

$pdo = new PDO(getenv('DATABASE_DSN') ?: 'sqlite:'.__DIR__.'/app.sqlite', getenv('DATABASE_USER') ?: null, getenv('DATABASE_PASSWORD') ?: null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

$payments = new MyanmarPayments([
    'wave_money' => [
        'merchant_id' => getenv('WAVE_MONEY_MERCHANT_ID'),
        'secret_key' => getenv('WAVE_MONEY_SECRET_KEY'),
        'merchant_name' => 'My Shop',
        'sandbox' => true,
    ],
    // 'kbz_pay' => [...], 'aya_pay' => [...], 'yoma_mmqr' => [...], 'cyber_source' => [...]
]);
```

## Webhook Endpoint

`webhook.php` only verifies, stores and acknowledges, so it answers in milliseconds. Use `https://shop.test/webhook.php?gateway=wave-money` (and so on) as each gateway's callback URL.

```php
<?php

// POST /webhook.php?gateway=wave-money : verify, store, acknowledge. Processing happens in worker.php.

require __DIR__.'/bootstrap.php';

use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$gateway = $_GET['gateway'] ?? '';
$driver = match ($gateway) {
    'kbz-pay' => $payments->kbzPay(),
    'wave-money' => $payments->waveMoney(),
    'aya-pay' => $payments->ayaPay(),
    'yoma-mmqr' => $payments->yomaMmqr(),
    'cyber-source' => $payments->cyberSource(),
    default => null,
};

if ($driver === null) {
    http_response_code(404);
    exit;
}

$request = CallbackRequest::fromGlobals();
$store = $pdo->prepare('INSERT INTO payment_webhooks
    (gateway, order_id, status, gateway_status, gateway_reference, amount, verified, body, headers, last_error, available_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

try {
    $callback = $driver->handleCallback($request);
} catch (SignatureVerificationException $e) {
    $store->execute([$gateway, null, null, null, null, null, 0, $request->body, json_encode($request->headers()), $e->getMessage(), time(), time()]);
    http_response_code(400);
    echo 'invalid signature';
    exit;
}

$store->execute([
    $gateway, $callback->orderId, $callback->status->value, $callback->gatewayStatus, $callback->gatewayReference,
    $callback->amount, 1, $request->body, json_encode($request->headers()), null, time(), time(),
]);

$callback->acknowledgement()->send();
```

In a PSR-7 framework, build the request with `CallbackRequest::fromPsr7($request)` and copy `$callback->acknowledgement()`'s `status`, `headers` and `body` to your response instead of calling `send()`.

## Worker

`worker.php` processes stored webhooks one at a time and is safe to run in several processes:

- **Lock:** a worker claims a row by setting `locked_until`; a crashed worker's claim expires after two minutes.
- **Idempotent:** the order is only marked paid while `paid_at IS NULL`, so a retried or duplicated webhook never fulfills twice.
- **Retries:** a failure keeps `last_error` and waits `BACKOFF` seconds before the next attempt, up to `MAX_ATTEMPTS`.

```php
<?php

// php worker.php : processes stored webhooks once, with retries and backoff. Run it under a process manager.

require __DIR__.'/bootstrap.php';

const MAX_ATTEMPTS = 5;
const BACKOFF = [10, 60, 300, 900]; // seconds before each retry
const LOCK_SECONDS = 120;

function processNext(PDO $pdo): bool
{
    $now = time();
    $next = $pdo->prepare('SELECT * FROM payment_webhooks
        WHERE verified = 1 AND processed_at IS NULL AND attempts < ? AND available_at <= ?
          AND (locked_until IS NULL OR locked_until < ?)
        ORDER BY id LIMIT 1');
    $next->execute([MAX_ATTEMPTS, $now, $now]);
    $webhook = $next->fetch(PDO::FETCH_ASSOC);

    if ($webhook === false) {
        return false;
    }

    // Claim the row; another worker that read it at the same time gets rowCount() 0 and moves on.
    $claim = $pdo->prepare('UPDATE payment_webhooks SET locked_until = ?, attempts = attempts + 1
        WHERE id = ? AND processed_at IS NULL AND (locked_until IS NULL OR locked_until < ?)');
    $claim->execute([$now + LOCK_SECONDS, $webhook['id'], $now]);

    if ($claim->rowCount() !== 1) {
        return true;
    }

    try {
        fulfill($pdo, $webhook);

        $pdo->prepare('UPDATE payment_webhooks SET processed_at = ?, last_error = NULL, locked_until = NULL WHERE id = ?')
            ->execute([time(), $webhook['id']]);
    } catch (Throwable $e) {
        $attempt = (int) $webhook['attempts'] + 1;
        $delay = BACKOFF[min($attempt - 1, count(BACKOFF) - 1)];

        $pdo->prepare('UPDATE payment_webhooks SET last_error = ?, available_at = ?, locked_until = NULL WHERE id = ?')
            ->execute([$e->getMessage(), time() + $delay, $webhook['id']]);
    }

    return true;
}

/**
 * @param  array<string, mixed>  $webhook
 */
function fulfill(PDO $pdo, array $webhook): void
{
    if ($webhook['status'] !== 'successful') { // PaymentStatus::Successful->value
        return; // record failures, cancellations, ... as your app needs
    }

    $order = $pdo->prepare('SELECT amount, paid_at FROM orders WHERE number = ?');
    $order->execute([$webhook['order_id']]);
    $row = $order->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        throw new RuntimeException("Order {$webhook['order_id']} not found.");
    }

    if ($row['paid_at'] !== null) {
        return; // already fulfilled by an earlier webhook
    }

    if (normalizeAmount((string) $webhook['amount']) !== normalizeAmount((string) $row['amount'])) {
        throw new RuntimeException("Paid {$webhook['amount']}, expected {$row['amount']} for order {$webhook['order_id']}.");
    }

    // The paid_at IS NULL condition makes this idempotent even if two webhooks for one order run at once.
    $pdo->prepare('UPDATE orders SET paid_at = ?, gateway_reference = ? WHERE number = ? AND paid_at IS NULL')
        ->execute([time(), $webhook['gateway_reference'], $webhook['order_id']]);
}

/**
 * "1000", "1000.0" and "1000.00" compare equal.
 */
function normalizeAmount(string $amount): string
{
    return str_contains($amount, '.') ? rtrim(rtrim($amount, '0'), '.') : $amount;
}

while (true) {
    if (! processNext($pdo)) {
        sleep(2);
    }
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as a decimal string, and nullable `paid_at` and `gateway_reference`. Run the worker under a process manager such as systemd or Supervisor.

## Replay and Prune

A row that ran out of attempts keeps `last_error` and `processed_at IS NULL`. After fixing the cause, make it available again and the worker picks it up:

```sql
UPDATE payment_webhooks SET attempts = 0, available_at = 0, last_error = NULL WHERE id = 42;
```

Delete old processed and rejected rows from a daily cron job; failed rows stay until you replay or delete them:

```php
$pdo->prepare('DELETE FROM payment_webhooks WHERE created_at < ? AND (processed_at IS NOT NULL OR verified = 0)')
    ->execute([time() - 90 * 86400]);
```
