---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in plain PHP. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `$yomaMmqr->initiate($data)` | Check out the order and generate its first QR | [`QrPayment`](#initiate-response) |
| `$yomaMmqr->renewQr($orderId)` | Generate a new QR for a checked-out order | [`QrPayment`](#renewqr-response) |
| `$yomaMmqr->status($reference)` | Check a QR's payment status | [`PaymentStatusResult`](#status-response) |
| `$yomaMmqr->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Yoma MMQR puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: '$yomaMmqr->initiate($data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: '$payment->qrImageDataUri()', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: '$yomaMmqr->renewQr($orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$yomaMmqr->handleCallback()' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: '$yomaMmqr->status($reference)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqr;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrConfig;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrPaymentData;

$yomaMmqr = new YomaMmqr(
    new YomaMmqrConfig(merchantId: '...', clientId: '...', clientSecret: '...', webhookHashKey: '...', sandbox: true),
    httpClient: null, // discovered
    cache: $cache,    // a shared PSR-16 cache for the access token
);

$payment = $yomaMmqr->initiate(new YomaMmqrPaymentData(
    orderId: 'ORD-'.$order->id,
    amount: 10000,
    description: 'Order #'.$order->id,
));

$order->saveQrReference($payment->reference);
?>
<img src="<?= htmlspecialchars($payment->qrImageDataUri()) ?>" alt="Scan with any MMQR wallet">
```

`qrImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

### YomaMmqrPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount\|int` | Yes | Whole kyat, greater than 0, e.g. `1000` or `Amount::kyat(1000)`. Yoma documents no decimals or currency |
| `description` | `string` | Yes | At most 50 characters |

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`YomaMmqr::QR_LIFETIME_SECONDS`); `$payment->expiresAt` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```php
$payment = $yomaMmqr->renewQr('ORD-'.$order->id);
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```php
$result = $yomaMmqr->status($payment->reference);
```

An expired QR returns `PaymentStatus::Expired` instead of throwing. `$result->orderId` is `null` here because Yoma only returns the reference.

## Handling Callbacks

```php
// yoma/callback.php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$callback = $yomaMmqr->handleCallback(CallbackRequest::fromGlobals());

if ($callback->isSuccessful()) {
    // $callback->orderId is your order number
}

$callback->acknowledgement()->send();
```

The callback URL is registered with Yoma, not sent per order. When `webhookSecret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `webhookHashKey`.

::: warning
Yoma's specification does not name the hash algorithm; HMAC-SHA256 is inferred from its sample. Confirm it with Yoma before going live.
:::

## Responses

What Yoma MMQR puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `QrPayment` {#initiate-response}

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Your `orderId` (Yoma `orderNumber`) |
| `qrString` | Always `null` |
| `qrImage` | Yoma `qrString`, a base64 PNG to display as is. Always set |
| `expiresAt` | Now + 120 seconds (`YomaMmqr::QR_LIFETIME_SECONDS`). Always set |
| `reference` | Yoma `refLabel`, used by `status()`. Always set |
| `raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`null`), `errorDescription` |
| `qrImageDataUri()` | `data:image/png;base64,…` |

`initiate()` checks the order out, then generates the QR; the result comes from the generate call.

### `renewQr()` → `QrPayment` {#renewqr-response}

The same values as [`initiate()`](#initiate-response), from a new generate call: a new `qrImage`, a new `reference` and a fresh `expiresAt`. The previous reference stops working.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | Yoma MMQR value |
|---|---|
| `orderId` | Always `null`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped, or `Expired` for a `QR EXPIRED` error. See [Statuses](#statuses) |
| `gatewayStatus` | Yoma `paymentStatus`, e.g. `SUCCESS`, or `QR EXPIRED` |
| `gatewayReference` | Yoma `refLabel`, or the reference you passed. Always set |
| `amount` | Always `null`: Yoma doesn't return it |
| `raw` | The `payment/check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Yoma `orderNumber` (your `orderId`) |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Yoma `status`, e.g. `success` |
| `gatewayReference` | Always `null`: the callback carries no reference |
| `amount` | Always `null`: the callback carries no amount |
| `raw` | The verified callback: `orderNumber`, `status`, `hashValue` |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `Successful` |
| `PENDING` | `Pending` |
| `fail` (callback), `FAILED` (status) | `Failed` |
| `QR EXPIRED` error | `Expired` |
| anything else | `Unknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. `YomaMmqr` caches it in the PSR-16 cache you pass (see [Configuration](/php-myanmar-payments/configuration#cache)) and fetches a new one when Yoma answers `401`. Without a cache, every PHP request fetches a new token.

## Errors

Yoma reports business errors with HTTP 200 and an `errorCode`; the package throws `ApiException` for them, e.g. `PAYMENT ALREADY EXISTS` when an order is checked out twice.
