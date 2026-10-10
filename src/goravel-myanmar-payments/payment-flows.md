---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result it returns. Each flow has its own result type with exactly the fields that flow needs.

| Result | What you do | Returned by |
|---|---|---|
| `*RedirectPayment` | Redirect the customer to `payment.URL` | `KbzPay()` → `PWA()`, `WaveMoney()` → `Initiate()` |
| `*FormPayment` | Redirect to `payments.AutoSubmitURL(form)` | `AyaPay()` → `Initiate()`, `CyberSource()` → `Initiate()` |
| `*QrPayment` | Show the QR to the customer | `KbzPay()` → `QR()`, `YomaMmqr()` → `Initiate()`, `RenewQR()` |
| `*AppPayment` | Return the signed payload to your mobile app | `KbzPay()` → `App()` |

The customer finishing on the gateway's side is never proof of payment. Fulfill orders from the verified [callback](/goravel-myanmar-payments/callbacks) or a status check.

Goravel's `http.Context` is a `context.Context`, so pass `ctx` straight to gateway calls that hit the network.

## Redirect Payments

Here is the flow with the KBZ Pay PWA; Wave Money works the same way with its own payment page.

<SequenceDiagram
  title="Redirect payment with the KBZ Pay PWA"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbz.PWA(ctx, data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type PWAAPP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: 'Redirect(http.StatusFound, payment.URL)', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to CallbackURL' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) KbzPay(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	payment, err := kbz.PWA(ctx, kbzpay.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		Amount:      myanmarpayments.Kyat(10000),
		CallbackURL: "https://shop.test/payments/kbz/callback",
	})
	if err != nil {
		return ctx.Response().String(http.StatusBadGateway, "%s", err)
	}

	return ctx.Response().Redirect(http.StatusFound, payment.URL)
}
```

`payment.GatewayReference` holds the gateway's ID for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

Here is the flow with AYA Pay; CyberSource works the same way with its hosted checkout.

<SequenceDiagram
  title="Form payment with AYA Pay"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Sign and encrypt the form', detail: 'aya.Initiate(data), payments.AutoSubmitURL(form)' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'encrypted, expires after ttl_minutes', response: true },
    { from: 'Customer', to: 'Your app', label: 'Open the auto-submit route', detail: 'GET myanmar-payments/form' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: '410 Gone once the link expires', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.HandleCallback(request)' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. The package hosts a page that renders the form and submits it immediately, so a redirect is enough:

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

aya, err := paymentsfacades.MyanmarPayments().AyaPay()
form, err := aya.Initiate(data)
link, err := payments.AutoSubmitURL(form)

return ctx.Response().Redirect(http.StatusFound, link)
```

The link is an encrypted, expiring link to the package's `myanmar-payments.form` route. See [Configuration](/goravel-myanmar-payments/configuration#auto-submit-form-route). The Go SDK has no auto-submit URL of its own, so the link is returned by `AutoSubmitURL` instead of being a field of the form.

To render the form yourself, for example with your own loading state, return `form.HTML()` or use `Action`, `Fields` and `Enctype`:

```go
import "github.com/goravel/framework/contracts/http"

html := []byte(form.HTML())

return ctx.Response().Data(http.StatusOK, "text/html; charset=utf-8", html)
```

```html
<form id="payment-form" method="POST" action="{{ .Action }}"
      enctype="{{ .Enctype }}">
    {{ range .Fields }}
        <input type="hidden" name="{{ .Name }}" value="{{ .Value }}">
    {{ end }}
</form>
<script>document.getElementById('payment-form').submit();</script>
```

Post the fields unchanged: they are signed. `Fields` is a slice in signing order; `form.Values()` returns them as a map and `form.Field(name)` reads one.

## QR Payments

Here is the flow with Yoma MMQR, whose QR expires after 120 seconds; a KBZ Pay QR follows the same steps without renewals.

<SequenceDiagram
  title="QR payment with Yoma MMQR"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yoma.Initiate(ctx, data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the first QR', detail: 'qr/generate' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'QR image and refLabel', detail: 'payable for 120 seconds', response: true },
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'payment.QRImageDataURI(mimeType)', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yoma.RenewQR(ctx, orderID)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.HandleCallback(request)' },
  ]"
/>

Gateways return QR codes in two shapes:

| Field | Gateway | Use it as |
|---|---|---|
| `QRString` | KBZ Pay | A payload: encode it into a QR image with any QR library |
| `QRImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `QRImageDataURI("")` |

```go
import (
	"html/template"

	"github.com/goravel/framework/contracts/http"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

yoma, err := paymentsfacades.MyanmarPayments().YomaMmqr()
payment, err := yoma.Initiate(ctx, data)

return ctx.Response().View().Make("payments/qr.tmpl", map[string]any{
	// template.URL keeps html/template from rejecting the data URI
	"qr":      template.URL(payment.QRImageDataURI("")),
	"expires": payment.ExpiresAt.Format("15:04:05"),
})
```

```html
<img src="{{ .qr }}" alt="Scan to pay">
<p>Valid until {{ .expires }}</p>
```

`ExpiresAt` is set when the gateway limits how long the QR is payable (the zero `time.Time` otherwise), and `Reference` holds the ID used for status checks (Yoma `refLabel`).

## App Payments

Here is the flow with the KBZ Pay mobile SDK.

<SequenceDiagram
  title="In-app payment with the KBZ Pay SDK"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Pay in your mobile app' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbz.App(ctx, data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'Json(http.StatusOK, payment)', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to CallbackURL' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. Return it to your app, which passes it to `KBZPay.startPay()`:

```go
import (
	"github.com/goravel/framework/contracts/http"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
payment, err := kbz.App(ctx, data)

// orderId, orderInfo, sign, signType (Raw is not encoded)
return ctx.Response().Json(http.StatusOK, payment)
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbz.Status()`.

See [Results](/goravel-myanmar-payments/references/results) for every field.
