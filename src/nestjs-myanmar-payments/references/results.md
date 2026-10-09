---
title: Results
description: Property reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result classes returned when a payment is started.
---

# Results

Starting a payment returns one of four classes from `@laranex/myanmar-payments`. Their union is the `PaymentResult` type, and each exposes `flow: PaymentFlow`.

## RedirectPayment

Returned by `kbzPay().pwa()` and `waveMoney().initiate()`.

| Property | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `url` | `string` | The gateway page to redirect the customer to |
| `gatewayReference` | `string \| undefined` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `raw` | `Readonly<Record<string, unknown>>` | The gateway's response, for logging |

## FormPayment

Returned by `ayaPay().initiate()` and `cyberSource().initiate()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `action` | `string` | The gateway URL the form posts to |
| `fields` | `readonly FormField[]` | The signed hidden fields (`name`, `value`), in signing order. Post them unchanged |
| `enctype` | `string` | The form encoding the gateway expects |
| `field(name)` | `string \| undefined` | The value of one field |
| `values()` | `Record<string, string>` | The fields as an object, e.g. for your own template |
| `toHtml()` | `string` | A full HTML page that posts the form on load |

`this.payments.autoSubmitUrl(payment)` returns the link to the module's auto-submitting page. It throws when the form route is disabled.

## QrPayment

Returned by `kbzPay().qr()`, `yomaMmqr().initiate()` and `yomaMmqr().renewQr()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `qrString` | `string \| undefined` | A QR payload to encode yourself (KBZ Pay) |
| `qrImage` | `string \| undefined` | A base64 image to display as is (Yoma MMQR) |
| `expiresAt` | `Date \| undefined` | When the QR stops being payable |
| `reference` | `string \| undefined` | The gateway's ID for this QR (KBZ `prepay_id`, Yoma `refLabel`) |
| `raw` | `Readonly<Record<string, unknown>>` | The gateway's response, for logging |
| `qrImageDataUri(mimeType = 'image/png')` | `string \| undefined` | `qrImage` as a data URI for `<img src>` |

## AppPayment

Returned by `kbzPay().app()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `orderInfo` | `string` | The signed order string the SDK expects |
| `sign` | `string` | The signature of `orderInfo` |
| `signType` | `string` | `SHA256` |
| `raw` | `Readonly<Record<string, unknown>>` | The gateway's response, for logging |
| `toJSON()` | `object` | `orderId`, `orderInfo`, `sign`, `signType` for your mobile app |

## PaymentFlow

| Value | String | Result |
|---|---|---|
| `PaymentFlow.Redirect` | `redirect` | `RedirectPayment` |
| `PaymentFlow.Form` | `form` | `FormPayment` |
| `PaymentFlow.Qr` | `qr` | `QrPayment` |
| `PaymentFlow.App` | `app` | `AppPayment` |
