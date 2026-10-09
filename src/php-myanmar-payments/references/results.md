---
title: Results
description: Property reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result classes returned when a payment is started.
---

# Results

Starting a payment returns one of four final classes in `Laranex\PhpMyanmarPayments\Results`, with read-only properties. Each implements `PaymentResult`, whose `flow()` returns a `PaymentFlow`, so a `match` or `instanceof` check tells them apart. Properties a gateway did not provide are `null`.

## RedirectPayment

Returned by `$kbz->pwa()` and `$wave->initiate()`.

| Property / Method | Type | Description |
|---|---|---|
| `flow()` | `PaymentFlow` | `PaymentFlow::Redirect` |
| `orderId` | `string` | Your order ID, as sent to the gateway |
| `url` | `string` | The gateway page to redirect the customer to |
| `gatewayReference` | `?string` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `raw` | `array` | The gateway's response, for logging |

## FormPayment

Returned by `$aya->initiate()` and `$cs->initiate()`.

| Property / Method | Type | Description |
|---|---|---|
| `flow()` | `PaymentFlow` | `PaymentFlow::Form` |
| `orderId` | `string` | Your order ID |
| `action` | `string` | The gateway URL the form posts to |
| `fields` | `array<string, string>` | The signed hidden fields, name => value, in order. Post them unchanged |
| `enctype` | `string` | The encoding the gateway expects; `application/x-www-form-urlencoded` unless the gateway needs another (AYA: `multipart/form-data`) |
| `toHtml()` | `string` | A complete, escaped page that submits the form on load |
| `field($name)` | `?string` | One field's value |
| `values()` | `array<string, string>` | The fields as an array |
| `autoSubmitUrl` | `?string` | Link to a page that renders the form. `null` unless set with `withAutoSubmitUrl()` |
| `withAutoSubmitUrl($url)` | `FormPayment` | A copy with `autoSubmitUrl` set |

## QrPayment

Returned by `$kbz->qr()`, `$yoma->initiate()` and `$yoma->renewQr()`.

| Property / Method | Type | Description |
|---|---|---|
| `flow()` | `PaymentFlow` | `PaymentFlow::Qr` |
| `orderId` | `string` | Your order ID |
| `qrString` | `?string` | A QR payload to encode yourself (KBZ Pay) |
| `qrImage` | `?string` | A base64 image to display as is (Yoma MMQR) |
| `expiresAt` | `?DateTimeImmutable` | When the QR stops being payable; `null` when the gateway sets no limit |
| `reference` | `?string` | The gateway's ID for this QR, used for status checks (Yoma `refLabel`, KBZ `prepay_id`) |
| `raw` | `array` | The gateway's response, for logging |
| `qrImageDataUri($mimeType = 'image/png')` | `?string` | `qrImage` as a data URI. `null` when there is no image |

## AppPayment

Returned by `$kbz->app()`. `$payment->toArray()` returns `orderId`, `orderInfo`, `sign` and `signType`, the names the KBZ Pay SDK uses.

| Property / Method | Type | Description |
|---|---|---|
| `flow()` | `PaymentFlow` | `PaymentFlow::App` |
| `orderId` | `string` | Your order ID |
| `orderInfo` | `string` | The signed order string the SDK expects |
| `sign` | `string` | The signature of `orderInfo` |
| `signType` | `string` | The signature algorithm, `SHA256` |
| `raw` | `array` | The gateway's response; left out of `toArray()` |
| `toArray()` | `array<string, string>` | `['orderId', 'orderInfo', 'sign', 'signType']`, the values your app needs |

## PaymentFlow

A string-backed enum in `Laranex\PhpMyanmarPayments\Enums`, so `$payment->flow()->value` is `redirect`, `form`, `qr` or `app`.

| Case | Value | Class |
|---|---|---|
| `PaymentFlow::Redirect` | `redirect` | `RedirectPayment` |
| `PaymentFlow::Form` | `form` | `FormPayment` |
| `PaymentFlow::Qr` | `qr` | `QrPayment` |
| `PaymentFlow::App` | `app` | `AppPayment` |

`raw` values are decoded JSON: numbers keep their exact text as strings, never a `float`, so `json_encode($payment->raw)` logs them without rounding.

Every result class takes its properties as named constructor arguments, so you can build one in your own tests, e.g. `new RedirectPayment(orderId: 'ORDER_1', url: 'https://…')`.
