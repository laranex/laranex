---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult, Acknowledgement, CallbackRequest and the PaymentStatus enum.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handle_callback()` (and AYA's `verify_redirect()`) once the signature is verified.

| Field / Method | Type | Description |
|---|---|---|
| `order_id` | `str` | Your order ID |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gateway_status` | `str` | The gateway's own status value, unmapped |
| `gateway_reference` | `str \| None` | The gateway's ID for the payment |
| `amount` | `str \| None` | The amount the gateway reports, exactly as it sent it |
| `raw` | `Mapping[str, Any]` | The verified payload, as plain Python values; JSON numbers are their exact text as `str`, never `float` |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `is_successful()` | `bool` | `status is PaymentStatus.SUCCESSFUL` |

Build one yourself to test your own fulfillment code, with keyword arguments: `PaymentCallback(order_id=..., status=..., gateway_status=..., gateway_reference=None, amount=None, raw=None, acknowledgement=None)`. `status` takes a `PaymentStatus` or its string value, and `acknowledgement` defaults to `Acknowledgement.default()`.

## Acknowledgement

A frozen dataclass.

| Field / Method | Type | Description |
|---|---|---|
| `status` | `int` | HTTP status, `200` by default |
| `body` | `str` | Response body, e.g. KBZ Pay's `success`; empty by default |
| `headers` | `Mapping[str, str]` | Response headers, `{"Content-Type": "text/plain"}` by default |

`Acknowledgement.default()` is an empty `200` with `Content-Type: text/plain`. Write it with your framework's response class, see [Acknowledging](/python-myanmar-payments/callbacks#acknowledging).

## PaymentStatusResult

Returned by `kbz.status()`, `aya.status()` and `yoma.status()`. A frozen dataclass.

| Field / Method | Type | Description |
|---|---|---|
| `order_id` | `str \| None` | Your order ID; `None` for Yoma, which returns only the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gateway_status` | `str` | The gateway's own status value |
| `gateway_reference` | `str \| None` | The gateway's ID for the payment |
| `amount` | `str \| None` | The amount the gateway reports |
| `raw` | `Mapping[str, Any]` | The gateway's response |
| `is_successful()` | `bool` | `status is PaymentStatus.SUCCESSFUL` |

## CallbackRequest

| Member | Type | Description |
|---|---|---|
| `CallbackRequest(body=None, headers=None, query=None)` | `CallbackRequest` | From the raw parts: the body as `bytes` or `str`, the headers as a mapping or `(name, value)` pairs, the query string as `str`, `bytes`, a mapping or pairs (Django's `QueryDict`, Werkzeug's `MultiDict` and Starlette's `QueryParams` work too) |
| `CallbackRequest.from_json(payload, headers=None)` | `CallbackRequest` | From a decoded payload, encoded as a JSON body with `Content-Type: application/json`; `Decimal` values are written as strings |
| `raw_body` | `bytes` | The raw body, exactly as received |
| `body` | `str` | The raw body, decoded as UTF-8 |
| `headers` | `Mapping[str, str]` | Headers with lowercase names; repeated headers joined with `, ` |
| `query` | `Mapping[str, str]` | Query string values (the first of each) |
| `header(name)` | `str \| None` | One header, case-insensitively |
| `parsed_body()` | `dict[str, Any]` | The body decoded as JSON or a form; JSON numbers keep their exact text as `str` |
| `input()` | `dict[str, Any]` | The body merged over the query string |
| `query_input()` | `dict[str, Any]` | The query string merged over the body |

## PaymentStatus

`class PaymentStatus(str, Enum)`: members are strings, so they compare equal to their values and `str(status)` is the value.

| Member | Value |
|---|---|
| `PaymentStatus.SUCCESSFUL` | `successful` |
| `PaymentStatus.PENDING` | `pending` |
| `PaymentStatus.FAILED` | `failed` |
| `PaymentStatus.CANCELED` | `canceled` |
| `PaymentStatus.EXPIRED` | `expired` |
| `PaymentStatus.UNKNOWN` | `unknown` |

`list(PaymentStatus)` lists every status. `status.is_final()` is `False` for `PENDING` and `UNKNOWN`. `resolve_status(statuses, gateway_status)` maps a trimmed gateway value through a `dict` and returns `PaymentStatus.UNKNOWN` when it is not listed.
