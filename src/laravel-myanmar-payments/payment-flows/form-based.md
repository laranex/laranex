---
title: Form-Based Flow
description: RequestPaymentResult reference for form-based payment flows in Laravel Myanmar Payments.
---

# Form-Based Flow

**Drivers:** AYA PGW, CyberSource

These gateways require a signed POST form rather than a plain redirect. The driver signs the fields and returns a `value` URL pointing to the package's built-in Blade page, which renders a hidden form and auto-submits it. The customer is forwarded transparently. When the payment completes, the gateway POSTs the result to your `callbackUrl`. If you need full control over the form — custom styling or a loading state — use `originalValue` directly to build the form yourself.

```php
$result = MyanmarPayments::driver('aya_pgw')->initiate($data);

// let the package handle it
return redirect($result->value);

// or render the form yourself
return view('payment.form', [
    'formUrl'    => $result->originalValue['url'],
    'formFields' => $result->originalValue['data'],
]);
```

```blade
<form id="payment-form" method="POST" action="{{ $formUrl }}">
    @foreach ($formFields as $key => $value)
        <input type="hidden" name="{{ $key }}" value="{{ $value }}">
    @endforeach
</form>
<script>document.getElementById('payment-form').submit();</script>
```

| Property | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow::FormBased` | Identifies the flow type |
| `value` | `string` | URL to the package's auto-submit form page |
| `originalValue` | `array` | `['url' => string, 'data' => array]` — raw form target and signed fields |
| `transactionId` | `string` | Your order/transaction identifier |
| `raw` | `array` | Signed field set sent to the gateway |
