---
title: KBZ Pay
description: Integrate KBZ Pay in Node.js. PWA redirect, QR and in-app payments from one KbzPayPaymentData, plus status checks and verified callbacks.
---

# KBZ Pay

KBZ Pay is KBZ Bank's mobile wallet: customers pay in the KBZ Pay PWA, by scanning a QR code, or from your mobile app.

| Call | What it does | Returns |
|---|---|---|
| `await kbz.pwa(data)` | Redirect to the KBZ Pay PWA | [`RedirectPayment`](#pwa-response) |
| `await kbz.qr(data)` | Customer scans a QR | [`QrPayment`](#qr-response) |
| `await kbz.app(data)` | Your mobile app opens the KBZ Pay SDK | [`AppPayment`](#app-response) |
| `await kbz.status(orderId)` | Query an order | [`PaymentStatusResult`](#status-response) |
| `kbz.handleCallback(request)` | Verify the notification | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what KBZ Pay puts in each result.

## How it works

Every KBZ Pay flow starts with the same precreate call and ends with KBZ's signed notification.

<SequenceDiagram
  title="KBZ Pay: precreate, pay, notify"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Pick the flow', detail: 'kbz.pwa() / qr() / app()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Precreate the order', detail: 'PWAAPP / PAY_BY_QRCODE / APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', detail: 'plus qrCode for QR', response: true },
    { from: 'Your app', to: 'Customer', label: 'PWA URL, QR or signed order', detail: 'url / qrString / orderInfo + sign', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Notify callbackUrl', detail: 'signed JSON under Request' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handleCallback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Plain-text success', detail: 'within about 10 s, or KBZ retries', response: true },
    { from: 'Your app', to: 'KBZ Pay', label: 'No notify? Query the order', detail: 'await kbz.status(orderId)' },
  ]"
/>

## Initiating a Payment

```ts
import {
  KbzPay,
  type KbzPayPaymentData,
} from '@laranex/myanmar-payments/kbz-pay';

const kbz = new KbzPay({
  appId: '...',
  appKey: '...',
  merchantCode: '...',
});

const data: KbzPayPaymentData = {
  orderId: `ORDER_${order.id}`,
  amount: 10000,
  callbackUrl: 'https://shop.test/payments/kbz/callback',
};

// PWA: send the customer to the KBZ Pay PWA
const redirect = await kbz.pwa(data);
res.writeHead(302, { Location: redirect.url }).end();

// QR: encode qr.qrString into a QR image
const qr = await kbz.qr(data);

// In-app: hand the signed values to your mobile app
const app = await kbz.app(data);
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify(app));
```

### KbzPayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique per order. Letters, digits and `_` only, at most 40 characters |
| `amount` | `Amount \| number \| bigint` | Yes | Kyat, greater than 0, at most 2 decimal places, e.g. `10000` or `Amount.parse('1000.50')`. KBZ only accepts MMK |
| `callbackUrl` | `string` | Yes | Public URL KBZ posts the result to. Absolute http or https URL, at most 512 characters, no query string |
| `title` | `string` | No | Product name shown to the customer |
| `timeoutMinutes` | `number` | No | An integer from 1 to 120. Unset leaves it to KBZ (120) |
| `callbackInfo` | `string` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; build the `CallbackRequest` from the whole request.

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// POST /payments/kbz/callback
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = kbz.handleCallback(request);

  if (callback.isSuccessful()) {
    // callback.orderId is your merch_order_id
    // callback.gatewayReference is KBZ's mm_order_id
  }

  callback.acknowledgement.send(res); // plain-text "success"
} catch {
  res.writeHead(400).end('invalid callback');
}
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, [query the order](#status-checks).

## Status Checks

```ts
const result = await kbz.status(`ORDER_${order.id}`);

if (result.isSuccessful()) {
  // result.gatewayReference is KBZ's mm_order_id
}
```

`status()` takes your `orderId`. An order KBZ doesn't know throws `ApiError`.

## Responses

What KBZ Pay puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values, with JSON numbers kept as their exact text in a `string` (`1000.50` stays `"1000.50"`).

### `pwa()` → `RedirectPayment` {#pwa-response}

| Field | KBZ Pay value |
|---|---|
| `flow` | `'redirect'` |
| `orderId` | Your `data.orderId` |
| `url` | `{pwaUrl}?appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…&sign=…` |
| `gatewayReference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response: `result`, `code`, `msg`, `merch_order_id`, `prepay_id`, `nonce_str`, `sign_type`, `sign` |

### `qr()` → `QrPayment` {#qr-response}

| Field / Method | KBZ Pay value |
|---|---|
| `flow` | `'qr'` |
| `orderId` | Your `data.orderId` |
| `qrString` | KBZ `qrCode`, a payload to encode into a QR image. Always set |
| `qrImage` | Always `undefined` |
| `expiresAt` | Now + `timeoutMinutes`. `undefined` when `timeoutMinutes` is unset (KBZ then allows 120 minutes) |
| `reference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response, as for `pwa()` plus `qrCode` |
| `qrImageDataUri()` | Always `undefined`, as `qrImage` is |

### `app()` → `AppPayment` {#app-response}

| Field / Method | KBZ Pay value |
|---|---|
| `flow` | `'app'` |
| `orderId` | Your `data.orderId` |
| `orderInfo` | `appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…` |
| `sign` | SHA-256 signature of `orderInfo`, uppercase hex. See [Signing](#signing) |
| `signType` | `SHA256` |
| `raw` | The `precreate` response, as for `pwa()` |
| `toJSON()` | `orderId`, `orderInfo`, `sign` and `signType`, without `raw` |

### `status()` → `PaymentStatusResult` {#status-response}

| Field | KBZ Pay value |
|---|---|
| `orderId` | KBZ `merch_order_id`, falling back to the `orderId` you passed. Always set |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gatewayReference` | KBZ `mm_order_id`. `undefined` until KBZ has created the payment |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The `queryorder` response: `result`, `code`, `msg`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `nonce_str`, `sign_type`, `sign` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | KBZ Pay value |
|---|---|
| `orderId` | KBZ `merch_order_id` (your `orderId`) |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gatewayReference` | KBZ `mm_order_id` |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The verified `Request`: `appid`, `notify_time`, `merch_code`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `callback_info`, `nonce_str`, `sign_type`, `sign` |
| `acknowledgement` | HTTP `200`, body `success`, `Content-Type: text/plain` |

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `successful` |
| `WAIT_PAY`, `PAYING` | `pending` |
| `PAY_FAILED` | `failed` |
| `ORDER_CLOSED` | `canceled` |
| `ORDER_EXPIRED` | `expired` |
| anything else | `unknown` |

## Signing

KBZ signs requests, the in-app `orderInfo` and notifications the same way: every non-empty field except `sign` and `sign_type`, sorted by key, joined as raw `key=value` pairs, with `&key=<app key>` appended, hashed with SHA-256 and uppercased. The package signs every request and verifies every notification for you; `kbz.signer` (a `KbzPaySigner`, also exported from `@laranex/myanmar-payments/kbz-pay`) exposes the same signature for custom calls: `signString(fields)`, `sign(fields)` and `verify(fields)`.

## Errors

| Call | Throws | When |
|---|---|---|
| `pwa()`, `qr()`, `app()` | `InvalidPaymentDataError` | `KbzPay.validate(data)` fails. Nothing is sent |
| `pwa()`, `qr()`, `app()` | `ApiError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, or without a `prepay_id` |
| `qr()` | `ApiError` | KBZ returns no `qrCode` |
| `status()` | `ApiError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, e.g. for an unknown order |
| `handleCallback()` | `SignatureVerificationError` | `sign` doesn't match, or a field holds an object or array |

The async calls reject with these errors. `ApiError` carries KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `gatewayCode` and its `msg` in `gatewayMessage`. When KBZ can't be reached, the request times out or the `signal` aborts, the calls throw `ApiError` with the original error as `cause`.
