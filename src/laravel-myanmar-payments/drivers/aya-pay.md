---
title: AYA Pay
description: Integrate AYA Pay with Laravel Myanmar Payments. Uses a form POST flow — use the built-in redirect or render the form yourself.
---

# AYA Pay

`aya_pay` uses the [form-based](/laravel-myanmar-payments/payment-flows#form-based) flow.

## Initiating a Payment

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\AyaPayRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$transactionId = Str::uuid()->toString();

$data = new AyaPayRequestPaymentData(
    transactionId: $transactionId,
    amount:        8000,                     // in MMK (integer)
    method:        'WALLET',
    currencyCode:  104,                      // optional, 104 = MMK (default)
    frontendUrl:   route('payment.success'), // optional
    description:   '',                       // optional
    userRefs:      [],                       // optional, up to 5 reference values
);

$result = MyanmarPayments::driver('aya_pay')->initiate($data);

return redirect($result->value);
```

To render the form yourself instead of using the built-in page, see [Form-Based Flow](/laravel-myanmar-payments/payment-flows#form-based).

## Handling Callbacks

```php
Route::post('/payment/callback/aya-pay', function (Request $request) {
    $result = MyanmarPayments::driver('aya_pay')->handleCallback(
        $request->only('payload', 'checkSum')
    );

    if ($result->isSuccessful()) {
        // $result->transactionId
    }
});
```
