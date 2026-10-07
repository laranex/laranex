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

Every method validates the payment data first and returns `*myanmarpayments.InvalidPaymentDataError` before any request is sent. The customer finishing on the gateway's side is never proof of payment: fulfil orders from the verified [callback](/go-myanmar-payments/callbacks) or a status check.

## Redirect Payments

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
