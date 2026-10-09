---
title: Results
description: Field reference for RedirectPayment, FormPayment, QrPayment and AppPayment, the result classes returned when a payment is started.
---

# Results

Starting a payment returns one of four frozen dataclasses exported from `python_myanmar_payments`. Each has a `flow` class attribute, and `PaymentResult` is their union, so a `match` statement or `isinstance` check tells them apart. Fields a gateway did not provide are `None`.

## RedirectPayment

Returned by `kbz.pwa()` and `wave.initiate()`.

| Field | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow` | `PaymentFlow.REDIRECT` |
| `order_id` | `str` | Your order ID, as sent to the gateway |
| `url` | `str` | The gateway page to redirect the customer to |
| `gateway_reference` | `str \| None` | The gateway's ID for this attempt (KBZ `prepay_id`, Wave `transaction_id`) |
| `raw` | `Mapping[str, Any]` | The gateway's response, for logging |

## FormPayment

Returned by `aya.initiate()` and `cs.initiate()`.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow` | `PaymentFlow.FORM` |
| `order_id` | `str` | Your order ID |
| `action` | `str` | The gateway URL the form posts to |
| `fields` | `tuple[FormField, ...]` | The signed hidden fields in order. Post them unchanged |
| `enctype` | `str` | The encoding the gateway expects; `application/x-www-form-urlencoded` unless the gateway needs another (AYA: `multipart/form-data`) |
| `to_html()` | `str` | A complete, escaped page that submits the form on load |
| `field(name)` | `str \| None` | One field's value |
| `values()` | `dict[str, str]` | The fields as a `dict` |

`FormField` is a frozen dataclass with `name: str` and `value: str`.

## QrPayment

Returned by `kbz.qr()`, `yoma.initiate()` and `yoma.renew_qr()`.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow` | `PaymentFlow.QR` |
| `order_id` | `str` | Your order ID |
| `qr_string` | `str \| None` | A QR payload to encode yourself (KBZ Pay) |
| `qr_image` | `str \| None` | A base64 image to display as is (Yoma MMQR) |
| `expires_at` | `datetime \| None` | When the QR stops being payable, as an aware UTC `datetime`; `None` when the gateway sets no limit |
| `reference` | `str \| None` | The gateway's ID for this QR, used for status checks (Yoma `refLabel`, KBZ `prepay_id`) |
| `raw` | `Mapping[str, Any]` | The gateway's response, for logging |
| `qr_image_data_uri(mime_type="image/png")` | `str \| None` | `qr_image` as a data URI. `None` when there is no image |

## AppPayment

Returned by `kbz.app()`. `payment.to_dict()` returns `orderId`, `orderInfo`, `sign` and `signType`, the names the KBZ Pay SDK uses.

| Field / Method | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow` | `PaymentFlow.APP` |
| `order_id` | `str` | Your order ID |
| `order_info` | `str` | The signed order string the SDK expects |
| `sign` | `str` | The signature of `order_info` |
| `sign_type` | `str` | The signature algorithm, `SHA256` |
| `raw` | `Mapping[str, Any]` | The gateway's response; left out of `to_dict()` |
| `to_dict()` | `dict[str, str]` | `{"orderId", "orderInfo", "sign", "signType"}`, the values your app needs |

## PaymentFlow

A `str` enum, so `payment.flow == "redirect"` works too.

| Member | Value | Class |
|---|---|---|
| `PaymentFlow.REDIRECT` | `redirect` | `RedirectPayment` |
| `PaymentFlow.FORM` | `form` | `FormPayment` |
| `PaymentFlow.QR` | `qr` | `QrPayment` |
| `PaymentFlow.APP` | `app` | `AppPayment` |

`raw` values are plain Python values: every JSON number is its exact text as a `str` (`1000.50` stays `"1000.50"`), never a `float`, so `json.dumps(payment.raw)` logs them as is.

Every result class takes its fields as keyword arguments, so you can build one in your own tests, e.g. `RedirectPayment(order_id="ORDER_1", url="https://…")`.
