---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result. Each flow has its own result type with exactly the fields that flow needs, and every result implements `myanmarpayments.PaymentResult`, whose `Flow()` returns `FlowRedirect`, `FlowForm`, `FlowQR` or `FlowApp`, so a type switch tells them apart.

| Result | What you do | Returned by |
|---|---|---|
| `*RedirectPayment` | Redirect the customer to `payment.URL` | `kbz.PWA`, `wave.Initiate` |
| `*FormPayment` | Write `payment.HTML()` | `aya.Initiate`, `cs.Initiate` |
| `*QrPayment` | Show the QR to the customer | `kbz.QR`, `yoma.Initiate`, `yoma.RenewQR` |
| `*AppPayment` | Return the signed payload to your mobile app | `kbz.App` |

Every method validates the payment data first and returns `*myanmarpayments.InvalidPaymentDataError` before any request is sent. Call `data.Validate()` yourself to check a request earlier, e.g. while handling a form. The customer finishing on the gateway's side is never proof of payment: fulfill orders from the verified [callback](/go-myanmar-payments/callbacks) or a status check.

The samples on this page and the gateway pages are `net/http` handlers; [Framework Integration](/go-myanmar-payments/framework-integration) shows chi, Gin and Echo.

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
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: '302 to payment.URL', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to CallbackURL' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```go
func checkout(w http.ResponseWriter, r *http.Request) {
	payment, err := kbz.PWA(r.Context(), kbzpay.PaymentData{
		OrderID:     "ORDER_1",
		Amount:      myanmarpayments.Kyat(10000),
		CallbackURL: "https://shop.test/payments/kbz/callback",
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	http.Redirect(w, r, payment.URL, http.StatusFound)
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
    { from: 'Your app', to: 'Your app', label: 'Sign the form, no API call', detail: 'aya.Initiate(data)' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: 'io.WriteString(w, payment.HTML())', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.HandleCallback(request)' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. `HTML()` returns a complete page that submits the form as soon as it loads, with every value escaped:

```go
func ayaCheckout(w http.ResponseWriter, r *http.Request) {
	// no network call, so no context
	payment, err := aya.Initiate(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnprocessableEntity)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.WriteString(w, payment.HTML())
}
```

To build the form yourself, use `Action`, `Fields` (an ordered `[]FormField`) and `Enctype` with `html/template`, which escapes every value:

```go
var form = template.Must(template.New("form").Parse(`
<form id="payment-form" method="POST"
      action="{{.Action}}" enctype="{{.Enctype}}">
  {{range .Fields}}
    <input type="hidden" name="{{.Name}}" value="{{.Value}}">
  {{end}}
</form>`))

form.Execute(w, payment)
```

Post the fields unchanged: they are signed. `payment.Field(name)` looks up one value and `payment.Values()` returns them as a `map[string]string`. AYA expects `multipart/form-data`, which `Enctype` carries.

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
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'QRImage, a base64 PNG', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yoma.RenewQR(ctx, orderID)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.HandleCallback(request)' },
  ]"
/>

Gateways return QR codes in two shapes:

| Field | Gateway | Use it as |
|---|---|---|
| `QRString` | KBZ Pay | A payload: encode it into a QR image with any QR library, e.g. `skip2/go-qrcode` |
| `QRImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `QRImageDataURI("")` |

```go
func yomaCheckout(w http.ResponseWriter, r *http.Request) {
	payment, err := yoma.Initiate(r.Context(), data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	page.Execute(w, payment)
}
```

```html
<img src="{{.QRImageDataURI ""}}" alt="Scan to pay">
<p>Payable until {{.ExpiresAt.Format "15:04:05"}}</p>
```

`ExpiresAt` is a `time.Time` when the gateway limits how long the QR is payable (the zero time otherwise), and `Reference` holds the ID used for status checks (Yoma `refLabel`, KBZ `prepay_id`).

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
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'json.NewEncoder(w).Encode(payment)', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to CallbackURL' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. `AppPayment` encodes to JSON with the SDK's names, so return it to your app as is; the app passes the values to `KBZPay.startPay()`:

```go
func kbzAppCheckout(w http.ResponseWriter, r *http.Request) {
	payment, err := kbz.App(r.Context(), data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	// {"orderId", "orderInfo", "sign", "signType"}
	json.NewEncoder(w).Encode(payment)
}
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbz.Status`.

## Handling Any Result

```go
package shop

import (
	"encoding/json"
	"io"
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

func respond(
	w http.ResponseWriter,
	r *http.Request,
	payment myanmarpayments.PaymentResult,
) {
	switch payment := payment.(type) {
	case *myanmarpayments.RedirectPayment:
		http.Redirect(w, r, payment.URL, http.StatusFound)
	case *myanmarpayments.FormPayment:
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.WriteString(w, payment.HTML())
	case *myanmarpayments.QrPayment:
		qr := payment.QRImageDataURI("")
		if qr == "" {
			qr = payment.QRString
		}
		io.WriteString(w, qr)
	case *myanmarpayments.AppPayment:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(payment)
	}
}
```

See [Results](/go-myanmar-payments/references/results) for every field.
