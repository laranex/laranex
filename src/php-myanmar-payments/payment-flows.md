---
title: Payment Flows
description: Each gateway method returns one typed result class per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's request object, call the gateway, then act on the typed result it returns. Each flow has its own result class with exactly the fields that flow needs.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `$payment->url` | `KbzPay::pwa()`, `WaveMoney::initiate()` |
| `FormPayment` | Echo `$payment->toHtml()` | `AyaPay::initiate()`, `CyberSource::initiate()` |
| `QrPayment` | Show the QR to the customer | `KbzPay::qr()`, `YomaMmqr::initiate()`, `YomaMmqr::renewQr()` |
| `AppPayment` | Return the signed payload to your mobile app | `KbzPay::app()` |

The customer finishing on the gateway's side is never proof of payment. Fulfil orders from the verified [callback](/php-myanmar-payments/callbacks) or a status check.

## Redirect Payments

The gateway hosts its own payment page. Send the customer there.

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$payment = $kbzPay->pwa(new KbzPayPaymentData(
    orderId: 'ORDER_1',
    amount: 1000,
    callbackUrl: 'https://shop.test/kbz/callback.php',
));

header('Location: '.$payment->url);
exit;
```

`$payment->gatewayReference` holds the gateway's id for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

The gateway expects the customer's browser to POST a signed form. `toHtml()` returns a complete page that submits the form as soon as it loads, with every value escaped:

```php
$payment = $ayaPay->initiate($data);

header('Content-Type: text/html; charset=UTF-8');
echo $payment->toHtml();
```

To build the form yourself, for example with your own loading state, use `action`, `fields` and `enctype`:

```php
<form id="payment-form" method="POST" action="<?= htmlspecialchars($payment->action) ?>" enctype="<?= htmlspecialchars($payment->enctype) ?>">
    <?php foreach ($payment->fields as $name => $value): ?>
        <input type="hidden" name="<?= htmlspecialchars($name) ?>" value="<?= htmlspecialchars($value) ?>">
    <?php endforeach ?>
</form>
<script>document.getElementById('payment-form').submit();</script>
```

Post the fields unchanged: they are signed.

`autoSubmitUrl` is `null` outside Laravel. If you host your own page that renders the form, attach its URL with `$payment->withAutoSubmitUrl($url)`, which returns a new `FormPayment`.

## QR Payments

Gateways return QR codes in two shapes:

| Property | Gateway | Use it as |
|---|---|---|
| `qrString` | KBZ Pay | A payload: encode it into a QR image with any QR library |
| `qrImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `qrImageDataUri()` |

```php
$payment = $yomaMmqr->initiate($data);
?>
<img src="<?= htmlspecialchars($payment->qrImageDataUri()) ?>" alt="Scan to pay">
<p>Valid until <?= $payment->expiresAt?->format('H:i:s') ?></p>
```

`expiresAt` is set when the gateway limits how long the QR is payable, and `reference` holds the id used for status checks (Yoma `refLabel`).

## App Payments

The KBZ Pay mobile SDK needs a signed order string. Return it to your app, which passes it to `KBZPay.startPay()`:

```php
$payment = $kbzPay->app($data);

header('Content-Type: application/json');
echo json_encode($payment->toArray()); // orderId, orderInfo, sign, signType
```

The SDK's own result only means the payment screen closed; rely on the callback or `$kbzPay->status()`.

See [Results](/php-myanmar-payments/references/results) for every property.
