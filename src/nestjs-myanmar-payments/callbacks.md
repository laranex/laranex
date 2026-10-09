---
title: Callbacks
description: Verify KBZ Pay, Wave Money, AYA Pay, Yoma MMQR and CyberSource callbacks in NestJS on Express or Fastify with @VerifiedCallback and @AcknowledgeCallback, or by hand with @RawCallback, handleCallback and acknowledge.
---

# Callbacks

Gateways report payment results to your server. The package turns the Nest request into the SDK's `CallbackRequest`, verifies it with the gateway's `handleCallback()` and answers with the acknowledgement the gateway expects. For production, store the verified call and process it in the background: see [Handling webhooks](/nestjs-myanmar-payments/webhooks).

Create the app with `rawBody: true` (see [Installation](/nestjs-myanmar-payments/installation#keep-the-raw-body)) so signatures are checked against the exact bytes the gateway sent.

## Verified Callbacks

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';
import { AcknowledgeCallback, VerifiedCallback } from '@laranex/nestjs-myanmar-payments';
import { Controller, Post } from '@nestjs/common';

@Controller('payments/callback')
export class CallbackController {
  @Post('kbz-pay')
  @AcknowledgeCallback()
  kbzPay(@VerifiedCallback('kbz-pay') callback: PaymentCallback): PaymentCallback {
    if (callback.isSuccessful()) {
      // compare callback.amount with the order, then fulfill callback.orderId once
    }
    return callback;
  }
}
```

- `@VerifiedCallback(gateway)` reads the request, verifies it with the named gateway (`'kbz-pay'`, `'wave-money'`, `'aya-pay'`, `'yoma-mmqr'`, `'cyber-source'`) and injects the SDK's [`PaymentCallback`](/node-myanmar-payments/references/payment-callback). A bad signature answers `400 Bad Request` before your handler runs; a missing credential answers 500.
- `@AcknowledgeCallback()` sets status 200 and, when the handler returns the `PaymentCallback`, sends its `acknowledgement`: KBZ Pay's plain `success`, an empty `text/plain` body for the others. Any other return value passes through unchanged.

Both work the same on the Express and the Fastify adapter.

## By Hand

When you need the request before verifying it (to store rejected calls, for example), take the raw `CallbackRequest` and verify it yourself:

```ts
import { CallbackRequest, SignatureVerificationError } from '@laranex/myanmar-payments';
import { AcknowledgeCallback, type GatewayName, RawCallback } from '@laranex/nestjs-myanmar-payments';
import { BadRequestException, Param, Post } from '@nestjs/common';

// In a controller whose constructor takes `private readonly payments: MyanmarPaymentsService`:

@Post(':gateway')
@AcknowledgeCallback()
async receive(@Param('gateway') gateway: GatewayName, @RawCallback() request: CallbackRequest) {
  try {
    return await this.payments.handleCallback(gateway, request);
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      throw new BadRequestException('invalid signature');
    }
    throw error;
  }
}
```

| API | What it does |
|---|---|
| `@RawCallback()` | Injects the unverified `CallbackRequest` (body, headers, query) |
| `service.handleCallback(gateway, request)` | Verifies a `CallbackRequest` or a Nest request; throws `SignatureVerificationError` |
| `callbackRequestFrom(req)` | Builds a `CallbackRequest` from an Express or Fastify request (`@Req()`) |
| `acknowledge(res, callback)` | Sends the acknowledgement on an Express response or a Fastify reply (`@Res()`); without a callback, an empty 200 |

```ts
import { acknowledge, type FastifyReplyLike, type NestRequestLike } from '@laranex/nestjs-myanmar-payments';
import { Post, Req, Res } from '@nestjs/common';

@Post('wave-money')
async wave(@Req() req: NestRequestLike, @Res() res: FastifyReplyLike): Promise<void> {
  const callback = await this.payments.handleCallback('wave-money', req);
  // ...
  acknowledge(res, callback);
}
```

## Where the Body Comes From

`callbackRequestFrom()` (used by every helper) reads, in order:

1. the exact bytes Nest kept with `rawBody: true`;
2. the request stream, when no body parser read it (Express, unknown content types);
3. the parsed body, encoded again as JSON or as a form.

The query string comes from the full URL, global prefix included.

## AYA's Browser Return

AYA also sends the customer back to your `returnUrl` with a signed query string. Verify it to show the right page, but fulfill orders only from the server callback:

```ts
@Get('payments/aya-pay/done')
async done(@Req() req: NestRequestLike): Promise<PaymentCallback> {
  return this.payments.ayaPay().verifyRedirect(await callbackRequestFrom(req));
}
```

## Rules

- Keep callback routes free of authentication guards, CSRF checks and body-rewriting middleware; gateways have no session.
- Fulfill only from a verified callback or a status check, never from return pages.
- Compare `callback.amount` with your order (Yoma MMQR sends no amount; its amount was fixed at checkout).
- Gateways retry: handle the same callback more than once.

See the SDK's [Callbacks & Status](/node-myanmar-payments/callbacks) for each gateway's fields and statuses.
