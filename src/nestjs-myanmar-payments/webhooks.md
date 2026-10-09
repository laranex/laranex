---
title: Handling Webhooks (recommended)
description: The recommended way to handle payment callbacks in NestJS. Verify with the package, store the raw call in your own table, acknowledge at once, then process each one once in a background worker with a lock, retries, replay and pruning.
---

# Handling Webhooks (recommended)

Gateways deliver payment results as server-to-server callbacks (webhooks). They retry until they get the acknowledgement they expect, can deliver the same result more than once, and give you only a few seconds to answer. The flow below handles all of that and leaves a record you can debug and replay:

1. **Verify** the callback with the package (`@RawCallback()` and `MyanmarPaymentsService.handleCallback()`).
2. **Store** the raw call in your own table. Bad signatures are stored as rejected for debugging and never processed.
3. **Acknowledge** at once by returning the callback from an `@AcknowledgeCallback()` handler, before any business logic runs.
4. **Process once** in a background worker: claim the row with a lock, skip orders that are already fulfilled, compare the amount, retry with backoff and keep the last error. Replay failed rows and prune old ones.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'WebhooksController', 'Database', 'Worker']"
  :steps="[
    { from: 'Gateway', to: 'WebhooksController', label: 'POST /payments/callback/kbz-pay', detail: 'payment notification' },
    { from: 'WebhooksController', to: 'WebhooksController', label: 'Verify the signature', detail: 'payments.handleCallback(gateway, request)' },
    { from: 'WebhooksController', to: 'Database', label: 'Invalid: store as rejected', detail: 'verified = 0, last_error' },
    { from: 'WebhooksController', to: 'Gateway', label: 'Invalid: 400', detail: 'BadRequestException', response: true },
    { from: 'WebhooksController', to: 'Database', label: 'Store the verified call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'WebhooksController', to: 'Gateway', label: 'Acknowledge at once', detail: '@AcknowledgeCallback(): return callback', response: true },
    { from: 'Worker', to: 'Database', label: 'Claim the next due row', detail: 'locked_until, attempts + 1' },
    { from: 'Worker', to: 'Database', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

The package itself stores nothing: everything on this page is application code you copy into your app and adapt. The sample uses the built-in `node:sqlite` module (`DatabaseSync`, Node.js 22.13+) so it runs without extra dependencies; with TypeORM, Prisma, MikroORM or another database, keep the same columns and the same conditional `UPDATE`s. The Laranex NestJS playground app runs this exact code under its end-to-end tests. For a queue instead of the in-process worker, run `processNext()` from a BullMQ processor; the claim logic stays the same.

## Table

```sql
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gateway VARCHAR(32) NOT NULL,
  order_id VARCHAR(64) NULL,
  status VARCHAR(16) NULL,              -- PaymentStatus value
  gateway_status VARCHAR(64) NULL,
  gateway_reference VARCHAR(128) NULL,
  amount VARCHAR(32) NULL,              -- as the gateway sent it, never a float
  verified SMALLINT NOT NULL,
  body TEXT NOT NULL,                   -- the raw request body
  headers TEXT NOT NULL,                -- JSON
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  available_at INTEGER NOT NULL,        -- unix time of the next attempt
  locked_until INTEGER NULL,
  processed_at INTEGER NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_webhooks_order
  ON payment_webhooks (gateway, order_id, status);
```

Your orders table needs the order number, the amount as a decimal string and a nullable `paid_at`; the sample's is `orders (number, gateway, amount, gateway_reference, paid_at, created_at)`.

## Database Provider

```ts
// src/database.ts
import { DatabaseSync } from 'node:sqlite';

/** Injection token of the playground's SQLite database. */
export const DATABASE = Symbol('DATABASE');

/**
 * Opens the playground database and creates its tables: the orders the
 * checkout routes create and the payment_webhooks table of the recommended
 * webhook flow.
 *
 * @param path A file path, or ':memory:' for tests.
 */
export function openDatabase(path = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number VARCHAR(64) NOT NULL UNIQUE,
      gateway VARCHAR(32) NOT NULL,
      amount VARCHAR(32) NOT NULL,          -- decimal string, never a float
      gateway_reference VARCHAR(128) NULL,
      paid_at INTEGER NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gateway VARCHAR(32) NOT NULL,
      order_id VARCHAR(64) NULL,
      status VARCHAR(16) NULL,              -- PaymentStatus value
      gateway_status VARCHAR(64) NULL,
      gateway_reference VARCHAR(128) NULL,
      amount VARCHAR(32) NULL,              -- as sent, never a float
      verified SMALLINT NOT NULL,
      body TEXT NOT NULL,                   -- the raw request body
      headers TEXT NOT NULL,                -- JSON
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      available_at INTEGER NOT NULL,        -- unix time of the next attempt
      locked_until INTEGER NULL,
      processed_at INTEGER NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payment_webhooks_order
      ON payment_webhooks (gateway, order_id, status);
  `);
  return db;
}

