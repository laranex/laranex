---
title: Results
description: Property reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result classes returned when a payment is started.
---

# Results

Starting a payment returns one of four classes in `Laranex\PhpMyanmarPayments\Results`. All implement `PaymentResult` and expose `flow(): PaymentFlow`.

## RedirectPayment

Returned by `kbzPay()->pwa()` and `waveMoney()->initiate()`.

| Property | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `url` | `string` | The gateway page to redirect the customer to |
| `gatewayReference` | `?string` | The gateway's id for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `raw` | `array` | The gateway's response, for logging |

## FormPayment

Returned by `ayaPay()->initiate()` and `cyberSource()->initiate()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `action` | `string` | The gateway URL the form posts to |
| `fields` | `array<string, string>` | The signed hidden fields. Post them unchanged |
| `enctype` | `string` | The form encoding the gateway expects |
| `field($name)` | `?string` | The value of one field |
| `values()` | `array<string, string>` | The fields as an array, e.g. for your own template |
| `autoSubmitUrl` | `?string` | Link to the package's auto-submitting page. `null` when the form route is disabled |
| `withAutoSubmitUrl($url)` | `FormPayment` | A copy with `autoSubmitUrl` set |
| `toHtml()` | `string` | A full HTML page that posts the form on load |

## QrPayment

Returned by `kbzPay()->qr()`, `yomaMmqr()->initiate()` and `yomaMmqr()->renewQr()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `qrString` | `?string` | A QR payload to encode yourself (KBZ Pay) |
| `qrImage` | `?string` | A base64 image to display as is (Yoma MMQR) |
| `expiresAt` | `?DateTimeImmutable` | When the QR stops being payable |
| `reference` | `?string` | The gateway's id for this QR (KBZ `prepay_id`, Yoma `refLabel`) |
| `raw` | `array` | The gateway's response, for logging |
| `qrImageDataUri($mimeType = 'image/png')` | `?string` | `qrImage` as a data URI for `<img src>` |

## AppPayment

Returned by `kbzPay()->app()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `orderInfo` | `string` | The signed order string the SDK expects |
| `sign` | `string` | The signature of `orderInfo` |
| `signType` | `string` | `SHA256` |
| `raw` | `array` | The gateway's response, for logging |
| `toArray()` | `array` | `orderId`, `orderInfo`, `sign`, `signType` for your mobile app |

## PaymentFlow

| Case | Value | Result |
|---|---|---|
| `PaymentFlow::Redirect` | `redirect` | `RedirectPayment` |
| `PaymentFlow::Form` | `form` | `FormPayment` |
| `PaymentFlow::Qr` | `qr` | `QrPayment` |
| `PaymentFlow::App` | `app` | `AppPayment` |
