---
title: KBZ Pay
description: Integrate KBZ Pay with Laravel Myanmar Payments. PWA redirect, QR and in-app payments from one KbzPayPaymentData, plus status checks and verified callbacks.
---

# KBZ Pay

KBZ Pay is KBZ Bank's mobile wallet: customers pay in the KBZ Pay PWA, by scanning a QR code, or from your mobile app.

| Call | What it does | Returns |
|---|---|---|
| `kbzPay()->pwa($data)` | Redirect to the KBZ Pay PWA | [`RedirectPayment`](#pwa-response) |
| `kbzPay()->qr($data)` | Customer scans a QR | [`QrPayment`](#qr-response) |
| `kbzPay()->app($data)` | Your mobile app opens the KBZ Pay SDK | [`AppPayment`](#app-response) |
| `kbzPay()->status($orderId)` | Query an order | [`PaymentStatusResult`](#status-response) |
| `kbzPay()->handleCallback($request)` | Verify the notification | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what KBZ Pay puts in each result.

## How it works

Every KBZ Pay flow starts with the same precreate call and ends with KBZ's signed notification.

<SequenceDiagram
  title="KBZ Pay: precreate, pay, notify"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Pick the flow', detail: 'kbzPay()->pwa() / qr() / app()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Precreate the order', detail: 'PWAAPP / PAY_BY_QRCODE / APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', detail: 'plus qrCode for QR', response: true },
    { from: 'Your app', to: 'Customer', label: 'PWA URL, QR or signed order', detail: 'url / qrString / orderInfo + sign', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Notify callbackUrl', detail: 'signed JSON under Request' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbzPay()->handleCallback($request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Plain-text success', detail: 'within about 10 s, or KBZ retries', response: true },
    { from: 'Your app', to: 'KBZ Pay', label: 'No notify? Query the order', detail: 'kbzPay()->status($orderId)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$data = new KbzPayPaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    callbackUrl: route('payments.kbz.callback'),
);

// PWA: send the customer to the KBZ Pay PWA
$payment = MyanmarPayments::kbzPay()->pwa($data);

return redirect()->away($payment->url);

// QR: encode $payment->qrString into a QR image
$payment = MyanmarPayments::kbzPay()->qr($data);

// In-app: hand the signed values to your mobile app
$payment = MyanmarPayments::kbzPay()->app($data);

return response()->json($payment->toArray());
```

### KbzPayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique per order. Letters, digits and `_` only, at most 40 characters |
| `amount` | `Amount\|int` | Yes | Kyat, greater than 0, at most 2 decimal places, e.g. `10000` or `Amount::parse('1000.50')`. KBZ only accepts MMK |
| `callbackUrl` | `string` | Yes | Public URL KBZ posts the result to. At most 512 characters, no query string |
| `title` | `?string` | No | Product name shown to the customer |
| `timeoutMinutes` | `?int` | No | 1 to 120. `null` leaves it to KBZ (120) |
| `callbackInfo` | `?string` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; pass the whole request.

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

Route::post('/payments/kbz/callback', function (Request $request) {
    try {
        $callback = MyanmarPayments::kbzPay()->handleCallback($request);
    } catch (SignatureVerificationException) {
        abort(400);
    }

    if ($callback->isSuccessful()) {
        // $callback->orderId is your merch_order_id
        // $callback->gatewayReference is KBZ's mm_order_id
    }

    return MyanmarPayments::acknowledge($callback); // plain-text "success"
})->name('payments.kbz.callback');
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, [query the order](#status-checks).

## Status Checks

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;

$result = MyanmarPayments::kbzPay()->status('ORDER_'.$order->id);

if ($result->isSuccessful()) {
    // $result->gatewayReference is KBZ's mm_order_id
}
```

`status()` takes your `orderId`. An order KBZ doesn't know throws `ApiException`.

## Responses

What KBZ Pay puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `pwa()` → `RedirectPayment` {#pwa-response}

| Property | KBZ Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `url` | `{pwa_url}?appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…&sign=…` |
| `gatewayReference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response: `result`, `code`, `msg`, `merch_order_id`, `prepay_id`, `nonce_str`, `sign_type`, `sign` |

### `qr()` → `QrPayment` {#qr-response}

| Property / Method | KBZ Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `qrString` | KBZ `qrCode`, a payload to encode into a QR image. Always set |
| `qrImage` | Always `null` |
| `expiresAt` | Now + `timeoutMinutes`. `null` when `timeoutMinutes` is `null` (KBZ then allows 120 minutes) |
| `reference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response, as for `pwa()` plus `qrCode` |
| `qrImageDataUri()` | Always `null`, as `qrImage` is |

### `app()` → `AppPayment` {#app-response}

| Property / Method | KBZ Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `orderInfo` | `appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…` |
| `sign` | SHA-256 signature of `orderInfo`, uppercase hex. See [Signing](#signing) |
| `signType` | `SHA256` |
| `raw` | The `precreate` response, as for `pwa()` |
| `toArray()` | `orderId`, `orderInfo`, `sign` and `signType`, without `raw` |

### `status()` → `PaymentStatusResult` {#status-response}

| Property | KBZ Pay value |
|---|---|
| `orderId` | KBZ `merch_order_id`, falling back to the `orderId` you passed. Always set |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gatewayReference` | KBZ `mm_order_id`. `null` until KBZ has created the payment |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The `queryorder` response: `result`, `code`, `msg`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `nonce_str`, `sign_type`, `sign` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | KBZ Pay value |
|---|---|
| `orderId` | KBZ `merch_order_id` (your `orderId`) |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gatewayReference` | KBZ `mm_order_id` |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The verified `Request`: `appid`, `notify_time`, `merch_code`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `callback_info`, `nonce_str`, `sign_type`, `sign` |
| `acknowledgement()` | HTTP `200`, body `success`, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement()` into a `CallbackResponse` (`Responsable`). `handleCallback()` accepts an `Illuminate\Http\Request` or a `CallbackRequest`.

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `Successful` |
| `WAIT_PAY`, `PAYING` | `Pending` |
| `PAY_FAILED` | `Failed` |
| `ORDER_CLOSED` | `Canceled` |
| `ORDER_EXPIRED` | `Expired` |
| anything else | `Unknown` |

## Signing

KBZ signs requests, the in-app `orderInfo` and notifications the same way: every non-empty field except `sign` and `sign_type`, sorted by key, joined as raw `key=value` pairs, with `&key=<app key>` appended, hashed with SHA-256 and uppercased. The package signs every request and verifies every notification for you; its signer is internal, so there is no public API for custom calls.

## Errors

| Call | Throws | When |
|---|---|---|
| `new KbzPayPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is sent |
| `pwa()`, `qr()`, `app()` | `ApiException` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, or without a `prepay_id` |
| `qr()` | `ApiException` | KBZ returns no `qrCode` |
| `status()` | `ApiException` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, e.g. for an unknown order |
| `handleCallback()` | `SignatureVerificationException` | `sign` doesn't match |

`ApiException` carries KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `gatewayCode` and its `msg` in `gatewayMessage`. When KBZ can't be reached, the calls throw `ApiException` with `httpStatus` `0`.
