---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in Node.js. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

Yoma MMQR is Yoma Bank's MMQR gateway: it issues ready-made QR images that customers scan with any MMQR wallet.

| Call | What it does | Returns |
|---|---|---|
| `await yoma.initiate(data)` | Check out the order and generate its first QR | [`QrPayment`](#initiate-response) |
| `await yoma.renewQr(orderId)` | Generate a new QR for a checked-out order | [`QrPayment`](#renewqr-response) |
| `await yoma.status(reference)` | Check a QR's payment status | [`PaymentStatusResult`](#status-response) |
| `yoma.handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Yoma MMQR puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'await yoma.initiate(data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: 'payment.qrImageDataUri()', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'await yoma.renewQr(orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.handleCallback(request)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: 'await yoma.status(reference)' },
  ]"
/>

## Initiating a Payment

```ts
import {
  YomaMmqr,
  type YomaMmqrPaymentData,
} from '@laranex/myanmar-payments/yoma-mmqr';

// Create it once at startup: the in-memory token cache lives on the instance.
const yoma = new YomaMmqr({
  merchantId: '...',
  clientId: '...',
  clientSecret: '...',
  webhookHashKey: '...',
});

const data: YomaMmqrPaymentData = {
  orderId: `ORDER_${order.id}`,
  amount: 10000,
  description: `Order #${order.id}`,
};

const payment = await yoma.initiate(data);

// Store payment.reference with the order for status checks.

const src = payment.qrImageDataUri();
res.end(`<img src="${src}" alt="Scan with any MMQR wallet">`);
```

### YomaMmqrPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount \| number \| bigint` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. Yoma documents no decimals or currency |
| `description` | `string` | Yes | At most 50 characters |

### QR Image

`qrImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

## Handling Callbacks

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// POST /payments/yoma/callback
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = yoma.handleCallback(request);

  if (callback.isSuccessful()) {
    // callback.orderId is your orderNumber
  }

  callback.acknowledgement.send(res);
} catch {
  res.writeHead(400).end('invalid callback');
}
```

The callback URL is registered with Yoma, not sent per order. When `webhookSecret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `webhookHashKey`.

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`); `payment.expiresAt` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```ts
const payment = await yoma.renewQr(`ORDER_${order.id}`);

// Store the new payment.reference: the previous one stops working.
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```ts
// reference is the payment.reference you stored
const result = await yoma.status(reference);

if (result.isSuccessful()) {
  // the QR was paid
}
```

`status()` takes the QR's `reference`, not your `orderId`. An expired QR returns `expired` instead of throwing.

## Responses

What Yoma MMQR puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s).

### `initiate()` → `QrPayment` {#initiate-response}

| Field / Method | Yoma MMQR value |
|---|---|
| `flow` | `'qr'` |
| `orderId` | Your `data.orderId` (Yoma `orderNumber`) |
| `qrString` | Always `undefined` |
| `qrImage` | Yoma `qrString`, a base64 PNG of the payment slip. Always set |
| `expiresAt` | Now + 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`). Always set |
| `reference` | Yoma `refLabel`, e.g. `100000083331`. Pass it to `status()`. Always set |
| `raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`null`), `errorDescription` |
| `qrImageDataUri()` | `data:image/png;base64,…` |

`initiate()` checks the order out (`payment/checkout`), then generates its first QR; the result comes from the generate call.

### `renewQr()` → `QrPayment` {#renewqr-response}

The same values as [`initiate()`](#initiate-response) for the `orderId` you passed, with a new `qrImage`, `reference` and `expiresAt`. The previous `reference` stops answering status checks.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | Yoma MMQR value |
|---|---|
| `orderId` | Always `undefined`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped, see [Statuses](#statuses). `expired` for a `QR EXPIRED` error |
| `gatewayStatus` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `gatewayReference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `amount` | Always `undefined`: Yoma's status response has no amount |
| `raw` | The `payment/check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | Yoma MMQR value |
|---|---|
| `orderId` | Yoma `orderNumber` (your `orderId`) |
| `status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `gatewayStatus` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `gatewayReference` | Always `undefined`: Yoma's callback has no reference |
| `amount` | Always `undefined`: Yoma's callback has no amount |
| `raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `successful` |
| `PENDING` | `pending` |
| `fail` (callback), `FAILED` (status) | `failed` |
| `QR EXPIRED` error | `expired` |
| anything else | `unknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The gateway keeps it in the [token cache](/node-myanmar-payments/configuration#token-cache), shares one token request between concurrent calls, and fetches a new token, retrying once, when Yoma answers `401`. The shared token request is bounded by the HTTP client timeout rather than one call's `signal`, so aborting one call never fails the others. `await yoma.forgetToken()` drops the cached token, e.g. after rotating the client secret.

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `YomaMmqr.validate(data)` fails. Nothing is sent |
| `initiate()` | `ApiError` | The token request fails, Yoma answers with an HTTP error or an `errorCode` (e.g. `PAYMENT ALREADY EXISTS`), `checkOutStatus` isn't `true`, or there is no `qrString` or `refLabel` |
| `renewQr()` | `ApiError` | As `initiate()`, without the checkout |
| `status()` | `ApiError` | The token request fails, or Yoma answers with an HTTP error or any `errorCode` other than `QR EXPIRED` |
| `handleCallback()` | `SignatureVerificationError` | `X-Webhook-Secret` is missing or wrong (when `webhookSecret` is set), `orderNumber` is missing, or `hashValue` doesn't match |

The async calls reject with these errors. Yoma reports business errors with HTTP 200 and an `errorCode`; `ApiError` carries it in `gatewayCode` and Yoma's `errorDescription` in `gatewayMessage`. When Yoma can't be reached, the request times out or the `signal` aborts, the calls throw `ApiError` with the original error as `cause`.
