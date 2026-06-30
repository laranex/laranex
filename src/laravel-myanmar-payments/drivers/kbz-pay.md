---
title: KBZ Pay
description: Integrate KBZ Pay with Laravel Myanmar Payments. Supports PWA redirect, QR code, and in-app payment flows via a single KbzPayPaymentData class.
---

# KBZ Pay

KBZ Pay exposes three sub-drivers depending on how you want the customer to complete the payment:

| Driver | Flow |
|---|---|
| `kbzpay.pwa` | Redirect to KBZ Pay web page |
| `kbzpay.qr` | Display a QR code for the customer to scan |
| `kbzpay.app` | Pass signed payload to your mobile SDK |

## Data Class

```php
use Laranex\LaravelMyanmarPayments\Data\KbzPayPaymentData;

new KbzPayPaymentData(
    orderId:     'ORD-001',       // required
    amount:      10000,           // required, in MMK (integer)
    callbackUrl: 'https://...',   // required, must be a valid URL
    currency:    'MMK',           // optional, default 'MMK'
    nonceStr:    '',              // optional, auto-generated if empty
)
```

## Initiating a Payment

### PWA (redirect)

```php
use Laranex\LaravelMyanmarPayments\Data\KbzPayPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$result = MyanmarPayments::driver('kbzpay.pwa')->initiate(new KbzPayPaymentData(
    orderId: 'ORD-001',
    amount: 10000,
    callbackUrl: route('payment.callback'),
));

return redirect($result->redirectUrl);
```

### QR Code

```php
$result = MyanmarPayments::driver('kbzpay.qr')->initiate(new KbzPayPaymentData(
    orderId: 'ORD-001',
    amount: 10000,
    callbackUrl: route('payment.callback'),
));

// $result->qrCode is a string — render it as a QR image in your UI
```

### In-App

```php
$result = MyanmarPayments::driver('kbzpay.app')->initiate(new KbzPayPaymentData(
    orderId: 'ORD-001',
    amount: 10000,
    callbackUrl: route('payment.callback'),
));

// $result->appData is the signed array payload for the KBZ Pay mobile SDK
return response()->json($result->appData);
```

## Checking Status

```php
$result = MyanmarPayments::driver('kbzpay.pwa')->verify('ORD-001');

if ($result->isSuccessful()) {
    // fulfill the order
}
```

## Handling Callbacks

KBZ Pay sends the callback payload nested under a `Request` key. The driver handles this automatically — pass `$request->all()` directly.

```php
Route::post('/payment/callback/kbzpay', function (Request $request) {
    $result = MyanmarPayments::driver('kbzpay.pwa')->handleCallback($request->all());

    if ($result->isSuccessful()) {
        // $result->orderId
    }
});
```

## RequestPaymentResult Reference

| Property | Type | Populated by |
|---|---|---|
| `status` | `PaymentStatus` | All methods |
| `redirectUrl` | `?string` | `initiate` (PWA only) |
| `qrCode` | `?string` | `initiate` (QR only) |
| `appData` | `?array` | `initiate` (App only) |
| `orderId` | `?string` | `verify`, `handleCallback` |
| `raw` | `array` | All methods |
