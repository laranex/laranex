---
title: CyberSource Secure Acceptance
description: Integrate CyberSource Secure Acceptance with Laravel Myanmar Payments using a signed form POST. The driver verifies the response signature automatically on callback.
---

# CyberSource Secure Acceptance


CyberSource uses a form POST flow. Your page renders a hidden HTML form that auto-submits to `$result->formUrl` with the signed `$result->formData`.

:::warning No Query API
CyberSource Secure Acceptance does not expose an order status query endpoint. Use `handleCallback()` to determine the final payment status.
:::

## Data Class

```php
use Laranex\LaravelMyanmarPayments\Data\CyberSourcePaymentData;

new CyberSourcePaymentData(
    orderId:         'ORD-001',     // required
    amount:          20000,         // required, in MMK (integer)
    callbackUrl:     'https://...', // required, must be a valid URL
    currency:        'MMK',         // optional, default 'MMK'
    frontendUrl:     'https://...', // optional, redirect after payment
    transactionType: 'sale',        // optional, default 'sale'
    cancelUrl:       'https://...', // optional
    transactionUuid: '',            // optional, auto-generated if empty
    referenceNumber: '',            // optional, defaults to orderId
)
```

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Data\CyberSourcePaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$result = MyanmarPayments::driver('cyber_source')->initiate(new CyberSourcePaymentData(
    orderId: 'ORD-001',
    amount: 20000,
    callbackUrl: route('payment.callback'),
    frontendUrl: route('payment.success'),
    cancelUrl: route('payment.cancel'),
));

// Render an auto-submit form in your view
// $result->formUrl  — POST target
// $result->formData — signed hidden field key/value pairs
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

## Handling Callbacks

CyberSource posts the payment result back to your `callbackUrl`. The driver verifies the response signature automatically — if the signature is invalid a `PaymentException` is thrown.

```php
Route::post('/payment/callback/cybersource', function (Request $request) {
    $result = MyanmarPayments::driver('cyber_source')->handleCallback($request->all());

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
| `transactionId` | `?string` | `handleCallback` |
| `orderId` | `?string` | `handleCallback` |
| `raw` | `array` | All methods |
