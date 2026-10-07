---
title: Results
description: Field reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result types returned when a payment is started.
---

# Results

Starting a payment returns one of four types from the root package `myanmarpayments`. All implement `PaymentResult`, whose `Flow()` returns a `PaymentFlow`.

## RedirectPayment

Returned by `kbzpay.PWA` and `wavemoney.Initiate`.

| Field | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id, as sent to the gateway |
| `URL` | `string` | The gateway page to redirect the customer to |
| `GatewayReference` | `string` | The gateway's id for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |

## FormPayment

Returned by `ayapay.Initiate` and `cybersource.Initiate`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id |
| `Action` | `string` | The gateway URL the form posts to |
| `Fields` | `[]FormField` | The signed hidden fields (`Name`, `Value`) in order. Post them unchanged |
| `Enctype` | `string` | The encoding the gateway expects; empty means `application/x-www-form-urlencoded` |
| `HTML()` | `string` | A complete, escaped page that submits the form on load |
| `Field(name)` | `(string, bool)` | One field's value |
| `Values()` | `map[string]string` | The fields as a map |

## QrPayment

Returned by `kbzpay.QR`, `yomammqr.Initiate` and `yomammqr.RenewQR`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id |
| `QRString` | `string` | A QR payload to encode yourself (KBZ Pay) |
| `QRImage` | `string` | A base64 image to display as is (Yoma MMQR) |
| `ExpiresAt` | `time.Time` | When the QR stops being payable; zero when the gateway sets no limit |
| `Reference` | `string` | The gateway's id for this QR, used for status checks (Yoma `refLabel`, KBZ `prepay_id`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |
| `QRImageDataURI(mimeType)` | `string` | `QRImage` as a data URI; `""` means `image/png`. Empty when there is no image |

## AppPayment

Returned by `kbzpay.App`. Encodes to JSON as `orderId`, `orderInfo`, `sign`, `signType`.

| Field | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id |
| `OrderInfo` | `string` | The signed order string the SDK expects |
| `Sign` | `string` | The signature of `OrderInfo` |
| `SignType` | `string` | The signature algorithm, `SHA256` |
| `Raw` | `map[string]any` | The gateway's response; not encoded to JSON |

## PaymentFlow

| Constant | Value | Type |
|---|---|---|
| `FlowRedirect` | `redirect` | `RedirectPayment` |
| `FlowForm` | `form` | `FormPayment` |
| `FlowQR` | `qr` | `QrPayment` |
| `FlowApp` | `app` | `AppPayment` |
