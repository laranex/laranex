---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR with Laravel Myanmar Payments. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `yomaMmqr()->initiate($data)` | Check out the order and generate its first QR | [`QrPayment`](#initiate-response) |
| `yomaMmqr()->renewQr($orderId)` | Generate a new QR for a checked-out order | [`QrPayment`](#renewqr-response) |
| `yomaMmqr()->status($reference)` | Check a QR's payment status | [`PaymentStatusResult`](#status-response) |
| `yomaMmqr()->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Yoma puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yomaMmqr()->initiate()' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: '$payment->qrImageDataUri()', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yomaMmqr()->renewQr($orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yomaMmqr()->handleCallback()' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: 'yomaMmqr()->status($reference)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrPaymentData;

$payment = MyanmarPayments::yomaMmqr()->initiate(new YomaMmqrPaymentData(
    orderId: 'ORD-'.$order->id,
    amount: 10000,
    description: 'Order #'.$order->id,
));

$order->update(['qr_reference' => $payment->reference]);
```

```blade
<img src="{{ $payment->qrImageDataUri() }}" alt="Scan with any MMQR wallet">
```

`qrImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

### YomaMmqrPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount\|int` | Yes | Whole kyat, greater than 0, e.g. `1000` or `Amount::kyat(1000)`. Yoma documents no decimals or currency |
| `description` | `string` | Yes | At most 50 characters |

## QR Lifetime and Renewal

A QR is payable for 120 seconds; `$payment->expiresAt` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```php
$payment = MyanmarPayments::yomaMmqr()->renewQr('ORD-'.$order->id);
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```php
$result = MyanmarPayments::yomaMmqr()->status($payment->reference);
```

An expired QR returns `PaymentStatus::Expired` instead of throwing. `$result->orderId` is `null` here because Yoma only returns the reference.

## Handling Callbacks

```php
Route::post('/payments/yoma/callback', function (Request $request) {
    $callback = MyanmarPayments::yomaMmqr()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId is your order number
    }

    return MyanmarPayments::acknowledge($callback);
});
```

The callback URL is registered with Yoma, not sent per order. When `YOMA_MMQR_WEBHOOK_SECRET` is set, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `YOMA_MMQR_WEBHOOK_HASHKEY`.

::: warning
Yoma's specification does not name the hash algorithm; HMAC-SHA256 is inferred from its sample. Confirm it with Yoma before going live.
:::

## Responses

What Yoma MMQR puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `QrPayment` {#initiate-response}

`initiate()` checks the order out, then generates its first QR.

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Your `orderId` (Yoma `orderNumber`) |
| `qrString` | Always `null` |
| `qrImage` | Yoma `qrString`, a base64 PNG of the payment slip. Always set |
| `expiresAt` | Now + 120 seconds. Always set |
| `reference` | Yoma `refLabel`, e.g. `100000083331`. Always set; pass it to `status()` |
| `raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`null`), `errorDescription` |
| `qrImageDataUri()` | `data:image/png;base64,…` |

The checkout response is not returned; a checkout without `checkOutStatus: true` throws `ApiException`.

### `renewQr()` → `QrPayment` {#renewqr-response}

The same values as [`initiate()`](#initiate-response), with a new `qrImage`, `reference` and `expiresAt`. The previous `reference` stops answering status checks.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | Yoma MMQR value |
|---|---|
| `orderId` | Always `null`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped, see [Statuses](#statuses). `Expired` for a `QR EXPIRED` error |
| `gatewayStatus` | Yoma `paymentStatus`, e.g. `SUCCESS`, or `QR EXPIRED` |
| `gatewayReference` | Yoma `refLabel`, or the reference you passed. Always set |
| `amount` | Always `null`: Yoma doesn't report it |
| `raw` | The `check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Yoma `orderNumber` (your `orderId`) |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Yoma `status`, e.g. `success` |
| `gatewayReference` | Always `null`: the callback carries no reference |
| `amount` | Always `null`: the callback carries no amount |
| `raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement()` into a `CallbackResponse` (`Responsable`) that renders an empty `200`; Yoma's spec defines no acknowledgement body. `handleCallback()` accepts an `Illuminate\Http\Request` or a `CallbackRequest`.

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `Successful` |
| `PENDING` | `Pending` |
| `fail` (callback), `FAILED` (status) | `Failed` |
| `QR EXPIRED` error | `Expired` |
| anything else | `Unknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The package caches it in your cache store (see [Configuration](/laravel-myanmar-payments/configuration#cache)) and fetches a new one when Yoma answers `401`. `MyanmarPayments::yomaMmqr()->forgetToken()` drops the cached token, e.g. after rotating the client secret.

## Errors

Yoma reports business errors with HTTP 200 and an `errorCode`; the package throws `ApiException` for them, e.g. `PAYMENT ALREADY EXISTS` when an order is checked out twice.
