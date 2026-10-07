---
title: KBZ Pay
description: Integrate KBZ Pay with Laravel Myanmar Payments. PWA redirect, QR and in-app payments from one KbzPayPaymentData, plus status checks and verified callbacks.
---

# KBZ Pay

| Method | Flow | Returns |
|---|---|---|
| `kbzPay()->pwa($data)` | Redirect to the KBZ Pay PWA | [`RedirectPayment`](/laravel-myanmar-payments/payment-flows#redirect-payments) |
| `kbzPay()->qr($data)` | Customer scans a QR | [`QrPayment`](/laravel-myanmar-payments/payment-flows#qr-payments) |
| `kbzPay()->app($data)` | Your mobile app opens the KBZ Pay SDK | [`AppPayment`](/laravel-myanmar-payments/payment-flows#app-payments) |
| `kbzPay()->status($orderId)` | Query an order | `PaymentStatusResult` |
| `kbzPay()->handleCallback($request)` | Verify the notification | `PaymentCallback` |

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$data = new KbzPayPaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    callbackUrl: route('payments.kbz.callback'),
);

// PWA
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
| `amount` | `Amount\|int` | Yes | Kyat, greater than 0, up to 2 decimal places: `1000` or `Amount::parse('1000.50')`. KBZ only accepts MMK |
| `callbackUrl` | `string` | Yes | Public URL KBZ posts the result to. At most 512 characters, no query string |
| `title` | `?string` | No | Product name shown to the customer |
| `timeoutMinutes` | `?int` | No | 1 to 120. KBZ defaults to 120 |
| `callbackInfo` | `?string` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

Invalid values throw `InvalidPaymentDataException` before any request is sent.

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; pass the whole request.

```php
Route::post('/payments/kbz/callback', function (Request $request) {
    $callback = MyanmarPayments::kbzPay()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId is your merch_order_id, $callback->gatewayReference is KBZ's mm_order_id
    }

    return MyanmarPayments::acknowledge($callback); // plain-text "success"
})->name('payments.kbz.callback');
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, poll `status()`.

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `Successful` |
| `WAIT_PAY`, `PAYING` | `Pending` |
| `PAY_FAILED` | `Failed` |
| `ORDER_CLOSED` | `Cancelled` |
| `ORDER_EXPIRED` | `Expired` |
| anything else | `Unknown` |

## Errors

A failed `precreate` or `queryorder` throws `ApiException` with KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `gatewayCode` and its `msg` in `gatewayMessage`.
