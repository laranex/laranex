---
title: AYA Payment Gateway
description: Integrate AYA PGW with Laravel Myanmar Payments. Uses a form POST flow — use the built-in redirect or render the form yourself.
---

# AYA Payment Gateway

`aya_pgw` uses the [form-based](/laravel-myanmar-payments/payment-flows#form-based) flow.

## Initiating a Payment

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\AyaPgwRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$transactionId = Str::uuid()->toString();

$result = MyanmarPayments::driver('aya_pgw')->initiate(
    new AyaPgwRequestPaymentData(
        transactionId: $transactionId,
        amount:        8000,                     // in MMK (integer)
        channel:       'AYA_PAY',
        method:        'WALLET',
        currencyCode:  104,                      // optional, 104 = MMK (default)
        frontendUrl:   route('payment.success'), // optional
        description:   '',                       // optional
        userRefs:      [],                       // optional, up to 5 reference values
    )
);

return redirect($result->value);
```

To render the form yourself instead of using the built-in page, see [Form-Based Flow](/laravel-myanmar-payments/payment-flows#form-based).

## Handling Callbacks

```php
Route::post('/payment/callback/aya-pgw', function (Request $request) {
    $result = MyanmarPayments::driver('aya_pgw')->handleCallback(
        $request->only('payload', 'checkSum')
    );

    if ($result->isSuccessful()) {
        // $result->transactionId
    }
});
```
