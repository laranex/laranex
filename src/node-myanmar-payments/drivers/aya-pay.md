---
title: AYA Pay
description: Integrate the AYA Payment Gateway in Node.js. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
|---|---|---|
| `await aya.services()` | List the channels enabled for your account | [`AyaPayService[]`](#services-response) |
| `aya.initiate(data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `await aya.status(orderId)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `aya.handleCallback(request)` | Verify the backend callback | [`PaymentCallback`](#handlecallback-response) |
| `aya.verifyRedirect(request)` | Verify the customer's return | [`PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA puts in each result.

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

const aya = new AyaPay({ appKey: '...', appSecret: '...' });

for (const service of await aya.services()) {
  // name "AYA Pay", key "aya_pay" (pass as channel), imageUrl (logo),
  // methods ['QR', 'NOTI']
  console.log(service.name, service.key, service.supports(AyaPayMethod.Qr));
}
```

Methods the gateway lists that this package does not know yet are kept in `service.unknownMethods`.

| `AyaPayMethod` | Value | Customer |
|---|---|---|
| `AyaPayMethod.Web` | `WEB` | Pays on a hosted web page (cards) |
| `AyaPayMethod.Qr` | `QR` | Scans a QR with the wallet app |
| `AyaPayMethod.Noti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```ts
const payment = aya.initiate({
  orderId: `ORDER${orderId}`,
  amount: Amount.kyat(8000),
  channel: 'aya_pay',
  method: AyaPayMethod.Qr,
  returnUrl: 'https://shop.test/payments/aya/return',
});
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(payment.toHtml()); // posts the signed form to AYA on load
```

`initiate()` only signs the fields, so it is synchronous and takes no `signal`. AYA expects the form as `multipart/form-data`; `payment.enctype` carries it if you [render the form yourself](/node-myanmar-payments/payment-flows#form-payments).

### AyaPayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `Amount \| number \| bigint` | Yes | Whole kyat, greater than 0 (AYA documents no decimals). AYA only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | `'WEB'`, `'QR'` or `'NOTI'` |
| `returnUrl` | `string` | No | Absolute http or https URL. Unset uses the URL registered with AYA |
| `description` | `string` | No | Shown to the customer |
| `userRefs` | `string[]` | No | Up to 5 of your own values, echoed back in the callback |

## Handling Callbacks

AYA posts to the callback URL registered with them.

```ts
try {
  const callback = aya.handleCallback(await CallbackRequest.fromNodeRequest(req));
  if (callback.isSuccessful()) {
    // callback.orderId (merchOrderId), callback.gatewayReference (tranId), callback.amount
  }
  callback.acknowledgement.send(res);
} catch (error) {
  res.writeHead(400).end('invalid callback');
}
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```ts
const result = aya.verifyRedirect(await CallbackRequest.fromNodeRequest(req));
res.end(result.isSuccessful() ? 'Thank you, your payment was received.' : `Payment ${result.status}.`);
```

Still fulfill orders from the backend callback.

## Responses

What AYA puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. On error the method throws (the promise rejects); a field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s), while the typed fields such as `amount` keep the exact text AYA sent. Network failures, timeouts and an aborted `signal` throw `ApiError` with the original error as `cause`.

AYA's signed payload carries, in this order and only when they apply: `merchOrderId`, `tranId`, `amount`, `currencyCode` (AYA spells it `currenyCode`), `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1` to `userRef5`, `description`, `dateTime`. Wallet payments leave out the card fields.

### `services()` → `AyaPayService[]` {#services-response}

`AyaPayService` is AYA-only, so it is listed in full here.

| Field / Method | Type | AYA value |
|---|---|---|
| `name` | `string` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | `string` | AYA `key`: pass it as `channel`, e.g. `aya_pay`, `kbz_pay`, `visa`. Always set |
| `imageUrl` | `string \| undefined` | AYA `image_url`, the channel's logo |
| `methods` | `AyaPayMethod[]` | The listed methods this package knows: `WEB`, `QR`, `NOTI` |
| `unknownMethods` | `string[]` | Listed methods this package does not know yet. Empty when there are none |
| `supports(method)` | `boolean` | Whether `methods` contains `method` |

Entries without a `key` are skipped. Errors: `ApiError` (AYA `status` not `00`).

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | AYA value |
|---|---|
| `flow` | `'form'` |
| `orderId` | Your `data.orderId` |
| `action` | `{baseUrl}/v1/payment/request` |
| `fields` | The signed fields below, in signing order |
| `enctype` | `multipart/form-data` |
| `toHtml()` | A page that posts the fields to `action` as `multipart/form-data` on load |

| Form field | Value |
|---|---|
| `merchOrderId` | `data.orderId` |
| `amount` | `data.amount`, whole kyat, e.g. `8000` |
| `appKey` | `config.appKey` |
| `timestamp` | Unix seconds |
| `userRef1` … `userRef5` | `data.userRefs`, `""` when unset |
| `description` | `data.description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | `data.channel` |
| `method` | `data.method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | `data.returnUrl`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`initiate()` makes no HTTP call. Errors: `InvalidPaymentDataError` only.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | AYA value |
|---|---|
| `orderId` | AYA `merchOrderId`, falling back to the `orderId` you passed. Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The verified, decoded enquiry payload (keys above) |

Errors: `ApiError` (AYA `status` not `00`, e.g. `20` Transaction not found), `SignatureVerificationError` (the enquiry's `checkSum` does not match).

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | AYA value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The verified, decoded payload (keys above) |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `SignatureVerificationError` when `payload` is missing or not base64 JSON, or `checkSum` does not match.

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as `handleCallback()`, read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). `acknowledgement` is set but there is nothing to acknowledge: render your return page instead. Errors: `SignatureVerificationError`.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `successful` |
| `01` | `pending` |
| `02` (fail), `03` (reject) | `failed` |
| `04` | `expired` |
| anything else | `unknown` |

## Errors

`services()` and `status()` throw `ApiError` when AYA's `status` is not `00`, e.g. `20` Transaction not found, `09` Duplicate order ID.
