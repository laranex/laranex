---
title: Wave Money
description: Integrate Wave Money payments using a redirect flow with Laravel Myanmar Payments. Amount is calculated automatically from items; final status is determined via handleCallback.
---

# Wave Money

`wave_money` uses the [redirect-based](/laravel-myanmar-payments/payment-flows#redirect-based) flow.

## Initiating a Payment

The total charge is calculated from the sum of all `items` amounts — there is no separate `amount` parameter.

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\WaveMoneyRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$transactionId = Str::uuid()->toString();

$result = MyanmarPayments::driver('wave_money')->initiate(
    new WaveMoneyRequestPaymentData(
        transactionId: $transactionId,
        callbackUrl:   route('payment.callback'),
        frontendUrl:   route('payment.success'), // redirect after payment
        description:   'Order payment',
        items: [
            ['name' => 'Product A', 'amount' => 3000],
            ['name' => 'Product B', 'amount' => 2000],
        ],
    )
);

return redirect($result->value);
```

## Handling Callbacks

```php
Route::post('/payment/callback/wave-money', function (Request $request) {
    $result = MyanmarPayments::driver('wave_money')->handleCallback($request->all());

    if ($result->isSuccessful()) {
        // $result->transactionId
    }
});
```
