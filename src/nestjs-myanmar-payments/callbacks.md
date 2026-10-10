---
title: Callbacks & Status
description: Verify gateway callbacks with @VerifiedCallback() or handleCallback(), read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `@VerifiedCallback()` verifies the gateway's signature with the gateway's `handleCallback()` and injects a `PaymentCallback`. Create the app with [`rawBody: true`](/nestjs-myanmar-payments/installation#keep-the-raw-body): signatures are checked against the exact body the gateway sent.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/nestjs-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'kbzPay().handleCallback()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationError', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by callback.orderId' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: '@AcknowledgeCallback()', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```ts
import { Amount, PaymentCallback } from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  VerifiedCallback,
} from '@laranex/nestjs-myanmar-payments';
import { Controller, Post } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly orders: OrdersService) {}

  @Post('kbz/callback')
  @AcknowledgeCallback()
  async kbzCallback(
    @VerifiedCallback('kbz-pay') callback: PaymentCallback,
  ): Promise<PaymentCallback> {
    const order = await this.orders.findByReference(callback.orderId);

    // order.amount is a string such as "10000"; compare by value, not floats
    const paid = Amount.parse(order.amount).equals(callback.amount);

    if (callback.isSuccessful() && !order.paidAt && paid) {
      await this.orders.markAsPaid(order, callback.gatewayReference);
    }

    return callback;
  }
}
```

Gateways post from their own servers, so keep callback routes free of authentication guards and CSRF checks.

## Callback Helpers

| API | What it does |
|---|---|
| `@VerifiedCallback(gateway)` | Reads the request, verifies it with the named gateway (`'kbz-pay'`, `'wave-money'`, `'aya-pay'`, `'yoma-mmqr'`, `'cyber-source'`) and injects the `PaymentCallback`. A bad signature answers `400 Bad Request` before your handler runs; a missing credential answers `500` |
| `@AcknowledgeCallback()` | When the handler returns the `PaymentCallback`, answers with its `acknowledgement` (status, headers and body): KBZ Pay's plain `success`, an empty `text/plain` 200 for the others. Any other return value passes through with status 200 |
| `@RawCallback()` | Injects the unverified `CallbackRequest` (body, headers, query), e.g. to store it before verifying it yourself |
| `this.payments.handleCallback(gateway, request)` | Verifies a `CallbackRequest` or a Nest request with the named gateway; throws `SignatureVerificationError` |
| `this.payments.gateway(gateway)` | The gateway for a name, e.g. `gateway('kbz-pay')` is `kbzPay()` (`GATEWAY_NAMES` lists them) |
| `callbackRequestFrom(req)` | Builds a `CallbackRequest` from an Express or Fastify request (`@Req()`), e.g. for `ayaPay().verifyRedirect()` |
| `acknowledge(res, callback)` | Sends the acknowledgement on an Express response or a Fastify reply (`@Res()`); without a callback, an empty 200 |

When you need the request before verifying it (to store rejected calls, for example), take the raw `CallbackRequest` and verify it by gateway name:

```ts
import {
  CallbackRequest,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  type GatewayName,
  MyanmarPaymentsService,
  RawCallback,
} from '@laranex/nestjs-myanmar-payments';
import {
  BadRequestException,
  Controller,
  Param,
  Post,
} from '@nestjs/common';

@Controller('payments')
export class GatewayCallbackController {
  constructor(private readonly payments: MyanmarPaymentsService) {}

  @Post(':gateway/callback')
  @AcknowledgeCallback()
  async receive(
    @Param('gateway') gateway: GatewayName,
    @RawCallback() request: CallbackRequest,
  ) {
    try {
      return await this.payments.handleCallback(gateway, request);
    } catch (error) {
      if (error instanceof SignatureVerificationError) {
        throw new BadRequestException('invalid signature');
      }
      throw error;
    }
  }
}
```

With `@Req()` and `@Res()`, verify and acknowledge by hand; this works on Express and Fastify alike:

```ts
import {
  acknowledge,
  type FastifyReplyLike,
  type NestRequestLike,
} from '@laranex/nestjs-myanmar-payments';
import { Post, Req, Res } from '@nestjs/common';

@Post('wave/callback')
async waveCallback(
  @Req() req: NestRequestLike,
  @Res() res: FastifyReplyLike,
): Promise<void> {
  const callback = await this.payments.handleCallback('wave-money', req);
  // ...
  acknowledge(res, callback);
}
```

`callbackRequestFrom()`, which every helper uses, reads the body from, in order: the exact bytes Nest kept with `rawBody: true`; the request stream, when no body parser read it (Express, unknown content types); the parsed body, encoded again as JSON or as a form. The `CallbackRequest` keeps the exact bytes in `rawBody` and the same body as text in `body`. The query string comes from the full URL, global prefix included. AYA's browser return is verified with `ayaPay().verifyRedirect()`, see [AYA Pay](/nestjs-myanmar-payments/drivers/aya-pay#the-return-page). A body is read as JSON only when it is a single JSON object; any other body is read as a urlencoded form.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationError`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; it carries the unverified data in `error.raw` for logging only.
- **Check the amount.** Compare `callback.amount` (as the gateway sent it, a string) with your order before fulfilling. A gateway may format it differently from your order (`10000` or `10000.00`); `Amount.parse(order.amount).equals(callback.amount)` compares decimal strings exactly.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** Returning the callback from an `@AcknowledgeCallback()` handler (or `acknowledge(res, callback)`) sends the response the gateway expects, e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## PaymentStatus

Every gateway's own status values are mapped onto one set of statuses. The original value stays in `callback.gatewayStatus`.

| Value | Meaning |
|---|---|
| `PaymentStatus.Successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus.Pending` | Still in progress or waiting on the customer. |
| `PaymentStatus.Failed` | Attempted and failed or rejected. |
| `PaymentStatus.Canceled` | Canceled or closed before completing. |
| `PaymentStatus.Expired` | The payment window ran out. |
| `PaymentStatus.Unknown` | A status this package does not recognize yet. Inspect `gatewayStatus`. |

`PaymentStatus.isFinal(status)` is `false` for `Pending` and `Unknown`. Unknown statuses never throw.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: 'kbzPay().status(orderId)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: 'PaymentStatus.isFinal(result.status)' },
  ]"
/>

When a callback is late or missing, ask the gateway directly. Status checks return a `PaymentStatusResult` with the same `status`, `gatewayStatus`, `gatewayReference` and `amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `this.payments.kbzPay().status(orderId)` |
| AYA Payment Gateway | `this.payments.ayaPay().status(orderId)` |
| Yoma MMQR | `this.payments.yomaMmqr().status(payment.reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```ts
const result = await this.payments.kbzPay().status(`ORDER_${order.id}`);

if (result.isSuccessful()) {
  // ...
}
```

See [PaymentCallback & Status](/nestjs-myanmar-payments/references/payment-callback) for every property.
