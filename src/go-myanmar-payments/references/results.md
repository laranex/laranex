---
title: Results
description: Field reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result types returned when a payment is started.
---

# Results

Starting a payment returns a pointer to one of four structs from the root package `myanmarpayments`. Each implements `PaymentResult`, whose `Flow()` method returns a `PaymentFlow`, so a type switch or `Flow()` tells them apart. Fields a gateway did not provide are `""`.

## RedirectPayment

Returned by `kbz.PWA()` and `wave.Initiate()`.

| Field / Method | Type | Description |
|---|---|---|
| `Flow()` | `PaymentFlow` | `FlowRedirect` |
| `OrderID` | `string` | Your order ID, as sent to the gateway |
| `URL` | `string` | The gateway page to redirect the customer to |
| `GatewayReference` | `string` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |

## FormPayment

Returned by `aya.Initiate()` and `cs.Initiate()`.

| Field / Method | Type | Description |
|---|---|---|
| `Flow()` | `PaymentFlow` | `FlowForm` |
| `OrderID` | `string` | Your order ID |
| `Action` | `string` | The gateway URL the form posts to |
| `Fields` | `[]FormField` | The signed hidden fields in order. Post them unchanged |
| `Enctype` | `string` | The encoding the gateway expects: `multipart/form-data` (AYA) or `application/x-www-form-urlencoded` (CyberSource) |
| `HTML()` | `string` | A complete page that submits the form on load. Every value is HTML-escaped (`"` as `&#34;`, `'` as `&#39;`), so the page is byte-for-byte the same in every Laranex SDK |
| `Field(name)` | `(string, bool)` | One field's value |
| `Values()` | `map[string]string` | The fields as a map |

`FormField` is a struct with `Name string` and `Value string`.

## QrPayment

Returned by `kbz.QR()`, `yoma.Initiate()` and `yoma.RenewQR()`.

| Field / Method | Type | Description |
|---|---|---|
| `Flow()` | `PaymentFlow` | `FlowQR` |
| `OrderID` | `string` | Your order ID |
| `QRString` | `string` | A QR payload to encode yourself (KBZ Pay) |
| `QRImage` | `string` | A base64 image to display as is (Yoma MMQR) |
| `ExpiresAt` | `time.Time` | When the QR stops being payable; the zero time when the gateway sets no limit |
| `Reference` | `string` | The gateway's ID for this QR, used for status checks (Yoma `refLabel`, KBZ `prepay_id`) |
| `Raw` | `map[string]any` | The gateway's response, for logging |
| `QRImageDataURI(mimeType)` | `string` | `QRImage` as a data URI; `""` as `mimeType` means `image/png`. `""` when there is no image |

## AppPayment

Returned by `kbz.App()`. It encodes to JSON as `orderId`, `orderInfo`, `sign` and `signType`, the names the KBZ Pay SDK uses.

| Field / Method | Type | Description |
|---|---|---|
| `Flow()` | `PaymentFlow` | `FlowApp` |
| `OrderID` | `string` | Your order ID |
| `OrderInfo` | `string` | The signed order string the SDK expects |
| `Sign` | `string` | The signature of `OrderInfo` |
| `SignType` | `string` | The signature algorithm, `SHA256` |
| `Raw` | `map[string]any` | The gateway's response; left out of the JSON encoding |

## PaymentFlow

A `string` type, so `payment.Flow() == "redirect"` works too.

| Constant | Value | Type |
|---|---|---|
| `FlowRedirect` | `redirect` | `RedirectPayment` |
| `FlowForm` | `form` | `FormPayment` |
| `FlowQR` | `qr` | `QrPayment` |
| `FlowApp` | `app` | `AppPayment` |

`Raw` values are decoded JSON: numbers are `json.Number`, never a `float64`. Use `json.Marshal(payment.Raw)` to log them.

Every result type is a plain struct, so you can build one in your own tests, e.g. `&myanmarpayments.RedirectPayment{OrderID: "ORDER_1", URL: "https://…"}`.
