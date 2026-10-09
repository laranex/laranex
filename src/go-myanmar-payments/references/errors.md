---
title: Errors
description: Every error returned by Go Myanmar Payments is a typed struct you can match with errors.As. Reference for validation, API, signature and configuration errors.
---

# Errors

Errors are pointer types in the root package. Match them with `errors.As`:

```go
payment, err := kbz.PWA(ctx, data)
if err != nil {
	var (
		invalidErr *myanmarpayments.InvalidPaymentDataError
		apiErr     *myanmarpayments.APIError
	)
	switch {
	case errors.As(err, &invalidErr):
		return fmt.Errorf("check the order: %v", invalidErr.Errors)
	case errors.As(err, &apiErr):
		return fmt.Errorf("KBZ said %s: %s",
			apiErr.GatewayCode, apiErr.GatewayMessage)
	default:
		return err
	}
}
```

| Type | Returned when |
|---|---|
| `*InvalidPaymentDataError` | Payment data breaks the gateway's documented rules. Returned before any request is sent |
| `*APIError` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `*SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `*ConfigurationError` | A gateway is missing a credential |

## InvalidPaymentDataError

| Field | Type | Description |
|---|---|---|
| `Errors` | `map[string]string` | Field name to message, e.g. `"amount": "Wave Money does not accept decimal amounts; …"` |

`Error()` joins the messages in field order.

## APIError

| Field | Type | Description |
|---|---|---|
| `Message` | `string` | What failed |
| `GatewayCode` | `string` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `GatewayMessage` | `string` | The gateway's own error message |
| `HTTPStatus` | `int` | The response status, `0` when no response was received |
| `Raw` | `map[string]any` | The decoded response body |
| `Err` | `error` | The underlying network error, if any; returned by `Unwrap()` |

Because `APIError` unwraps, `errors.Is(err, context.DeadlineExceeded)` works for timed-out calls.

## SignatureVerificationError

| Field | Type | Description |
|---|---|---|
| `Message` | `string` | What failed |
| `Raw` | `map[string]any` | The unverified payload, for logging only. Never act on it |

## ConfigurationError

| Field | Type | Description |
|---|---|---|
| `Gateway` | `string` | e.g. `kbz_pay` |
| `Key` | `string` | The missing setting, e.g. `app_key` |

Returned by each gateway's `New`.
