---
title: Wave Money
description: Integrate Wave Money payments using a redirect flow with Laravel Myanmar Payments. Amount defaults to the sum of items but can be overridden; final status is determined via handleCallback.
---

# Wave Money

`wave_money` uses the [redirect-based](/laravel-myanmar-payments/payment-flows#redirect-based) flow.

## Initiating a Payment

```php
use Illuminate\Support\Str;
use Laranex\LaravelMyanmarPayments\Data\Request\WaveMoneyRequestPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$orderId = Str::uuid()->toString();

$data = new WaveMoneyRequestPaymentData(
    orderId:              $orderId,
    backendResultUrl:     route('payment.callback'),
    frontendResultUrl:    route('payment.success'),
    description:          'Order payment',
    items: [
        ['name' => 'Product A', 'amount' => 3000],
        ['name' => 'Product B', 'amount' => 2000],
    ],
    amount:               5000,       // optional — defaults to sum of items
    merchantReferenceId:  $orderId,   // optional — defaults to orderId
);

$result = MyanmarPayments::driver('wave_money')->initiate($data);

return redirect($result->value);
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `orderId` | `string` | Yes | Your unique order identifier |
| `backendResultUrl` | `string` | Yes | URL Wave Money posts the callback to |
| `frontendResultUrl` | `string` | Yes | URL Wave Money redirects the customer to after payment |
| `description` | `string` | Yes | Payment description shown to the customer |
| `items` | `array` | Yes | Line items — each must have `name` (string) and `amount` (int, MMK) |
| `amount` | `int` | No | Total charge in MMK. Defaults to the sum of all item amounts |
| `merchantReferenceId` | `string` | No | Your internal reference. Defaults to `orderId` |

## Handling Callbacks

```php
Route::post('/payment/callback/wave-money', function (Request $request) {
    $result = MyanmarPayments::driver('wave_money')->handleCallback($request->all());

    if ($result->successful) {
        // $result->transactionId — the orderId echoed back in the callback
    }
});
```

### Callback statuses

| Wave Money status | `$result->successful` |
|---|---|
| `PAYMENT_CONFIRMED` | `true` |
| `PAYMENT_FAILED` | `false` |
| `TRANSACTION_TIMED_OUT` | `false` |
| `SCHEDULER_TRANSACTION_TIMED_OUT` | `false` |
