---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in Node.js. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `await yoma.initiate(data)` | Check out the order and generate its first QR | [`QrPayment`](#initiate-response) |
| `await yoma.renewQr(orderId)` | Generate a new QR for a checked-out order | [`QrPayment`](#renewqr-response) |
| `await yoma.status(reference)` | Check a QR's payment status | [`PaymentStatusResult`](#status-response) |
| `yoma.handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |
| `await yoma.forgetToken()` | Drop the cached access token, e.g. after rotating the client secret | nothing |

[Responses](#responses) shows what Yoma puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'await yoma.initiate(data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: 'qrImage, a base64 PNG', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'await yoma.renewQr(orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.handleCallback(request)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: 'await yoma.status(reference)' },
  ]"
/>

## Initiating a Payment

```ts
import { Amount } from '@laranex/myanmar-payments';
import { YomaMmqr } from '@laranex/myanmar-payments/yoma-mmqr';

// Create it once at startup: the in-memory token cache lives on the instance.
const yoma = new YomaMmqr({ merchantId: '...', clientId: '...', clientSecret: '...', webhookHashKey: '...' });

const payment = await yoma.initiate({
  orderId: `ORD-${orderId}`,
  amount: Amount.kyat(10000),
  description: `Order #${orderId}`,
});
await saveQrReference(orderId, payment.reference);
res.end(`<img src="${payment.qrImageDataUri()}" alt="Scan to pay">`);
```

`qrImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

### YomaMmqrPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount \| number \| bigint` | Yes | Whole kyat, greater than 0 (Yoma documents no decimals or currency) |
| `description` | `string` | Yes | At most 50 characters |

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`); `payment.expiresAt` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```ts
const payment = await yoma.renewQr(`ORD-${orderId}`);
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```ts
const result = await yoma.status(reference); // the payment.reference you saved
```

An expired QR returns `expired` (with `gatewayStatus` `QR EXPIRED`) instead of throwing. `result.orderId` is `undefined` here because Yoma only returns the reference.

## Handling Callbacks

```ts
try {
  const callback = yoma.handleCallback(await CallbackRequest.fromNodeRequest(req));
  if (callback.isSuccessful()) {
    // callback.orderId is your order number
  }
  callback.acknowledgement.send(res);
} catch (error) {
  res.writeHead(400).end('invalid callback');
}
```

The callback URL is registered with Yoma, not sent per order. When `webhookSecret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `webhookHashKey`.

::: warning
Yoma's specification does not name the hash algorithm; HMAC-SHA256 is inferred from its sample. Confirm it with Yoma before going live.
:::

## Responses

What Yoma puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. On error the method throws (the promise rejects); a field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s). Network failures, timeouts and an aborted `signal` throw `ApiError` with the original error as `cause`.

### `initiate()` → `QrPayment` {#initiate-response}

| Field / Method | Yoma value |
|---|---|
| `flow` | `'qr'` |
| `orderId` | Your `data.orderId` |
| `qrString` | Always `undefined` |
| `qrImage` | Yoma `qrString`, a base64 PNG to display as is. Always set |
| `expiresAt` | Now + 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`). Always set |
| `reference` | Yoma `refLabel`: pass it to `status()`. Always set |
| `raw` | The `qr/generate` response, including `qrString` and `refLabel` |
| `qrImageDataUri()` | `data:image/png;base64,…` |

`initiate()` checks the order out (`payment/checkout`) and then calls `renewQr()`, so this is the first QR. Errors: `InvalidPaymentDataError` (no request sent), `ApiError` (token request failed, HTTP error, an `errorCode` even on HTTP 200, e.g. `PAYMENT ALREADY EXISTS`, `checkOutStatus` not `true`, or no `qrString` / `refLabel`).

### `renewQr()` → `QrPayment` {#renewqr-response}

The same values as `initiate()` for the `orderId` you passed, with a new `qrImage`, `reference` and `expiresAt`. The previous `reference` stops working. Errors: `ApiError`, as `initiate()`.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | Yoma value |
|---|---|
| `orderId` | Always `undefined`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped, see [Statuses](#statuses). `expired` for a `QR EXPIRED` error |
| `gatewayStatus` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `gatewayReference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `amount` | Always `undefined`: Yoma's status response has no amount |
| `raw` | The `payment/check-status` response, including `paymentStatus` and `refLabel` (or `errorCode`) |

Errors: `ApiError` (token request failed, HTTP error, or any `errorCode` other than `QR EXPIRED`).

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | Yoma value |
|---|---|
| `orderId` | Yoma `orderNumber` (your `orderId`) |
| `status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `gatewayStatus` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `gatewayReference` | Always `undefined`: Yoma's callback has no reference |
| `amount` | Always `undefined`: Yoma's callback has no amount |
| `raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `SignatureVerificationError` when `X-Webhook-Secret` is missing or wrong (with `webhookSecret` set), `orderNumber` is missing, or `hashValue` does not match.

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `successful` |
| `PENDING` | `pending` |
| `fail` (callback), `FAILED` (status) | `failed` |
| `QR EXPIRED` error | `expired` |
| anything else | `unknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The gateway keeps it in the [token cache](/node-myanmar-payments/configuration#token-cache), shares one token request between concurrent calls, and fetches a new token, retrying once, when Yoma answers `401`. The shared token request is bounded by the HTTP client timeout rather than one call's `signal`, so aborting one call never fails the others.

## Errors

Yoma reports business errors with HTTP 200 and an `errorCode`; the package throws `ApiError` for them, e.g. `PAYMENT ALREADY EXISTS` when an order is checked out twice.
