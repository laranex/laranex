---
title: AYA Payment Gateway
description: Integrate AYA PGW with Laravel Myanmar Payments. Uses a form POST flow — use the built-in redirect or render the form yourself.
---

# AYA Payment Gateway

AYA PGW uses a form POST flow. The driver signs the request and returns both a `redirectUrl` (for the built-in form page) and the raw `formUrl`/`formData` if you prefer to render the form yourself.

:::info Callback URL
The callback URL for AYA PGW is configured in the AYA merchant portal — it is not passed in the payment request. `AyaPgwPaymentData` has no `callbackUrl` parameter.
:::

## Data Class

```php
use Laranex\LaravelMyanmarPayments\Data\AyaPgwPaymentData;

new AyaPgwPaymentData(
    orderId:      'ORD-001',      // required
    amount:       8000,           // required, in MMK (integer)
    channel:      'AYA_PAY',     // required
    method:       'WALLET',      // required
    currencyCode: 104,            // optional, 104 = MMK (default)
    frontendUrl:  'https://...',  // optional, redirect after payment
    description:  '',             // optional
    userRefs:     [],             // optional, up to 5 reference values
)
```

## Initiating a Payment

### Using the built-in form page (recommended)

Redirect to `$result->redirectUrl`. The package renders a hidden form and auto-submits it — no extra code needed on your end.

```php
use Laranex\LaravelMyanmarPayments\Data\AyaPgwPaymentData;
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

$result = MyanmarPayments::driver('aya_pgw')->initiate(new AyaPgwPaymentData(
    orderId: 'ORD-001',
    amount: 8000,
    channel: 'AYA_PAY',
    method: 'WALLET',
    frontendUrl: route('payment.success'),
));

return redirect($result->redirectUrl);
```

### Rendering the form yourself

Use `$result->formUrl` and `$result->formData` directly if you want to control the form page — custom loading state, styling, or analytics.

```php
$result = MyanmarPayments::driver('aya_pgw')->initiate(new AyaPgwPaymentData(
    orderId: 'ORD-001',
    amount: 8000,
    channel: 'AYA_PAY',
    method: 'WALLET',
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
| `orderId` | `?string` | `verify`, `handleCallback` |
| `raw` | `array` | All methods |
