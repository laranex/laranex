---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result. Each flow has its own result class with exactly the fields that flow needs, and every result implements `PaymentResult`, whose `flow()` returns a `PaymentFlow` (`Redirect`, `Form`, `Qr` or `App`), so a `match` or `instanceof` check tells them apart.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `$payment->url` | `$kbz->pwa()`, `$wave->initiate()` |
| `FormPayment` | Echo `$payment->toHtml()` | `$aya->initiate()`, `$cs->initiate()` |
| `QrPayment` | Show the QR to the customer | `$kbz->qr()`, `$yoma->initiate()`, `$yoma->renewQr()` |
| `AppPayment` | Return the signed payload to your mobile app | `$kbz->app()` |

Every payment data class validates its values when you create it and throws `InvalidPaymentDataException` before any request is sent, so building the data object is how you check a request early, e.g. while handling a form. `$data->validate()` runs the same checks again. The customer finishing on the gateway's side is never proof of payment: fulfill orders from the verified [callback](/php-myanmar-payments/callbacks) or a status check.

The samples on this page and the gateway pages are plain PHP scripts; [Framework Integration](/php-myanmar-payments/framework-integration) shows Symfony and PSR-15 handlers.

## Redirect Payments

Here is the flow with the KBZ Pay PWA; Wave Money works the same way with its own payment page.

<SequenceDiagram
  title="Redirect payment with the KBZ Pay PWA"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: '$kbz->pwa($data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type PWAAPP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: '302 to $payment->url', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$kbz->handleCallback($request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$data = new KbzPayPaymentData(
    orderId: 'ORDER_1',
    amount: 10000,
    callbackUrl: 'https://shop.test/payments/kbz/callback',
);
$payment = $kbz->pwa($data);

header('Location: '.$payment->url);
exit;
```

`$payment->gatewayReference` holds the gateway's ID for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

Here is the flow with AYA Pay; CyberSource works the same way with its hosted checkout.

<SequenceDiagram
  title="Form payment with AYA Pay"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Sign the form, no API call', detail: '$aya->initiate($data)' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: 'echo $payment->toHtml()', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$aya->handleCallback($request)' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. `toHtml()` returns a complete page that submits the form as soon as it loads, with every value escaped:

```php
// no network call: it only signs
$payment = $aya->initiate($data);

header('Content-Type: text/html; charset=UTF-8');
echo $payment->toHtml();
```

To build the form yourself, use `action`, `fields` (an array of name => value, in order) and `enctype` with your template engine, and escape every value:

```php
<form id="payment-form" method="POST"
      action="<?= htmlspecialchars($payment->action) ?>"
      enctype="<?= htmlspecialchars($payment->enctype) ?>">
    <?php foreach ($payment->fields as $name => $value): ?>
        <input type="hidden"
               name="<?= htmlspecialchars($name) ?>"
               value="<?= htmlspecialchars($value) ?>">
    <?php endforeach ?>
</form>
```

Post the fields unchanged: they are signed. `$payment->fields['merchOrderId']` looks up one value. AYA expects `multipart/form-data`, which `enctype` carries.

`autoSubmitUrl` is `null` outside Laravel. If you host your own page that renders the form, attach its URL with `$payment->withAutoSubmitUrl($url)`, which returns a new `FormPayment`.

## QR Payments

Here is the flow with Yoma MMQR, whose QR expires after 120 seconds; a KBZ Pay QR follows the same steps without renewals.

<SequenceDiagram
  title="QR payment with Yoma MMQR"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: '$yoma->initiate($data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the first QR', detail: 'qr/generate' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'QR image and refLabel', detail: 'payable for 120 seconds', response: true },
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'qrImage, a base64 PNG', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: '$yoma->renewQr($orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$yoma->handleCallback($request)' },
  ]"
/>

Gateways return QR codes in two shapes:

| Property | Gateway | Use it as |
|---|---|---|
| `qrString` | KBZ Pay | A payload: encode it into a QR image with any QR library, e.g. `endroid/qr-code` |
| `qrImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `qrImageDataUri()` |

```php
$payment = $yoma->initiate($data);
?>
<img src="<?= htmlspecialchars($payment->qrImageDataUri()) ?>"
     alt="Scan to pay">
<p>Payable until <?= $payment->expiresAt?->format('H:i:s') ?></p>
```

`expiresAt` is a `DateTimeImmutable` when the gateway limits how long the QR is payable (`null` otherwise), and `reference` holds the ID used for status checks (Yoma `refLabel`, KBZ `prepay_id`).

## App Payments

Here is the flow with the KBZ Pay mobile SDK.

<SequenceDiagram
  title="In-app payment with the KBZ Pay SDK"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Pay in your mobile app' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: '$kbz->app($data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'json_encode($payment->toArray())', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$kbz->handleCallback($request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. `AppPayment::toArray()` returns the values with the SDK's names, so return it to your app as JSON; the app passes the values to `KBZPay.startPay()`:

```php
$payment = $kbz->app($data);

header('Content-Type: application/json');
// {"orderId", "orderInfo", "sign", "signType"}
echo json_encode($payment->toArray());
```

The SDK's own result only means the payment screen closed; rely on the callback or `$kbz->status()`.

## Handling Any Result

```php
use Laranex\PhpMyanmarPayments\Results\AppPayment;
use Laranex\PhpMyanmarPayments\Results\FormPayment;
use Laranex\PhpMyanmarPayments\Results\PaymentResult;
use Laranex\PhpMyanmarPayments\Results\QrPayment;
use Laranex\PhpMyanmarPayments\Results\RedirectPayment;

function respond(PaymentResult $payment): void
{
    match (true) {
        $payment instanceof RedirectPayment
            => header('Location: '.$payment->url),
        $payment instanceof FormPayment => print $payment->toHtml(),
        $payment instanceof QrPayment
            => print $payment->qrImageDataUri() ?? $payment->qrString,
        $payment instanceof AppPayment
            => print json_encode($payment->toArray()),
    };
}
```

See [Results](/php-myanmar-payments/references/results) for every property.
