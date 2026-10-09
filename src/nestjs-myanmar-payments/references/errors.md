---
title: Errors
description: Every error thrown by NestJS Myanmar Payments extends PaymentError. Reference for validation, API, signature and configuration errors.
---

# Errors

Every error extends `PaymentError` from `@laranex/myanmar-payments`, so one `catch` (or one exception filter) covers the package.

| Error | Thrown when |
|---|---|
| `InvalidPaymentDataError` | A payment is started with values the gateway would reject |
| `ApiError` | A gateway rejects a request, answers with an error (including errors sent with HTTP 200), or cannot be reached |
| `SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `ConfigurationError` | A gateway is used without a credential it needs |

## InvalidPaymentDataError

```ts
import { InvalidPaymentDataError } from '@laranex/myanmar-payments';

try {
  await this.payments.kbzPay().pwa({
    orderId: 'ORDER-1',
    amount: 0,
    callbackUrl: 'https://shop.test/cb',
  });
} catch (error) {
  if (error instanceof InvalidPaymentDataError) {
    error.errors;
    // { orderId: 'The orderId field may only contain ...',
    //   amount: 'The amount field must be greater than 0.' }
  }
}
```

## ApiError

| Property | Type | Description |
|---|---|---|
| `gatewayCode` | `string \| undefined` | The gateway's error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gatewayMessage` | `string \| undefined` | The gateway's error message |
| `httpStatus` | `number` | HTTP status of the response, `0` when no response was received |
| `raw` | `Readonly<Record<string, unknown>>` | The decoded response body |

## SignatureVerificationError

`raw` holds the unverified payload. Log it, never act on it. `@VerifiedCallback()` turns it into `400 Bad Request`.

## ConfigurationError

The message names the gateway and the missing key, e.g. `The wave_money configuration is missing [merchant_id].` `gateway` and `key` hold both. `autoSubmitUrl()` throws it with `myanmar_payments` and `formLink.secret` when no form link secret is set.

## Exception Filter

All of them extend `PaymentError`, so one exception filter can answer them:

```ts
import {
  ApiError,
  InvalidPaymentDataError,
  PaymentError,
} from '@laranex/myanmar-payments';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch(PaymentError)
export class PaymentErrorsFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: PaymentError, host: ArgumentsHost): void {
    const status =
      error instanceof InvalidPaymentDataError
        ? 422
        : error instanceof ApiError
          ? 502
          : 500;
    const response = host.switchToHttp().getResponse();
    this.adapterHost.httpAdapter.reply(
      response,
      { error: error.message },
      status,
    );
  }
}
```

`httpAdapter.reply()` works on Express and Fastify alike.
