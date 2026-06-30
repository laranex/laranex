---
title: CyberSource Secure Acceptance
description: Integrate CyberSource Secure Acceptance with Laravel Myanmar Payments. Uses a signed form POST flow — use the built-in redirect or render the form yourself.
---

# CyberSource Secure Acceptance

CyberSource uses a form POST flow. The driver signs the request fields and returns both a `redirectUrl` (for the built-in form page) and the raw `formUrl`/`formData` if you prefer to render the form yourself.

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

### Using the built-in form page (recommended)

Redirect to `$result->redirectUrl`. The package renders a hidden form and auto-submits it to CyberSource — no extra code needed on your end.

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

return redirect($result->redirectUrl);
```

### Rendering the form yourself

Use `$result->formUrl` and `$result->formData` directly if you want to control the form page — custom loading state, styling, or analytics. The form data is already signed; do not modify `$result->formData` before rendering.

```php
$result = MyanmarPayments::driver('cyber_source')->initiate(new CyberSourcePaymentData(
    orderId: 'ORD-001',
    amount: 20000,
    callbackUrl: route('payment.callback'),
));

return view('payment.form', ['result' => $result]);
```

In your Blade view:

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
        // $result->orderId
    }
});
```

## RequestPaymentResult Reference

| Property | Type | Populated by |
|---|---|---|
| `status` | `PaymentStatus` | All methods |
| `redirectUrl` | `?string` | `initiate` — points to built-in form page |
| `formUrl` | `?string` | `initiate` — raw POST target |
| `formData` | `?array` | `initiate` — signed hidden field key/value pairs |
| `orderId` | `?string` | `handleCallback` |
| `raw` | `array` | All methods |
