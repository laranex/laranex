---
title: Payment Flows
description: Each gateway method returns one typed result class per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's request object, call the gateway, then act on the typed result it returns. Each flow has its own result class with exactly the fields that flow needs.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `$payment->url` | `kbzPay()->pwa()`, `waveMoney()->initiate()` |
| `FormPayment` | Redirect to `$payment->autoSubmitUrl` | `ayaPay()->initiate()`, `cyberSource()->initiate()` |
| `QrPayment` | Show the QR to the customer | `kbzPay()->qr()`, `yomaMmqr()->initiate()`, `yomaMmqr()->renewQr()` |
| `AppPayment` | Return the signed payload to your mobile app | `kbzPay()->app()` |

The customer finishing on the gateway's side is never proof of payment. Fulfil orders from the verified [callback](/laravel-myanmar-payments/callbacks) or a status check.

## Redirect Payments

The gateway hosts its own payment page. Send the customer there.

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$payment = MyanmarPayments::kbzPay()->pwa(new KbzPayPaymentData(
    orderId: 'ORDER_1',
    amount: 1000,
    callbackUrl: route('payments.kbz.callback'),
));

return redirect()->away($payment->url);
```

`$payment->gatewayReference` holds the gateway's id for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

The gateway expects the customer's browser to POST a signed form. The package hosts a page that renders the form and submits it immediately, so a redirect is enough:

```php
$payment = MyanmarPayments::ayaPay()->initiate($data);

return redirect($payment->autoSubmitUrl);
```

`autoSubmitUrl` is an encrypted, expiring link to the package's `myanmar-payments.form` route. See [Configuration](/laravel-myanmar-payments/configuration#auto-submit-form-route).

To render the form yourself, for example with your own loading state, return `toHtml()` or use `action`, `fields` and `enctype`:

```php
return response($payment->toHtml());
```

```blade
<form id="payment-form" method="POST" action="{{ $payment->action }}" enctype="{{ $payment->enctype }}">
    @foreach ($payment->fields as $name => $value)
        <input type="hidden" name="{{ $name }}" value="{{ $value }}">
    @endforeach
</form>
<script>document.getElementById('payment-form').submit();</script>
```

Post the fields unchanged: they are signed.

## QR Payments

Gateways return QR codes in two shapes:

| Property | Gateway | Use it as |
|---|---|---|
| `qrString` | KBZ Pay | A payload: encode it into a QR image with any QR library |
| `qrImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `qrImageDataUri()` |

```php
$payment = MyanmarPayments::yomaMmqr()->initiate($data);
```

```blade
<img src="{{ $payment->qrImageDataUri() }}" alt="Scan to pay">
<p>Valid until {{ $payment->expiresAt?->format('H:i:s') }}</p>
```

`expiresAt` is set when the gateway limits how long the QR is payable, and `reference` holds the id used for status checks (Yoma `refLabel`).

## App Payments

The KBZ Pay mobile SDK needs a signed order string. Return it to your app, which passes it to `KBZPay.startPay()`:

```php
$payment = MyanmarPayments::kbzPay()->app($data);

return response()->json($payment->toArray()); // orderId, orderInfo, sign, signType
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbzPay()->status()`.

See [Results](/laravel-myanmar-payments/references/results) for every property.
