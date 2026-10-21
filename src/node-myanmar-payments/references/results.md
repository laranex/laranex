---
title: Results
description: Field reference for RedirectPayment, FormPayment, QrPayment, AppPayment and MiniAppPayment, the result classes returned when a payment is started.
---

# Results

Starting a payment returns one of five classes exported from `@laranex/myanmar-payments`. Each has a read-only `flow` property, and `PaymentResult` is their union, so a `switch` on `payment.flow` tells them apart. Fields a gateway did not provide are `undefined`.

## RedirectPayment

Returned by `kbz.pwa()` and `wave.initiate()`.

| Field | Type | Description |
|---|---|---|
| `flow` | `'redirect'` | `PaymentFlow.Redirect` |
| `orderId` | `string` | Your order ID, as sent to the gateway |
| `url` | `string` | The gateway page to redirect the customer to |
| `gatewayReference` | `string \| undefined` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `raw` | `Record<string, unknown>` | The gateway's response, for logging |

## FormPayment

Returned by `aya.initiate()` and `cs.initiate()`.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `'form'` | `PaymentFlow.Form` |
| `orderId` | `string` | Your order ID |
| `action` | `string` | The gateway URL the form posts to |
| `fields` | `readonly FormField[]` | The signed hidden fields (`{ name, value }`) in order. Post them unchanged |
| `enctype` | `string` | The encoding the gateway expects; `application/x-www-form-urlencoded` unless the gateway needs another (AYA: `multipart/form-data`) |
| `toHtml(nonce?)` | `string` | A complete, escaped page that submits the form on load. Pass your Content Security Policy nonce to add it to the inline `<script>`; an empty nonce adds none |
| `field(name)` | `string \| undefined` | One field's value |
| `values()` | `Record<string, string>` | The fields as an object |

`FormField` is `{ readonly name: string; readonly value: string }`.

## QrPayment

Returned by `kbz.qr()`, `yoma.initiate()` and `yoma.renewQr()`.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `'qr'` | `PaymentFlow.Qr` |
| `orderId` | `string` | Your order ID |
| `qrString` | `string \| undefined` | A QR payload to encode yourself (KBZ Pay) |
| `qrImage` | `string \| undefined` | A base64 image to display as is (Yoma MMQR) |
| `expiresAt` | `Date \| undefined` | When the QR stops being payable; `undefined` when the gateway sets no limit |
| `reference` | `string \| undefined` | The gateway's ID for this QR, used for status checks (Yoma `refLabel`, KBZ `prepay_id`) |
| `raw` | `Record<string, unknown>` | The gateway's response, for logging |
| `qrImageDataUri(mimeType?)` | `string \| undefined` | `qrImage` as a data URI; `mimeType` defaults to `image/png`. `undefined` when there is no image |

## AppPayment

Returned by `kbz.app()`. `JSON.stringify(payment)` writes `orderId`, `orderInfo`, `sign` and `signType`, the names the KBZ Pay SDK uses.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `'app'` | `PaymentFlow.App` |
| `orderId` | `string` | Your order ID |
| `orderInfo` | `string` | The signed order string the SDK expects |
| `sign` | `string` | The signature of `orderInfo` |
| `signType` | `string` | The signature algorithm, `SHA256` |
| `raw` | `Record<string, unknown>` | The gateway's response; left out of `toJSON()` |
| `toJSON()` | `{ orderId, orderInfo, sign, signType }` | The values your app needs |

## MiniAppPayment

Returned by `miniApp.payment()`. No request is sent: pass `JSON.stringify(payment)` or `payment.toJsonString()` to your mini app page, which hands it unchanged to `WaveJsSDK.paymentModule.makePayment()`.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `'mini_app'` | `PaymentFlow.MiniApp` |
| `orderId` | `string` | Your order ID (`orderID`) |
| `amount` | `Amount` | The signed total, in whole kyat |
| `miniAppId` | `string` | The configured mini app ID (`miniAppID`) |
| `merchantReferenceId` | `string` | Your ID for this attempt (`merchantRefID`) |
| `callbackUrl` | `string` | The signed callback URL (`callBackUrl`) |
| `hashValue` | `string` | The payload's hash (`hashValue`) |
| `items` | `readonly MiniAppPaymentItem[]` | The line items, `{ name: string; amount: Amount }` |
| `toJSON()` | `MiniAppPaymentPayload` | Exactly the `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as numbers. An amount above `Number.MAX_SAFE_INTEGER` keeps every digit through `JSON.rawJSON` (Node.js 21+) and throws a `RangeError` without it |
| `toJsonString()` | `string` | The same object as compact JSON, amounts as JSON integers with every digit on every Node.js version |

## PaymentFlow

A string union, so `payment.flow === 'redirect'` works too.

| Constant | Value | Class |
|---|---|---|
| `PaymentFlow.Redirect` | `redirect` | `RedirectPayment` |
| `PaymentFlow.Form` | `form` | `FormPayment` |
| `PaymentFlow.Qr` | `qr` | `QrPayment` |
| `PaymentFlow.App` | `app` | `AppPayment` |
| `PaymentFlow.MiniApp` | `mini_app` | `MiniAppPayment` |

`PaymentFlow` is also a type: `'redirect' | 'form' | 'qr' | 'app' | 'mini_app'`.

`raw` values are plain JavaScript values, with JSON numbers kept as their exact text in a `string` (`1000.50` stays `"1000.50"`), never a rounded `number`. `JSON.stringify(payment.raw)` logs them.
