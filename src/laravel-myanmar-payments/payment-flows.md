---
title: Payment Flows
description: How each payment flow works and what RequestPaymentResult returns for each.
---

# Payment Flows

All payment flows share the same lifecycle: initiate the payment, the customer completes it on the gateway's side, then your app receives a callback.

## Redirect-Based

**Drivers:** `wave_money`, `kbzpay.pwa`

The driver calls the gateway API and receives a URL. Redirect the customer there — the gateway hosts its own payment page and handles the entire checkout.

```php
$result = MyanmarPayments::driver('wave_money')->initiate($data);

return redirect($result->value); // gateway URL
```

`flow` is `PaymentFlow::RedirectBased`. See [RequestPaymentResult](/laravel-myanmar-payments/references/request-payment-result) for all properties.

## Form-Based

**Drivers:** `aya_pgw`, `cyber_source`

The driver signs a set of fields and returns a `value` URL pointing to the package's built-in Blade page, which renders a hidden form and auto-submits it to the gateway. The customer is forwarded transparently.

```php
$result = MyanmarPayments::driver('aya_pgw')->initiate($data);

return redirect($result->value); // package's auto-submit form page
```

If you need full control over the form — custom styling or a loading state — build it yourself using `originalValue`:

```php
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

`flow` is `PaymentFlow::FormBased`. See [RequestPaymentResult](/laravel-myanmar-payments/references/request-payment-result) for all properties.

## QR-Based

**Drivers:** `kbzpay.qr`

The driver calls the gateway API and receives a QR code string. Display it as a scannable image in your UI — the customer opens their KBZ Pay app and scans it to complete the payment.

```php
$result = MyanmarPayments::driver('kbzpay.qr')->initiate($data);

// render $result->value as a QR image — use any QR library
return view('payment.qr', ['qrCode' => $result->value]);
```

`flow` is `PaymentFlow::QrBased`. See [RequestPaymentResult](/laravel-myanmar-payments/references/request-payment-result) for all properties.

## App-Based

**Drivers:** `kbzpay.app`

The driver signs the payment parameters and returns the payload your mobile app needs to launch the in-app KBZ Pay flow. Return it as JSON to your app — no redirect or page transition happens on the web side.

```php
$result = MyanmarPayments::driver('kbzpay.app')->initiate($data);

return response()->json($result->value); // signed payload for the KBZ Pay mobile SDK
```

`flow` is `PaymentFlow::AppBased`. See [RequestPaymentResult](/laravel-myanmar-payments/references/request-payment-result) for all properties.
