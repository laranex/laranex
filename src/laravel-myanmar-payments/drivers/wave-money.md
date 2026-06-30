---
title: Wave Money
description: Integrate Wave Money payments using a redirect flow with Laravel Myanmar Payments. Amount is calculated automatically from items; final status is determined via handleCallback.
---

# Wave Money

Wave Money uses a redirect flow. After initiating, redirect the customer to `$result->redirectUrl`.

:::warning No Query API
Wave Money does not expose an order status query endpoint. Use `handleCallback()` to determine the final payment status.
:::

## Data Class

```php
use Laranex\LaravelMyanmarPayments\Data\WaveMoneyPaymentData;

new WaveMoneyPaymentData(
    orderId:             'ORD-001',     // required
    callbackUrl:         'https://...', // required, must be a valid URL
    items:               [],            // required — see below
    merchantReferenceId: '',            // optional, defaults to orderId
    frontendUrl:         'https://...', // optional, redirect after payment
    description:         '',            // optional
)
```

### Items

`items` is required by the Wave Money gateway. Each entry must have a `name` (string) and `amount` (numeric). The total payment amount is calculated automatically from the sum of all item amounts — there is no separate `amount` parameter.

```php
items: [
    ['name' => 'Product A', 'amount' => 3000],
    ['name' => 'Product B', 'amount' => 2000],
],
// total charged: 5000 MMK
```

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Data\WaveMoneyPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$result = MyanmarPayments::driver('wave_money')->initiate(new WaveMoneyPaymentData(
    orderId: 'ORD-001',
    callbackUrl: route('payment.callback'),
    items: [
        ['name' => 'Product A', 'amount' => 3000],
        ['name' => 'Product B', 'amount' => 2000],
    ],
    frontendUrl: route('payment.success'),
));

return redirect($result->redirectUrl);
```

## Handling Callbacks

```php
Route::post('/payment/callback/wave-money', function (Request $request) {
    $result = MyanmarPayments::driver('wave_money')->handleCallback($request->all());

    if ($result->isSuccessful()) {
        // $result->orderId
    }
});
```

## RequestPaymentResult Reference

| Property | Type | Populated by |
|---|---|---|
| `status` | `PaymentStatus` | All methods |
| `redirectUrl` | `?string` | `initiate` |
| `orderId` | `?string` | `handleCallback` |
| `raw` | `array` | All methods |
