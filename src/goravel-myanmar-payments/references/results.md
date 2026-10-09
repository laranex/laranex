---
title: Results
description: Field reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result types returned when a payment is started.
---

# Results

Starting a payment returns a pointer to one of four types in `github.com/laranex/go-myanmar-payments/v4` (imported as `myanmarpayments`). All implement `PaymentResult` and expose `Flow() PaymentFlow`.

## RedirectPayment

Returned by `KbzPay()` → `PWA()` and `WaveMoney()` → `Initiate()`.

| Field | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `URL` | `string` | The gateway page to redirect the customer to |
| `GatewayReference` | `string` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |

## FormPayment

Returned by `AyaPay()` → `Initiate()` and `CyberSource()` → `Initiate()`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `Action` | `string` | The gateway URL the form posts to |
| `Fields` | `[]FormField` | The signed hidden fields (`Name`, `Value`), in signing order. Post them unchanged |
| `Enctype` | `string` | The form encoding the gateway expects. Empty means `application/x-www-form-urlencoded` |
| `Field(name)` | `(string, bool)` | The value of one field |
| `Values()` | `map[string]string` | The fields as a map |
| `HTML()` | `string` | A full HTML page that posts the form on load |

`payments.AutoSubmitURL(form)` returns the link to the package's auto-submitting page; it returns `payments.ErrFormRouteDisabled` when the form route is disabled.

## QrPayment

Returned by `KbzPay()` → `QR()`, `YomaMmqr()` → `Initiate()` and `YomaMmqr()` → `RenewQR()`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `QRString` | `string` | A QR payload to encode yourself (KBZ Pay) |
| `QRImage` | `string` | A base64 image to display as is (Yoma MMQR) |
| `ExpiresAt` | `time.Time` | When the QR stops being payable. Zero when the gateway does not limit it |
| `Reference` | `string` | The gateway's ID for this QR (KBZ `prepay_id`, Yoma `refLabel`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |
| `QRImageDataURI(mimeType)` | `string` | `QRImage` as a data URI for `<img src>`. An empty `mimeType` means `image/png` |

## AppPayment

Returned by `KbzPay()` → `App()`.

| Field | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `OrderInfo` | `string` | The signed order string the SDK expects |
| `Sign` | `string` | The signature of `OrderInfo` |
| `SignType` | `string` | `SHA256` |
| `Raw` | `map[string]any` | The gateway's response, for logging |

Encoded as JSON, an `AppPayment` has `orderId`, `orderInfo`, `sign` and `signType` for your mobile app; `Raw` is left out.

## PaymentFlow

| Constant | Value | Result |
|---|---|---|
| `myanmarpayments.FlowRedirect` | `redirect` | `RedirectPayment` |
| `myanmarpayments.FlowForm` | `form` | `FormPayment` |
| `myanmarpayments.FlowQR` | `qr` | `QrPayment` |
| `myanmarpayments.FlowApp` | `app` | `AppPayment` |
