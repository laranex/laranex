---
title: CyberSource Secure Acceptance
description: Integrate CyberSource Secure Acceptance with Laravel Myanmar Payments. Uses a signed form POST flow — use the built-in redirect or render the form yourself.
---

# CyberSource Secure Acceptance

`cyber_source` uses the [form-based](/laravel-myanmar-payments/payment-flows#form-based) flow.

## Initiating a Payment

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\CyberSourceRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$transactionId = Str::uuid()->toString();

$data = new CyberSourceRequestPaymentData(
    transactionId:   $transactionId,
    amount:          20000,                  // in MMK (integer)
    callbackUrl:     route('payment.callback'),
    currency:        'MMK',                  // optional, default 'MMK'
    frontendUrl:     route('payment.success'),   // optional
    transactionType: 'sale',                 // optional, default 'sale'
    cancelUrl:       route('payment.cancel'),    // optional
    transactionUuid: '',                     // optional, auto-generated if empty
    referenceNumber: '',                     // optional, defaults to transactionId
);

$result = MyanmarPayments::driver('cyber_source')->initiate($data);

return redirect($result->value);
```

To render the form yourself instead of using the built-in page, see [Form-Based Flow](/laravel-myanmar-payments/payment-flows#form-based).

## Handling Callbacks

CyberSource posts the payment result back to your `callbackUrl`. The driver verifies the response signature automatically — if the signature is invalid a `SignatureVerificationException` is thrown.

```php
Route::post('/payment/callback/cybersource', function (Request $request) {
    $result = MyanmarPayments::driver('cyber_source')->handleCallback($request->all());

    if ($result->successful) {
        // $result->transactionId
    }
});
```
