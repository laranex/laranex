---
title: AYA Pay
description: Integrate the AYA Payment Gateway in Node.js. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Call | What it does | Returns |
|---|---|---|
| `await aya.services()` | List the channels enabled for your account | [`AyaPayService[]`](#services-response) |
| `aya.initiate(data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `await aya.status(orderId)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `aya.handleCallback(request)` | Verify the backend callback | [`PaymentCallback`](#handlecallback-response) |
| `aya.verifyRedirect(request)` | Verify the customer's return | [`PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA Pay puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'await aya.services()' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + AyaPayMethod.Qr' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'aya.initiate(data)', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the form and pay', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.handleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: 'aya.verifyRedirect(request)' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```ts
import { AyaPay, AyaPayMethod } from '@laranex/myanmar-payments/aya-pay';

const aya = new AyaPay({
  appKey: '...',
  appSecret: '...',
});

for (const service of await aya.services()) {
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
} from '@laranex/myanmar-payments/aya-pay';

const data: AyaPayPaymentData = {
  orderId: `ORDER_${order.id}`,
  amount: 10000,
  channel: 'aya_pay',
  method: AyaPayMethod.Qr,
  returnUrl: 'https://shop.test/payments/aya/return',
  description: `Order #${order.id}`,
};

const payment = aya.initiate(data);

// The page posts the signed form to AYA on load.
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(payment.toHtml());
```

### AyaPayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `Amount \| number \| bigint` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | `'WEB'`, `'QR'` or `'NOTI'` |
| `returnUrl` | `string` | No | Absolute http or https URL. Unset uses the URL registered with AYA |
| `description` | `string` | No | Shown to the customer |
| `userRefs` | `string[]` | No | Up to 5 of your own values, echoed back in the callback |

### Form Encoding

AYA expects the form as `multipart/form-data`. `payment.enctype` carries it; use it if you [render the form yourself](/node-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

AYA posts to the callback URL registered with them.

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// POST /payments/aya/callback
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = aya.handleCallback(request);

  if (callback.isSuccessful()) {
    // callback.orderId is your merchOrderId
    // callback.gatewayReference is AYA's tranId
  }

  callback.acknowledgement.send(res);
} catch {
  res.writeHead(400).end('invalid callback');
}
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// GET /payments/aya/return
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const result = aya.verifyRedirect(request);

  res.end(
    result.isSuccessful()
      ? 'Thank you, your payment was received.'
      : `Payment ${result.status}.`,
  );
} catch {
  res.writeHead(400).end('invalid return');
}
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. Still fulfill orders from the backend callback.

## Status Checks

```ts
const result = await aya.status(`ORDER_${order.id}`);

if (result.isSuccessful()) {
  // result.gatewayReference is AYA's tranId
}
```

`status()` takes your `orderId`. An order AYA doesn't know throws `ApiError` (`20` Transaction not found).

## Responses

What AYA Pay puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s), while the typed fields such as `amount` keep the exact text AYA sent.

### `services()` → `AyaPayService[]` {#services-response}

`AyaPayService` is AYA-only, so it is listed in full here.

| Field / Method | AYA Pay value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `channel`. Always set |
| `imageUrl` | AYA `image_url`, the channel's logo. `undefined` when AYA sends none |
| `methods` | `AyaPayMethod[]` this package knows, e.g. `[AyaPayMethod.Qr, AyaPayMethod.Noti]` |
| `unknownMethods` | `string[]` of methods AYA listed that this package doesn't know yet. Usually `[]` |
| `supports(method)` | Whether `methods` contains `method` |

Entries AYA sends without a `key` are skipped.

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | AYA Pay value |
|---|---|
| `flow` | `'form'` |
| `orderId` | Your `data.orderId` |
| `action` | `{baseUrl}/v1/payment/request`, e.g. `https://uat-pgw.ayainnovation.com/v1/payment/request` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

| Form field | Value |
|---|---|
| `merchOrderId` | `data.orderId` |
| `amount` | `data.amount`, e.g. `10000` |
| `appKey` | `config.appKey` |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | `data.userRefs`, `""` when unused |
| `description` | `data.description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | `data.channel`, e.g. `aya_pay` |
| `method` | `data.method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | `data.returnUrl`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`initiate()` makes no HTTP call, so it is synchronous and takes no `signal`. `FormPayment` has no `raw`: nothing is sent to AYA until the customer's browser posts the form.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId`, falling back to the `orderId` you passed. Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded payload, with the same keys as `status()` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as [`handleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). There is nothing to acknowledge: render your own page.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `successful` |
| `01` | `pending` |
| `02` (fail), `03` (reject) | `failed` |
| `04` | `expired` |
| anything else | `unknown` |

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `AyaPay.validate(data)` fails. Nothing is signed |
| `services()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00` |
| `status()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00`, e.g. `20` Transaction not found |
| `status()` | `SignatureVerificationError` | The enquiry payload's `checkSum` doesn't match |
| `handleCallback()`, `verifyRedirect()` | `SignatureVerificationError` | `payload` is missing or not base64 JSON, or `checkSum` doesn't match |

The async calls reject with these errors. `ApiError` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `gatewayCode` and its `message` in `gatewayMessage`. When AYA can't be reached, the request times out or the `signal` aborts, the calls throw `ApiError` with the original error as `cause`.
