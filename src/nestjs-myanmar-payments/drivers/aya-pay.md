---
title: AYA Pay
description: Integrate the AYA Payment Gateway with NestJS Myanmar Payments. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Call | What it does | Returns |
|---|---|---|
| `ayaPay().services()` | List the channels enabled for your account | [`AyaPayService[]`](#services-response) |
| `ayaPay().initiate(data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `ayaPay().status(orderId)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `ayaPay().handleCallback(request)` | Verify the backend callback | [`PaymentCallback`](#handlecallback-response) |
| `ayaPay().verifyRedirect(request)` | Verify the customer's return | [`PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA Pay puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'ayaPay().services()' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + AyaPayMethod.Qr' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'ayaPay().initiate(data)', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the form and pay', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'ayaPay().handleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: 'ayaPay().verifyRedirect(request)' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```ts
import { AyaPayMethod } from '@laranex/myanmar-payments';

for (const service of await this.payments.ayaPay().services()) {
  // service.name: "AYA Pay"
  // service.key: "aya_pay", pass it as channel
  // service.imageUrl: the channel's logo
  // service.methods: [AyaPayMethod.Qr, AyaPayMethod.Noti]
  if (service.supports(AyaPayMethod.Qr)) {
    // offer the QR method
  }
}
```

Methods AYA lists that this package doesn't know yet are kept in `service.unknownMethods`.

| `AyaPayMethod` | Value | Customer |
|---|---|---|
| `AyaPayMethod.Web` | `WEB` | Pays on a hosted web page (cards) |
| `AyaPayMethod.Qr` | `QR` | Scans a QR with the wallet app |
| `AyaPayMethod.Noti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```ts
import {
  AyaPayMethod,
  type AyaPayPaymentData,
} from '@laranex/myanmar-payments';
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';
import { Controller, Param, Post, Redirect } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';

@Controller('checkout')
export class AyaPayCheckoutController {
  constructor(
    private readonly payments: MyanmarPaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Post(':id/aya-pay')
  @Redirect()
  async initiate(@Param('id') id: string): Promise<{ url: string }> {
    const order = await this.orders.findOrFail(id);

    const data: AyaPayPaymentData = {
      orderId: `ORDER_${order.id}`,
      amount: 10000,
      channel: 'aya_pay',
      method: AyaPayMethod.Qr,
      returnUrl: 'https://shop.test/payments/aya/return',
      description: `Order #${order.id}`,
    };

    const payment = this.payments.ayaPay().initiate(data);

    return { url: this.payments.autoSubmitUrl(payment) };
  }
}
```

### AyaPayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `AmountInput` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | A method the channel supports |
| `returnUrl` | `string` | No | Absolute http or https URL. Unset uses the URL registered with AYA |
| `description` | `string` | No | Shown to the customer |
| `userRefs` | `readonly string[]` | No | Up to 5 of your own values, echoed back in the callback |

### Form Encoding

AYA expects the form as `multipart/form-data`. `payment.enctype` carries it; use it if you [render the form yourself](/nestjs-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

AYA posts to the callback URL registered with them.

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  VerifiedCallback,
} from '@laranex/nestjs-myanmar-payments';
import { Controller, Post } from '@nestjs/common';

@Controller('payments')
export class AyaPayCallbackController {
  @Post('aya/callback')
  @AcknowledgeCallback()
  handle(
    @VerifiedCallback('aya-pay') callback: PaymentCallback,
  ): PaymentCallback {
    if (callback.isSuccessful()) {
      // callback.orderId is your merchOrderId
      // callback.gatewayReference is AYA's tranId
    }

    return callback;
  }
}
```

A bad signature answers `400` before the handler runs. AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```ts
import { SignatureVerificationError } from '@laranex/myanmar-payments';
import {
  callbackRequestFrom,
  MyanmarPaymentsService,
  type NestRequestLike,
} from '@laranex/nestjs-myanmar-payments';
import {
  BadRequestException,
  Controller,
  Get,
  Render,
  Req,
} from '@nestjs/common';

@Controller('payments')
export class AyaPayReturnController {
  constructor(private readonly payments: MyanmarPaymentsService) {}

  @Get('aya/return')
  @Render('payments/result')
  async show(@Req() req: NestRequestLike): Promise<{ status: string }> {
    const request = await callbackRequestFrom(req);

    try {
      const result = this.payments.ayaPay().verifyRedirect(request);

      return { status: result.status };
    } catch (error) {
      if (error instanceof SignatureVerificationError) {
        throw new BadRequestException();
      }
      throw error;
    }
  }
}
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. Still fulfill orders from the backend callback.

## Status Checks

```ts
const result = await this.payments.ayaPay().status(`ORDER_${order.id}`);

if (result.isSuccessful()) {
  // result.gatewayReference is AYA's tranId
}
```

`status()` takes your `orderId`. An order AYA doesn't know throws `ApiError` (`20` Transaction not found).

## Responses

What AYA Pay puts in each property. See [Results](/nestjs-myanmar-payments/references/results) and [PaymentCallback & Status](/nestjs-myanmar-payments/references/payment-callback) for the full classes.

### `services()` → `AyaPayService[]` {#services-response}

`AyaPayService` is AYA-only, so it is listed in full here.

| Property / Method | AYA Pay value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `channel`. Always set |
| `imageUrl` | AYA `image_url`, the channel's logo. `undefined` when AYA sends none |
| `methods` | `readonly AyaPayMethod[]` this package knows, e.g. `['QR', 'NOTI']` |
| `unknownMethods` | `readonly string[]` of methods AYA listed that this package doesn't know yet. Usually `[]` |
| `supports(method)` | Whether `methods` contains `method` |

Entries AYA sends without a `key` are skipped.

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{baseUrl}/v1/payment/request`, e.g. `https://uat-pgw.ayainnovation.com/v1/payment/request` |
| `fields` | The signed fields below. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

`this.payments.autoSubmitUrl(payment)` returns an encrypted link to the module's form route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. It expires after `formLink.ttlMinutes` (30); the call throws when `formRoute.enabled` is `false`.

`fields`, in the order AYA signs them:

| Form field | Value |
|---|---|
| `merchOrderId` | Your `orderId` |
| `amount` | Your `amount`, e.g. `10000` |
| `appKey` | Your configured app key |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | Your `userRefs`, `""` when unused |
| `description` | Your `description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | Your `channel`, e.g. `aya_pay` |
| `method` | Your `method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | Your `returnUrl`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`initiate()` makes no HTTP call. `FormPayment` has no `raw`: nothing is sent to AYA until the customer's browser posts the form.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId`, falling back to the `orderId` you passed. Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded payload, with the same keys as `status()` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`@AcknowledgeCallback()` (or `acknowledge(res, callback)`) sends `acknowledgement`.

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as [`handleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). There is nothing to acknowledge: return your own page.

`handleCallback()` and `verifyRedirect()` take a `CallbackRequest`; build one from a Nest request with `callbackRequestFrom(req)`, or call `this.payments.handleCallback('aya-pay', req)`.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `Successful` |
| `01` | `Pending` |
| `02` (fail), `03` (reject) | `Failed` |
| `04` | `Expired` |
| anything else | `Unknown` |

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed |
| `services()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00` |
| `status()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00`, e.g. `20` Transaction not found |
| `status()` | `SignatureVerificationError` | The enquiry payload's `checkSum` doesn't match |
| `handleCallback()`, `verifyRedirect()` | `SignatureVerificationError` | `payload` is missing or not base64 JSON, or `checkSum` doesn't match |

`ApiError` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `gatewayCode` and its `message` in `gatewayMessage`. When AYA can't be reached, the calls throw `ApiError` with `httpStatus` `0`.
