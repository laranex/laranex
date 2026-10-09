---
title: Errors
description: Every error raised by Python Myanmar Payments extends PaymentError and can be caught with except. Reference for validation, API, signature and configuration errors.
---

# Errors

Every error the package raises extends `PaymentError` (which extends `Exception`). Catch them with `except`:

```python
from python_myanmar_payments import ApiError, InvalidPaymentDataError

try:
    payment = kbz.pwa(data)
except InvalidPaymentDataError as error:
    raise ValueError(f"check the order: {dict(error.errors)}") from error
except ApiError as error:
    raise RuntimeError(
        f"KBZ said {error.gateway_code}: {error.gateway_message}"
    ) from error
```

| Class | Raised when |
|---|---|
| `InvalidPaymentDataError` | Payment data breaks the gateway's documented rules, or `Amount.kyat` / `Amount.parse` / `Amount.of` get bad input. Raised before any request is sent |
| `ApiError` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `ConfigurationError` | A gateway is missing a credential |

## InvalidPaymentDataError

| Field | Type | Description |
|---|---|---|
| `errors` | `Mapping[str, str]` | A read-only mapping of field name to message, keyed by the payment data's snake_case field names, e.g. `{"amount": "Wave Money does not accept decimal amounts; …"}`. Wave item errors use `items.0.amount` keys |

`str(error)` is `Invalid payment data: ` followed by the messages, in field-name order.

## ApiError

| Field | Type | Description |
|---|---|---|
| `str(error)` | `str` | What failed |
| `gateway_code` | `str \| None` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gateway_message` | `str \| None` | The gateway's own error message |
| `http_status` | `int` | The response status, `0` when no response was received |
| `raw` | `Mapping[str, Any]` | The decoded response body, JSON numbers as their exact text (`{}` when there was none) |
| `__cause__` | `BaseException \| None` | The underlying network error, if any |

When the gateway sends an error code without a message, `str(error)` ends with the bracketed code, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED]`. For a call that could not reach the gateway, `str(error)` is `Could not reach <url>: …` and `__cause__` is the `httpx` error, e.g. an `httpx.ConnectError` or `httpx.TimeoutException`.

## SignatureVerificationError

| Field | Type | Description |
|---|---|---|
| `str(error)` | `str` | What failed |
| `raw` | `Mapping[str, Any]` | The unverified payload, for logging only. Never act on it |

## ConfigurationError

| Field | Type | Description |
|---|---|---|
| `gateway` | `str` | e.g. `kbz_pay` |
| `key` | `str` | The missing setting, e.g. `app_key` |

`str(error)` is e.g. `The kbz_pay configuration is missing [app_key].` Raised by each config class (and so by each gateway's `from_env()`), and by `MyanmarPayments` and `AsyncMyanmarPayments` when a gateway is used without configuration.
