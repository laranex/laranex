---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in plain PHP. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

Yoma MMQR is Yoma Bank's MMQR gateway: it issues ready-made QR images that customers scan with any MMQR wallet.

| Call | What it does | Returns |
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
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$yomaMmqr->handleCallback($request)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: '$yomaMmqr->status($reference)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqr;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrConfig;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrPaymentData;

$yomaMmqr = new YomaMmqr(
    new YomaMmqrConfig(
        merchantId: '...',
        clientId: '...',
        clientSecret: '...',
        webhookHashKey: '...',
        sandbox: true,
    ),
    cache: $cache, // a shared PSR-16 cache for the access token
);

$data = new YomaMmqrPaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    description: 'Order #'.$order->id,
);

$payment = $yomaMmqr->initiate($data);

// Store $payment->reference with the order for status checks.

$src = htmlspecialchars((string) $payment->qrImageDataUri());
echo '<img src="'.$src.'" alt="Scan with any MMQR wallet">';
```

### YomaMmqrPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount\|int` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount::kyat(10000)`. Yoma documents no decimals or currency |
| `description` | `string` | Yes | At most 50 characters |

### QR Image

`qrImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

## Handling Callbacks

```php
// POST /payments/yoma/callback
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $yomaMmqr->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException) {
    http_response_code(400);
    exit;
}

if ($callback->isSuccessful()) {
    // $callback->orderId is your orderNumber
}

$callback->acknowledgement()->send();
```

The callback URL is registered with Yoma, not sent per order. When `webhookSecret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `webhookHashKey`.

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`YomaMmqr::QR_LIFETIME_SECONDS`); `$payment->expiresAt` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```php
$payment = $yomaMmqr->renewQr('ORDER_'.$order->id);

// Store the new $payment->reference: the previous one stops working.
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```php
// $reference is the $payment->reference you stored
$result = $yomaMmqr->status($reference);

if ($result->isSuccessful()) {
    // the QR was paid
}
```

`status()` takes the QR's `reference`, not your `orderId`. An expired QR returns `PaymentStatus::Expired` instead of throwing.

## Responses

What Yoma MMQR puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `QrPayment` {#initiate-response}

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Your `orderId` (Yoma `orderNumber`) |
| `qrString` | Always `null` |
| `qrImage` | Yoma `qrString`, a base64 PNG of the payment slip. Always set |
| `expiresAt` | Now + 120 seconds (`YomaMmqr::QR_LIFETIME_SECONDS`). Always set |
| `reference` | Yoma `refLabel`, e.g. `100000083331`. Pass it to `status()`. Always set |
| `raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`null`), `errorDescription` |
| `qrImageDataUri()` | `data:image/png;base64,…` |

`initiate()` checks the order out (`payment/checkout`), then generates its first QR; the result comes from the generate call.

### `renewQr()` → `QrPayment` {#renewqr-response}

The same values as [`initiate()`](#initiate-response) for the `orderId` you passed, with a new `qrImage`, `reference` and `expiresAt`. The previous `reference` stops answering status checks.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | Yoma MMQR value |
|---|---|
| `orderId` | Always `null`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped, see [Statuses](#statuses). `Expired` for a `QR EXPIRED` error |
| `gatewayStatus` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `gatewayReference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `amount` | Always `null`: Yoma's status response has no amount |
| `raw` | The `payment/check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Yoma MMQR value |
|---|---|
| `orderId` | Yoma `orderNumber` (your `orderId`) |
| `status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `gatewayStatus` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `gatewayReference` | Always `null`: Yoma's callback has no reference |
| `amount` | Always `null`: Yoma's callback has no amount |
| `raw` | The verified body: `orderNumber`, `status`, `hashValue` |
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

Yoma authenticates with an OAuth token that lasts hours. `YomaMmqr` caches it in the PSR-16 cache you pass (see [Configuration](/php-myanmar-payments/configuration#cache)) and fetches a new one, retrying once, when Yoma answers `401`. Without a cache it keeps the token in memory, so every PHP request fetches a new one. `$yomaMmqr->forgetToken()` drops the cached token, e.g. after rotating the client secret.

## Errors

| Call | Throws | When |
|---|---|---|
| `new YomaMmqrPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is sent |
| `initiate()` | `ApiException` | The token request fails, Yoma answers with an HTTP error or an `errorCode` (e.g. `PAYMENT ALREADY EXISTS`), `checkOutStatus` isn't `true`, or there is no `qrString` or `refLabel` |
| `renewQr()` | `ApiException` | As `initiate()`, without the checkout |
| `status()` | `ApiException` | The token request fails, or Yoma answers with an HTTP error or any `errorCode` other than `QR EXPIRED` |
| `handleCallback()` | `SignatureVerificationException` | `X-Webhook-Secret` is missing or wrong (when a webhook secret is set), `orderNumber` is missing, or `hashValue` doesn't match |

Yoma reports business errors with HTTP 200 and an `errorCode`; `ApiException` carries it in `gatewayCode` and Yoma's `errorDescription` in `gatewayMessage`. When Yoma can't be reached, the calls throw `ApiException` with `httpStatus` `0`.