/** Unix time in seconds. */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}
```

## Controller

The app must be created with `rawBody: true` (see [Installation](/nestjs-myanmar-payments/installation#keep-the-raw-body)).

```ts
// src/webhooks/webhooks.controller.ts
import type {
  CallbackRequest,
  PaymentCallback,
} from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  GATEWAY_NAMES,
  type GatewayName,
  RawCallback,
} from '@laranex/nestjs-myanmar-payments';
import { Controller, NotFoundException, Param, Post } from '@nestjs/common';

import { WebhooksService } from './webhooks.service.js';

/**
 * One callback endpoint per gateway: verify, store, acknowledge; the worker
 * processes it.
 */
@Controller('payments/callback')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post(':gateway')
  @AcknowledgeCallback()
  async receive(
    @Param('gateway') gateway: string,
    @RawCallback() request: CallbackRequest,
  ): Promise<PaymentCallback> {
    if (!(GATEWAY_NAMES as readonly string[]).includes(gateway)) {
      throw new NotFoundException();
    }
    // Returning the callback answers with the acknowledgement the gateway
    // expects.
    return this.webhooks.receive(gateway as GatewayName, request);
  }
}
```

## Service and Worker

```ts
// src/webhooks/webhooks.service.ts
import type { DatabaseSync } from 'node:sqlite';

import {
  Amount,
  type CallbackRequest,
  type PaymentCallback,
  PaymentStatus,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';
import {
  type GatewayName,
  MyanmarPaymentsService,
} from '@laranex/nestjs-myanmar-payments';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DATABASE, now } from '../database.js';

/** Attempts before a stored webhook is left for a manual replay. */
export const MAX_ATTEMPTS = 5;
/**
 * Seconds a worker owns a claimed row; a crashed worker's claim expires after
 * this.
 */
export const LOCK_FOR = 120;
/** Seconds to wait before each retry. */
export const BACKOFF = [10, 60, 300, 900];

interface StoredWebhook {
  id: number;
  gateway: string;
  order_id: string;
  status: string;
  gateway_reference: string | null;
  amount: string | null;
  attempts: number;
}

/**
 * The recommended webhook flow, as app code: verify, store, acknowledge
 * immediately, then process each stored call once in a background worker with
 * retries. The package never stores webhooks; this is the sample from the
 * docs, wired into the playground.
 */
