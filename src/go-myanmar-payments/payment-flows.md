---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: fill the gateway's `PaymentData`, call the gateway, then act on the typed result. Each flow has its own result type with exactly the fields that flow needs, and every result implements `myanmarpayments.PaymentResult` (`Flow() PaymentFlow`).

| Result | What you do | Returned by |
|---|---|---|
| `*RedirectPayment` | Redirect the customer to `payment.URL` | `kbzpay.PWA`, `wavemoney.Initiate` |
| `*FormPayment` | Write `payment.HTML()` | `ayapay.Initiate`, `cybersource.Initiate` |
| `*QrPayment` | Show the QR to the customer | `kbzpay.QR`, `yomammqr.Initiate`, `yomammqr.RenewQR` |
| `*AppPayment` | Return the signed payload to your mobile app | `kbzpay.App` |

Every method validates the payment data first and returns `*myanmarpayments.InvalidPaymentDataError` before any request is sent. The customer finishing on the gateway's side is never proof of payment: fulfill orders from the verified [callback](/go-myanmar-payments/callbacks) or a status check.

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
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: 'http.Redirect to payment.URL', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```go
payment, err := kbz.PWA(r.Context(), kbzpay.PaymentData{
	OrderID:     "ORDER_1",
	Amount:      myanmarpayments.Kyat(1000),
	CallbackURL: "https://shop.test/payments/kbz/callback",
})
if err != nil {
	// handle err
}
http.Redirect(w, r, payment.URL, http.StatusFound)
```

`payment.GatewayReference` holds the gateway's id for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

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
payment, err := aya.Initiate(data)
if err != nil {
	// handle err
}
w.Header().Set("Content-Type", "text/html; charset=utf-8")
io.WriteString(w, payment.HTML())
```

To build the form yourself, use `Action`, `Fields` (an ordered `[]FormField`) and `Enctype` with `html/template`:

```go
var form = template.Must(template.New("form").Parse(`
<form id="payment-form" method="POST" action="{{.Action}}" enctype="{{.Enctype}}">
  {{range .Fields}}<input type="hidden" name="{{.Name}}" value="{{.Value}}">{{end}}
</form>
<script>document.getElementById("payment-form").submit();</script>`))

form.Execute(w, payment)
```

Post the fields unchanged: they are signed. `payment.Field(name)` looks up one value and `payment.Values()` returns them as a map. AYA expects `multipart/form-data`, which `Enctype` carries.

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
| `QRString` | KBZ Pay | A payload: encode it into a QR image with any QR library |
| `QRImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `QRImageDataURI("")` |

```go
payment, err := yoma.Initiate(r.Context(), data)
if err != nil {
	// handle err
}
page.Execute(w, map[string]any{
	"QR":         template.URL(payment.QRImageDataURI("")), // "" means image/png
	"ValidUntil": payment.ExpiresAt.Format("15:04:05"),
})
```

`ExpiresAt` is set when the gateway limits how long the QR is payable (it is the zero `time.Time` otherwise), and `Reference` holds the id used for status checks (Yoma `refLabel`, KBZ `prepay_id`).

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
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. `AppPayment` has JSON tags, so return it to your app as is; the app passes the values to `KBZPay.startPay()`:

```go
payment, err := kbz.App(r.Context(), data)
if err != nil {
	// handle err
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(payment) // {"orderId", "orderInfo", "sign", "signType"}
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbz.Status`.

See [Results](/go-myanmar-payments/references/results) for every field.
