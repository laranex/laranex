---
title: KBZ Pay
description: Integrate KBZ Pay with Laravel Myanmar Payments. Supports PWA redirect, QR code, and in-app payment flows via a single KbzPayRequestPaymentData class.
---

# KBZ Pay

- `kbzpay.pwa` — [redirect-based](/laravel-myanmar-payments/payment-flows#redirect-based) flow
- `kbzpay.qr` — [QR-based](/laravel-myanmar-payments/payment-flows#qr-based) flow
- `kbzpay.app` — [app-based](/laravel-myanmar-payments/payment-flows#app-based) flow

## Initiating a Payment

### PWA

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\KbzPayRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$transactionId = Str::uuid()->toString();

$data = new KbzPayRequestPaymentData(
    transactionId: $transactionId,
    amount:        10000,              // in MMK (integer)
    callbackUrl:   route('payment.callback'),
    currency:      'MMK',             // optional, default 'MMK'
    nonceStr:      '',                // optional, auto-generated if empty
);

$result = MyanmarPayments::driver('kbzpay.pwa')->initiate($data);

return redirect($result->value);
```

### QR Code

```php
$transactionId = Str::uuid()->toString();

$data = new KbzPayRequestPaymentData(
    transactionId: $transactionId,
    amount:        10000,
    callbackUrl:   route('payment.callback'),
);

$result = MyanmarPayments::driver('kbzpay.qr')->initiate($data);

// $result->value is the QR code string — render it as an image in your UI
```

### In-App

```php
$transactionId = Str::uuid()->toString();

$data = new KbzPayRequestPaymentData(
    transactionId: $transactionId,
    amount:        10000,
    callbackUrl:   route('payment.callback'),
);

$result = MyanmarPayments::driver('kbzpay.app')->initiate($data);

// $result->value is the signed payload array for the KBZ Pay mobile SDK
return response()->json($result->value);
```

## Handling Callbacks

KBZ Pay sends the callback payload nested under a `Request` key. The driver handles this automatically — pass `$request->all()` directly.

```php
Route::post('/payment/callback/kbzpay', function (Request $request) {
    $result = MyanmarPayments::driver('kbzpay.pwa')
        ->handleCallback($request->all());

    if ($result->successful) {
        // $result->transactionId
    }
});
```
