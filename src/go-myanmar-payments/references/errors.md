---
title: Errors
description: Every error returned by Go Myanmar Payments is a typed struct you can match with errors.As. Reference for validation, API, signature and configuration errors.
---

# Errors

Every error the package returns for a payment problem is a pointer to one of four structs in the root package, each implementing the `myanmarpayments.PaymentError` interface. Match them with `errors.As`:

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
| `*InvalidPaymentDataError` | Payment data breaks the gateway's documented rules, or `ParseAmount` gets bad input. Returned before any request is sent |
| `*APIError` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `*SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `*ConfigurationError` | A gateway setting is missing or blank, or a time setting is not a whole number greater than 0 |

To match any of the four, use the interface:

```go
var paymentErr myanmarpayments.PaymentError
if errors.As(err, &paymentErr) {
	log.Printf("payment failed: %v", paymentErr)
}
```

Every message starts with `myanmarpayments: `, the Go convention; the rest matches the other Laranex SDKs.

## InvalidPaymentDataError

| Field | Type | Description |
|---|---|---|
| `Errors` | `map[string]string` | Field name to message, keyed by the payment data's camelCase field names, e.g. `{"amount": "Wave Money does not accept decimal amounts; …"}`. Wave item errors use `items.0.amount` keys |

`err.Error()` is `myanmarpayments: Invalid payment data: ` followed by the messages, in field-name order.

## APIError

| Field | Type | Description |
|---|---|---|
| `Message` | `string` | What failed, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED] Duplicate order` |
| `GatewayCode` | `string` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `GatewayMessage` | `string` | The gateway's own error message |
| `HTTPStatus` | `int` | The response status, `0` when no response was received |
| `Raw` | `map[string]any` | The decoded response body |
| `Err` | `error` | The underlying network error, if any; returned by `Unwrap()` |

When the gateway sends an error code without a message, `Message` ends with the bracketed code, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED]`. For a call that could not reach the gateway, `Message` is `Could not reach <url>: …` and `Err` is the error from the `HTTPDoer`, so `errors.Is(err, context.DeadlineExceeded)` works for timed-out calls.

## SignatureVerificationError

| Field | Type | Description |
|---|---|---|
| `Message` | `string` | What failed |
| `Raw` | `map[string]any` | The unverified payload, for logging only. Never act on it |

## ConfigurationError

| Field | Type | Description |
|---|---|---|
| `Gateway` | `string` | e.g. `kbz_pay` |
| `Key` | `string` | The setting, e.g. `app_key` |
| `Invalid` | `bool` | `true` when the setting is set but is not a whole number greater than 0 |

`err.Error()` is e.g. `myanmarpayments: The kbz_pay configuration is missing [app_key].`, or `myanmarpayments: The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` for a time setting. Returned by each gateway's `New`, and by the [`payments.Gateways`](/go-myanmar-payments/configuration#one-object-for-every-gateway) methods when a gateway is used without configuration.