@Injectable()
export class WebhooksService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WebhooksService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseSync,
    private readonly payments: MyanmarPaymentsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifies and stores a callback. Returns the verified callback, whose
   * acknowledgement the controller sends; processing happens in the worker.
   */
  async receive(
    gateway: GatewayName,
    request: CallbackRequest,
  ): Promise<PaymentCallback> {
    const headers = JSON.stringify(request.headers);
    const time = now();

    let callback: PaymentCallback;
    try {
      callback = await this.payments.handleCallback(gateway, request);
    } catch (error) {
      if (!(error instanceof SignatureVerificationError)) {
        throw error;
      }
      // Rejected calls are kept for debugging, never processed.
      this.db
        .prepare(
          `INSERT INTO payment_webhooks
             (gateway, verified, body, headers, last_error, available_at,
              created_at)
           VALUES (?, 0, ?, ?, ?, ?, ?)`,
        )
        .run(gateway, request.body, headers, error.message, time, time);
      this.logger.warn(`[${gateway}] callback rejected: ${error.message}`);
      throw new BadRequestException('invalid signature');
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
          gateway,
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
    } catch (error) {
      // Not stored: answer 500 so the gateway retries later.
      this.logger.error(
        `[${gateway}] could not store callback: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('try again');
    }

    this.logger.log(
      `[${gateway}] callback verified order=${callback.orderId}` +
        ` status=${callback.status} amount=${callback.amount ?? ''}`,
    );
    return callback;
  }

  onApplicationBootstrap(): void {
    const interval = Number(
      this.config.get<string>('WEBHOOK_WORKER_INTERVAL_MS') ?? 2000,
    );
    if (interval > 0) {
      this.start(interval);
    }
  }

  onApplicationShutdown(): void {
    this.stop();
    this.db.close();
  }

  /** Processes stored webhooks every `intervalMs` until `stop()`. */
  start(intervalMs = 2000): void {
    this.stop();
    this.timer = setInterval(() => void this.drain(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Processes every row that is due right now. Returns how many were
   * attempted.
   */
  async drain(): Promise<number> {
    let count = 0;
    while (await this.processNext()) {
      count++;
    }
    return count;
  }

  /**
   * Claims and processes the next due row. Safe to run in several workers or
   * processes: the claim is an UPDATE that only one of them wins.
   */
  async processNext(): Promise<boolean> {
    const time = now();
    const webhook = this.db
      .prepare(
        `SELECT id, gateway, order_id, status, gateway_reference, amount,
                attempts
         FROM payment_webhooks
         WHERE verified = 1 AND processed_at IS NULL AND attempts < ?
           AND available_at <= ?
           AND (locked_until IS NULL OR locked_until < ?)
         ORDER BY id LIMIT 1`,
      )
      .get(MAX_ATTEMPTS, time, time) as StoredWebhook | undefined;
    if (webhook === undefined) {
      return false;
    }

    const claim = this.db
      .prepare(
        `UPDATE payment_webhooks SET locked_until = ?, attempts = attempts + 1
         WHERE id = ? AND processed_at IS NULL
           AND (locked_until IS NULL OR locked_until < ?)`,
      )
      .run(time + LOCK_FOR, webhook.id, time);
    if (claim.changes !== 1) {
      return true; // another worker won the claim
    }

    try {
      this.fulfill(webhook);
    } catch (error) {
      const delay = BACKOFF[Math.min(webhook.attempts, BACKOFF.length - 1)];
      this.db
        .prepare(
          `UPDATE payment_webhooks
           SET last_error = ?, available_at = ?, locked_until = NULL
           WHERE id = ?`,
        )
        .run((error as Error).message, now() + delay, webhook.id);
      const message = (error as Error).message;
      this.logger.warn(
        `[${webhook.gateway}] webhook ${webhook.id} failed: ${message}`,
      );
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

  /**
   * Queues a stored webhook again, e.g. after fixing the cause of its last
   * error.
   */
  replay(id: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE payment_webhooks
         SET attempts = 0, available_at = ?, locked_until = NULL,
             last_error = NULL
         WHERE id = ? AND verified = 1 AND processed_at IS NULL`,
      )
      .run(now(), id);
    return result.changes === 1;
  }

  /**
   * Deletes processed and rejected webhooks older than `days`. Returns how
   * many were removed.
   */
  prune(days = 30): number {
    const before = now() - days * 86400;
    const result = this.db
      .prepare(
        `DELETE FROM payment_webhooks
         WHERE created_at < ? AND (processed_at IS NOT NULL OR verified = 0)`,
      )
      .run(before);
    return Number(result.changes);
  }

  /** Marks the order paid once. Throws to retry later. */
  private fulfill(webhook: StoredWebhook): void {
    if (webhook.status !== PaymentStatus.Successful) {
      return; // record failures, cancellations, ... as your app needs
    }

    const order = this.db
      .prepare('SELECT amount, paid_at FROM orders WHERE number = ?')
      .get(webhook.order_id) as
      { amount: string; paid_at: number | null } | undefined;
    if (order === undefined) {
      throw new Error(`order ${webhook.order_id} not found`);
    }
    if (order.paid_at !== null) {
      return; // already fulfilled by an earlier webhook
    }
    // Yoma MMQR's callback carries no amount; its amount was fixed at checkout.
    if (
      webhook.amount !== null &&
      !Amount.parse(order.amount).equals(webhook.amount)
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
```

- The worker starts with the app (`onApplicationBootstrap`) and runs every `WEBHOOK_WORKER_INTERVAL_MS` (2000 by default; `0` turns it off, for example in tests that call `drain()` themselves).
- The claim is an `UPDATE ... WHERE locked_until IS NULL OR locked_until < now`: when several instances run the worker, only one wins each row, and a crashed worker's claim expires after `LOCK_FOR` seconds.
- `UPDATE orders ... WHERE paid_at IS NULL` keeps fulfillment idempotent even when two webhooks for one order are processed at once.
- A row that fails `MAX_ATTEMPTS` times keeps `last_error` and stays unprocessed until you replay it.

## Wiring It Up

```ts
// src/app.module.ts
import { fileURLToPath } from 'node:url';

import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DATABASE, openDatabase } from './database.js';
import { WebhooksController } from './webhooks/webhooks.controller.js';
import { WebhooksService } from './webhooks/webhooks.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MyanmarPaymentsModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ env: config }),
    }),
  ],
  controllers: [WebhooksController],
  providers: [
    { provide: DATABASE, useFactory: () => openDatabase('payments.sqlite') },
    WebhooksService,
  ],
})
export class AppModule {}
```

Use `https://shop.test/payments/callback/kbz-pay` (and so on for `wave-money`, `aya-pay`, `yoma-mmqr`, `cyber-source`) as each gateway's callback URL, and call `app.enableShutdownHooks()` in `main.ts` so the worker stops cleanly.

## Replay and Prune

After fixing the cause of a failure (a missing order, a bug in your fulfillment), queue the row again; the worker picks it up on its next run:

```ts
webhooks.replay(42); // true when a verified, unprocessed row was found
```

Delete old processed and rejected rows on a schedule, for example with `@nestjs/schedule`; failed rows stay until you replay or delete them:

```ts
@Cron('0 3 * * *')
prune(): void {
  this.webhooks.prune(90);
}
```

## Testing It

Post signed callbacks with supertest and run the worker by hand:

```ts
import request from 'supertest';

import { WebhooksService } from '../src/webhooks/webhooks.service.js';

const app = moduleRef.createNestApplication({ rawBody: true });
await app.init();

const response = await request(app.getHttpServer())
  .post('/payments/callback/kbz-pay')
  .set('Content-Type', 'application/json')
  .send(signedKbzCallback);
expect(response.text).toBe('success');

expect(await app.get(WebhooksService).drain()).toBe(1);
```

See [Testing](/nestjs-myanmar-payments/testing) for building signed callbacks.
