---
title: Wave Pay
description: Integrate Wave Pay with NestJS Myanmar Payments. Redirect payments with typed line items and verified callbacks.
---

# Wave Pay

Wave Pay (Pay with Wave API v1.3) sends the customer to Wave's payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `wavePay().initiate(data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wavePay().handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Pay has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what Wave Pay puts in each result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Pay: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Pay', label: 'Payment request with hash', detail: 'wavePay().initiate(data)' },
    { from: 'Wave Pay', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Pay', label: 'Pay with WavePay' },
    { from: 'Wave Pay', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wavePay().handleCallback(request)' },
  ]"
/>

## Initiating a Payment

```ts
import type { WavePayPaymentData } from '@laranex/myanmar-payments';
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';
import { Controller, Param, Post, Redirect } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';

@Controller('checkout')
export class WavePayCheckoutController {
  constructor(
    private readonly payments: MyanmarPaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Post(':id/wave-pay')
  @Redirect()
  async initiate(@Param('id') id: string): Promise<{ url: string }> {
    const order = await this.orders.findOrFail(id);

    const data: WavePayPaymentData = {
      orderId: `ORDER_${order.id}`,
      callbackUrl: 'https://shop.test/payments/wave/callback',
      returnUrl: `https://shop.test/orders/${order.id}`,
      description: `Order #${order.id}`,
      items: [
        { name: 'Product A', amount: 6000 },
        { name: 'Product B', amount: 4000 },
      ],
    };

    const payment = await this.payments.wavePay().initiate(data);

    await this.orders.update(order, {
      waveReference: data.merchantReferenceId,
    });

    return { url: payment.url };
  }
}
```

`initiate()` posts JSON, in MMK, to `{baseUrl}/payment` and sends the customer to `{baseRedirectUrl}/authenticate`; see [Endpoints](/nestjs-myanmar-payments/configuration#endpoints).

### WavePayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID, at most 100 characters: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to, at most 255 characters. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to, at most 255 characters. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer, at most 255 characters |
| `items` | `readonly WavePayItem[]` | Yes | At least one item |
| `amount` | `AmountInput` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `string` | No | Unique ID of this attempt, at most 100 characters: letters, digits, `_` and `-` only. Unset or empty means a random ID |
| `merchantName` | `string` | No | Business name shown on Wave's page for this payment. Unset or `null` uses `WAVE_PAY_MERCHANT_NAME` (`wavePay.merchantName`); a blank one is rejected |
| `timeToLiveSeconds` | `number` | No | Seconds the customer has to pay this payment, a whole number greater than 0. Unset or `null` uses `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS` (`wavePay.timeToLiveSeconds`) |
| `additionalField3`, `additionalField4`, `additionalField5` | `string` | No | Extra information, at most 50 characters each, sent as `additional_field_3`–`5` and echoed in the callback's `additionalField3`–`5`. Unset, `null` or empty is not sent |

Length limits count UTF-8 bytes. `WavePayItem` takes a `name` and an `amount` (`AmountInput`) in whole kyat, greater than 0. The items are summed with exact integer arithmetic, never floats.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: it identifies the attempt, and the callback carries it as `merchantReferenceId`. `initiate()` fills it in, so read it from `data.merchantReferenceId` afterwards.

## Handling Callbacks

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  VerifiedCallback,
} from '@laranex/nestjs-myanmar-payments';
import { Controller, Post } from '@nestjs/common';

@Controller('payments')
export class WavePayCallbackController {
  @Post('wave/callback')
  @AcknowledgeCallback()
  handle(
    @VerifiedCallback('wave-pay') callback: PaymentCallback,
  ): PaymentCallback {
    if (callback.isSuccessful()) {
      // callback.orderId is your orderId
      // callback.raw.merchantReferenceId is the attempt's reference
      // callback.gatewayReference is Wave's transactionId
    }

    return callback;
  }
}
```

`callback.orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave Pay puts in each property. See [Results](/nestjs-myanmar-payments/references/results) and [PaymentCallback & Status](/nestjs-myanmar-payments/references/payment-callback) for the full classes. `raw` holds plain JavaScript values, with JSON numbers kept as their exact text in a `string` (`1000.50` stays `'1000.50'`).

### `initiate()` → `RedirectPayment` {#initiate-response}

| Property | Wave Pay value |
|---|---|
| `flow` | `redirect` |
| `orderId` | Your `orderId` |
| `url` | `{baseRedirectUrl}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Wave Pay value |
|---|---|
| `orderId` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `10000` |
| `raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `Successful` |
| `BILL_COLLECTION_FAILED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_LOCKED` | `Failed` |
| `PAYMENT_REQUEST_CANCELLED` | `Canceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `Expired` |
| anything else | `Unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | A value breaks the rules above. Nothing is sent |
| `initiate()` | `ApiError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationError` | `hashValue` doesn't match, a hashed field holds an object or array, `amount` isn't a decimal, both `orderId` and `merchantReferenceId` are missing or empty, or either holds anything but letters, digits, `_` and `-` |

`httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached, `initiate()` throws `ApiError` with `httpStatus` `0`.
