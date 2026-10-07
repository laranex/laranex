---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR with Laravel Myanmar Payments. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `yomaMmqr()->initiate($data)` | Check out the order and generate its first QR | [`QrPayment`](/laravel-myanmar-payments/payment-flows#qr-payments) |
| `yomaMmqr()->renewQr($orderId)` | Generate a new QR for a checked-out order | `QrPayment` |
| `yomaMmqr()->status($reference)` | Check a QR's payment status | `PaymentStatusResult` |
| `yomaMmqr()->handleCallback($request)` | Verify the callback | `PaymentCallback` |

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
| `amount` | `int` | Yes | Whole kyat, greater than 0 (Yoma documents no decimals or currency) |
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

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `Successful` |
| `PENDING` | `Pending` |
| `fail` (callback), `FAILED` (status) | `Failed` |
| `QR EXPIRED` error | `Expired` |
| anything else | `Unknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The package caches it in your cache store (see [Configuration](/laravel-myanmar-payments/configuration#cache)) and fetches a new one when Yoma answers `401`.

## Errors

Yoma reports business errors with HTTP 200 and an `errorCode`; the package throws `ApiException` for them, e.g. `PAYMENT ALREADY EXISTS` when an order is checked out twice.
