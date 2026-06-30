---
title: AYA Payment Gateway
description: Integrate AYA PGW with Laravel Myanmar Payments using a form POST flow. The callback URL is configured in the merchant portal, not in the payment request.
---

# AYA Payment Gateway


AYA PGW uses a form POST flow. Your page renders a hidden HTML form that auto-submits to `$result->formUrl` with `$result->formData`.

:::info Callback URL
The callback URL for AYA PGW is configured in the AYA merchant portal — it is not passed in the payment request. `AyaPgwPaymentData` has no `callbackUrl` parameter.
:::

## Data Class

```php
use Laranex\LaravelMyanmarPayments\Data\AyaPgwPaymentData;

new AyaPgwPaymentData(
    orderId:      'ORD-001',   // required
    amount:       8000,        // required, in MMK (integer)
    channel:      'AYA_PAY',  // required
    method:       'WALLET',   // required
    currencyCode: 104,         // optional, 104 = MMK (default)
    frontendUrl:  'https://...', // optional, redirect after payment
    description:  '',          // optional
    userRefs:     [],          // optional, up to 5 reference values
)
```

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Data\AyaPgwPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$result = MyanmarPayments::driver('aya_pgw')->initiate(new AyaPgwPaymentData(
    orderId: 'ORD-001',
    amount: 8000,
    channel: 'AYA_PAY',
    method: 'WALLET',
    frontendUrl: route('payment.success'),
    userRefs: ['ref1'],
));

// Render an auto-submit form in your view
// $result->formUrl  — POST target
// $result->formData — hidden field key/value pairs
```

Example Blade snippet:

```html
<form id="payment-form" method="POST" action="{{ $result->formUrl }}">
    @foreach ($result->formData as $key => $value)
        <input type="hidden" name="{{ $key }}" value="{{ $value }}">
    @endforeach
</form>
<script>document.getElementById('payment-form').submit();</script>
```

## Checking Status

```php
$result = MyanmarPayments::driver('aya_pgw')->verify('ORD-001');

if ($result->isSuccessful()) {
    // fulfill the order
}
```

## Handling Callbacks

```php
Route::post('/payment/callback/aya-pgw', function (Request $request) {
    $result = MyanmarPayments::driver('aya_pgw')->handleCallback(
        $request->only('payload', 'checkSum')
    );

    if ($result->isSuccessful()) {
        // $result->orderId, $result->transactionId
    }
});
```

## PaymentResult Reference

| Property | Type | Populated by |
|---|---|---|
| `status` | `PaymentStatus` | All methods |
| `formUrl` | `?string` | `initiate` |
| `formData` | `?array` | `initiate` |
| `transactionId` | `?string` | `verify`, `handleCallback` |
| `orderId` | `?string` | `verify`, `handleCallback` |
| `raw` | `array` | All methods |
