---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result. Each flow has its own result class with exactly the fields that flow needs, and every result has a `flow` class attribute (`PaymentFlow.REDIRECT`, `FORM`, `QR` or `APP`), so a `match` statement or `isinstance` check tells them apart.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `payment.url` | `kbz.pwa`, `wave.initiate` |
| `FormPayment` | Return `payment.to_html()` | `aya.initiate`, `cs.initiate` |
| `QrPayment` | Show the QR to the customer | `kbz.qr`, `yoma.initiate`, `yoma.renew_qr` |
| `AppPayment` | Return the signed payload to your mobile app | `kbz.app` |

Every method validates the payment data first and raises `InvalidPaymentDataError` before any request is sent. The customer finishing on the gateway's side is never proof of payment: fulfill orders from the verified [callback](/python-myanmar-payments/callbacks) or a status check.

The samples on this page and the gateway pages are Django views using the sync classes; [Framework Integration](/python-myanmar-payments/framework-integration) shows Flask and FastAPI, and the async classes take the same calls with `await`.

## Redirect Payments

Here is the flow with the KBZ Pay PWA; Wave Money works the same way with its own payment page.

<SequenceDiagram
  title="Redirect payment with the KBZ Pay PWA"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbz.pwa(data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type PWAAPP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: '302 to payment.url', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callback_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handle_callback(request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```python
from django.shortcuts import redirect
from python_myanmar_payments import Amount, KbzPay, KbzPayPaymentData

kbz = KbzPay.from_env()


def checkout(request):
    data = KbzPayPaymentData(
        order_id="ORDER_1",
        amount=Amount.kyat(1000),
        callback_url="https://shop.test/payments/kbz/callback",
    )
    payment = kbz.pwa(data)
    return redirect(payment.url)
```

`payment.gateway_reference` holds the gateway's ID for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

Here is the flow with AYA Pay; CyberSource works the same way with its hosted checkout.

<SequenceDiagram
  title="Form payment with AYA Pay"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Sign the form, no API call', detail: 'aya.initiate(data)' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: 'HttpResponse(payment.to_html())', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.handle_callback(request)' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. `to_html()` returns a complete page that submits the form as soon as it loads, with every value escaped:

```python
from django.http import HttpResponse


def aya_checkout(request):
    # no network call: never awaited, on AsyncAyaPay too
    payment = aya.initiate(data)
    return HttpResponse(payment.to_html())
```

To build the form yourself, use `action`, `fields` (a tuple of `FormField(name, value)`) and `enctype` with your template engine, which escapes every value:

```html
<form id="payment-form" method="POST"
      action="{{ payment.action }}" enctype="{{ payment.enctype }}">
  {% for field in payment.fields %}
    <input type="hidden" name="{{ field.name }}" value="{{ field.value }}">
  {% endfor %}
</form>
```

Post the fields unchanged: they are signed. `payment.field(name)` looks up one value and `payment.values()` returns them as a `dict`. AYA expects `multipart/form-data`, which `enctype` carries.

## QR Payments

Here is the flow with Yoma MMQR, whose QR expires after 120 seconds; a KBZ Pay QR follows the same steps without renewals.

<SequenceDiagram
  title="QR payment with Yoma MMQR"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yoma.initiate(data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the first QR', detail: 'qr/generate' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'QR image and refLabel', detail: 'payable for 120 seconds', response: true },
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'qr_image, a base64 PNG', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yoma.renew_qr(order_id)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.handle_callback(request)' },
  ]"
/>

Gateways return QR codes in two shapes:

| Field | Gateway | Use it as |
|---|---|---|
| `qr_string` | KBZ Pay | A payload: encode it into a QR image with any QR library, e.g. `qrcode` or `segno` |
| `qr_image` | Yoma MMQR | A base64 image: display it as is, e.g. with `qr_image_data_uri()` |

```python
from django.shortcuts import render


def yoma_checkout(request):
    payment = yoma.initiate(data)
    return render(request, "pay.html", {"payment": payment})
```

```html
<img src="{{ payment.qr_image_data_uri }}" alt="Scan to pay">
<p>Payable until {{ payment.expires_at|time:"H:i:s" }}</p>
```

`expires_at` is an aware UTC `datetime` when the gateway limits how long the QR is payable (`None` otherwise), and `reference` holds the ID used for status checks (Yoma `refLabel`, KBZ `prepay_id`).

## App Payments

Here is the flow with the KBZ Pay mobile SDK.

<SequenceDiagram
  title="In-app payment with the KBZ Pay SDK"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Pay in your mobile app' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbz.app(data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'JsonResponse(payment.to_dict())', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callback_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handle_callback(request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. `AppPayment.to_dict()` returns the values with the SDK's names, so return it to your app as JSON; the app passes the values to `KBZPay.startPay()`:

```python
from django.http import JsonResponse


def kbz_app_checkout(request):
    payment = kbz.app(data)
    # {"orderId", "orderInfo", "sign", "signType"}
    return JsonResponse(payment.to_dict())
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbz.status()`.

## Handling Any Result

```python
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from python_myanmar_payments import (
    AppPayment,
    FormPayment,
    PaymentResult,
    QrPayment,
    RedirectPayment,
)


def respond(payment: PaymentResult) -> HttpResponse:
    match payment:
        case RedirectPayment():
            return redirect(payment.url)
        case FormPayment():
            return HttpResponse(payment.to_html())
        case QrPayment():
            qr = payment.qr_image_data_uri() or payment.qr_string
            return HttpResponse(qr)
        case AppPayment():
            return JsonResponse(payment.to_dict())
```

See [Results](/python-myanmar-payments/references/results) for every field.
