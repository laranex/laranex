---
title: Usage
description: Start KBZ Pay, Wave Money, AYA Pay, Yoma MMQR and CyberSource payments from NestJS controllers with MyanmarPaymentsService or injected gateways, send form payments through the auto-submit route, and check statuses.
---

# Usage

`MyanmarPaymentsService` hands out the SDK's gateways. Everything a gateway does (payment data, validation, results, errors) is the SDK's; this page shows how it fits into NestJS and links to the SDK pages for the details.

## Getting a Gateway

```ts
import { Controller } from '@nestjs/common';
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly payments: MyanmarPaymentsService) {}
}
```

| Method | Returns |
|---|---|
| `kbzPay()` | [`KbzPay`](/node-myanmar-payments/drivers/kbz-pay) |
| `waveMoney()` | [`WaveMoney`](/node-myanmar-payments/drivers/wave-money) |
| `ayaPay()` | [`AyaPay`](/node-myanmar-payments/drivers/aya-pay) |
| `yomaMmqr()` | [`YomaMmqr`](/node-myanmar-payments/drivers/yoma-mmqr) |
| `cyberSource()` | [`CyberSource`](/node-myanmar-payments/drivers/cyber-source) |
| `gateway(name)` | The gateway for `'kbz-pay'`, `'wave-money'`, `'aya-pay'`, `'yoma-mmqr'` or `'cyber-source'` (`GATEWAY_NAMES`) |

Each gateway is built on first use and reused, so Yoma's access token and the HTTP settings are shared. To inject a single gateway, use its decorator:

```ts
import { KbzPay } from '@laranex/myanmar-payments';
import { InjectKbzPay } from '@laranex/nestjs-myanmar-payments';
import { Injectable } from '@nestjs/common';

@Injectable()
export class KbzCheckout {
  constructor(@InjectKbzPay() private readonly kbz: KbzPay) {}
}
```

`@InjectWaveMoney()`, `@InjectAyaPay()`, `@InjectYomaMmqr()` and `@InjectCyberSource()` work the same way. The injected object builds the gateway on first use too, so an unconfigured gateway doesn't stop the app from starting.

## Amounts

Amounts are exact: `Amount.kyat(10000)`, `Amount.parse('10000.50')` or a whole-number `number`/`bigint`. Floats are rejected, and decimals are accepted only where the gateway allows them (KBZ Pay up to 2 places, CyberSource). See [Amounts](/node-myanmar-payments/amounts).

## Redirect Payments (KBZ Pay PWA, Wave Money)

```ts
import { Amount } from '@laranex/myanmar-payments';
import { Get, Redirect } from '@nestjs/common';

@Get('kbz-pay')
@Redirect()
async kbzPay(): Promise<{ url: string }> {
  const data = {
    orderId: `ORDER_${order.id}`,
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/callback/kbz-pay',
  };
  const payment = await this.payments.kbzPay().pwa(data);
  return { url: payment.url };
}
```

`waveMoney().initiate(data)` also returns a `RedirectPayment`; Wave fills `data.merchantReferenceId` when it is empty, so store it with the order. See [Redirect payments](/node-myanmar-payments/payment-flows#redirect-payments).

## QR and App Payments

```ts
import {
  Amount,
  type AppPayment,
  type QrPayment,
} from '@laranex/myanmar-payments';
import { Get } from '@nestjs/common';

@Get('kbz-pay/qr')
async qr(): Promise<QrPayment> {
  const data = {
    orderId: `ORDER_${order.id}`,
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/callback/kbz-pay',
  };
  return this.payments.kbzPay().qr(data);
}

@Get('kbz-pay/app')
async app(): Promise<AppPayment> {
  const data = {
    orderId: `ORDER_${order.id}`,
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/callback/kbz-pay',
  };
  return this.payments.kbzPay().app(data);
}
```

Returning the result serializes it as JSON. `yomaMmqr().initiate(data)` returns a `QrPayment` with `qrImageDataUri()`, `expiresAt` and `reference`; renew an expired QR with `renewQr(orderId)`. See [QR payments](/node-myanmar-payments/payment-flows#qr-payments) and [App payments](/node-myanmar-payments/payment-flows#app-payments).

## Form Payments (AYA Pay and CyberSource)

`ayaPay().initiate(data)` and `cyberSource().initiate(data)` sign a form the customer's browser must POST to the gateway. They make no network call. Either send the SDK's auto-submitting page yourself:

```ts
import { Amount } from '@laranex/myanmar-payments';
import { Get, Header } from '@nestjs/common';

@Get('cyber-source')
@Header('Content-Type', 'text/html; charset=utf-8')
cyberSource(): string {
  const data = {
    orderId: `ORDER_${order.id}`,
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/callback/cyber-source',
  };
  return this.payments.cyberSource().initiate(data).toHtml();
}
```

or redirect to the module's form route, which is handy when the payment is started from an API call or a mobile app:

```ts
import { Amount } from '@laranex/myanmar-payments';
import { Get, Redirect } from '@nestjs/common';

@Get('cyber-source')
@Redirect()
cyberSource(): { url: string } {
  const data = {
    orderId: `ORDER_${order.id}`,
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/callback/cyber-source',
  };
  const payment = this.payments.cyberSource().initiate(data);
  return { url: this.payments.autoSubmitUrl(payment) };
}
```

`autoSubmitUrl(form)` returns `https://shop.test/myanmar-payments/form?payload=…`. The payload is the form encrypted with AES-256-GCM, so the signed fields can't be read or changed, and it expires after `formLink.ttlMinutes` (30 by default). The route answers `410 Gone` to a tampered or expired link, and sends the page with `Cache-Control: no-store`. `resolveFormPayment(payload)` decrypts a payload yourself, returning `undefined` when it is invalid. See [Configuration](/nestjs-myanmar-payments/configuration#auto-submit-form-route).

AYA needs a channel: list the merchant's channels with `await this.payments.ayaPay().services()`, then pass `channel` and `method` (`AyaPayMethod`) to `initiate()`. See [Form payments](/node-myanmar-payments/payment-flows#form-payments).

## Status Checks

```ts
const result = await this.payments.kbzPay().status(`ORDER_${order.id}`);
if (result.isSuccessful()) {
  // paid
}
```

`kbzPay().status(orderId)`, `ayaPay().status(orderId)` and `yomaMmqr().status(reference)` return a `PaymentStatusResult`. Wave Money and CyberSource have no status API. See [Status checks](/node-myanmar-payments/callbacks#status-checks).

## Errors

The SDK throws `InvalidPaymentDataError` (with `errors` per field) before any request for invalid data, `ApiError` (`gatewayCode`, `gatewayMessage`, `httpStatus`) for gateway failures, and `ConfigurationError` for missing credentials. All of them extend `PaymentError`, so one exception filter can answer them:

```ts
import {
  ApiError,
  InvalidPaymentDataError,
  PaymentError,
} from '@laranex/myanmar-payments';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch(PaymentError)
export class PaymentErrorsFilter implements ExceptionFilter {
  catch(error: PaymentError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const status =
      error instanceof InvalidPaymentDataError
        ? 422
        : error instanceof ApiError
          ? 502
          : 500;
    response.status(status).json({ error: error.message });
  }
}
```

(`response.status(...).json(...)` is Express; on Fastify use `response.code(...).send(...)`.) See [Errors](/node-myanmar-payments/references/errors).

Next: [Callbacks](/nestjs-myanmar-payments/callbacks).
