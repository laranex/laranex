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
import {
  AyaPay,
  AyaPayConfig,
  AyaPayMethod,
} from '@laranex/myanmar-payments/aya-pay';

const aya = new AyaPay({
  appKey: '...',
  appSecret: '...',
  baseUrl: AyaPayConfig.PRODUCTION_URL,
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

Methods AYA lists that this package doesn't know yet are kept in `service.unknownMethods`; `data` and each service's `methods` are read only when they are JSON lists, and method entries that aren't text, numbers or booleans are skipped.

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
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`), no `:` |
| `amount` | `Amount \| number \| bigint` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | `'WEB'`, `'QR'` or `'NOTI'` |
| `returnUrl` | `string` | No | Absolute http or https URL. Unset uses the URL registered with AYA |
| `description` | `string` | No | Shown to the customer, no `:` |
| `userRefs` | `string[]` | No | Up to 5 of your own values, echoed back in the callback, none containing `:` (`The userRefs field must not contain ":".`) |

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

Because AYA joins the signed values with `:`, a matching `checkSum` alone could let a value be re-split into other fields. A payload is therefore only accepted when, besides the checksum:

- no signed value contains `:`, except `dateTime`, which must have the form `YYYY-MM-DD HH:MM:SS`;
- `merchOrderId` and `tranId` are present;
- `amount` is a decimal, e.g. `10000` or `10000.00`;
- the currency code is `104` (MMK);
- `statusCode` is exactly two digits.

A bad payload or `checkSum` throws `SignatureVerificationError` with `AYA Pay callback checksum verification failed.`; a payload whose checksum matched but breaks a rule above throws it with `AYA Pay callback payload is malformed.` (`redirect` or `enquiry response` instead of `callback` for the return page and `status()`, which get the same checks).

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

Still fulfill orders from the backend callback.

## Status Checks

```ts
const result = await aya.status(`ORDER_${order.id}`);

if (result.isSuccessful()) {
  // result.gatewayReference is AYA's tranId
}
```

`status()` takes your `orderId`. An order AYA doesn't know throws `ApiError` (`20` Transaction not found).

## Responses

See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes.

### `services()` → `AyaPayService[]` {#services-response}

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
| `action` | `{baseUrl}/v1/payment/request`, e.g. `https://pgw.ayainnovation.com/v1/payment/request` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `toHtml(nonce?)` | A full HTML page that posts `fields` to `action` on load; `nonce` is added to its inline script |

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

### `status()` → `PaymentStatusResult` {#status-response}

| Field | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId`. Always set: an enquiry payload without it fails verification |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode` as sent, always two digits, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode` as sent, always two digits, e.g. `00` |
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
| `status()` | `SignatureVerificationError` | The enquiry payload's `checkSum` doesn't match, or the payload is malformed (see [Handling Callbacks](#handling-callbacks)) |
| `handleCallback()`, `verifyRedirect()` | `SignatureVerificationError` | `payload` is missing or not base64 JSON, a signed field is nested, `checkSum` doesn't match, or a rule in [Handling Callbacks](#handling-callbacks) fails |

`ApiError` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `gatewayCode` and its `message` in `gatewayMessage`.
