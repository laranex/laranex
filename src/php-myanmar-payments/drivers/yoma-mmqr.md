---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in plain PHP. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `$yomaMmqr->initiate($data)` | Check out the order and generate its first QR | [`QrPayment`](/php-myanmar-payments/payment-flows#qr-payments) |
| `$yomaMmqr->renewQr($orderId)` | Generate a new QR for a checked-out order | `QrPayment` |
| `$yomaMmqr->status($reference)` | Check a QR's payment status | `PaymentStatusResult` |
| `$yomaMmqr->handleCallback($request)` | Verify the callback | `PaymentCallback` |

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
