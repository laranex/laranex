---
title: Errors
description: Every error returned by Goravel Myanmar Payments is one of the SDK's typed errors or one of the package's sentinel errors. Reference for validation, API, signature and configuration errors.
---

# Errors

Gateways return the SDK's typed errors from `github.com/laranex/go-myanmar-payments/v4`. Each implements `myanmarpayments.PaymentError`, so one `errors.As` covers the package; match a single type with `errors.As` too.

| Error | Returned when |
|---|---|
| `*InvalidPaymentDataError` | Payment data has values the gateway would reject |
| `*APIError` | A gateway rejects a request, answers with an error (including errors sent with HTTP 200), or cannot be reached |
| `*SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification, or its signed values are malformed (an AYA Pay value holding `:`, a CyberSource `signed_field_names` that doesn't sign itself or an unknown `decision`, a Wave Pay amount or ID out of format) |
| `*ConfigurationError` | A gateway is requested without a setting it needs (URLs, time to live and Yoma's webhook secret included), or a time setting is out of range |

```go
var paymentErr myanmarpayments.PaymentError
if errors.As(err, &paymentErr) {
	log.Printf("payment failed: %v", paymentErr)
}
```

The package adds its own sentinel errors; match them with `errors.Is`:

| Error | Returned when |
|---|---|
| `payments.ErrUnknownGateway` | `Manager.Gateway()` or `Manager.HandleCallback()` gets a name other than `kbz-pay`, `wave-pay`, `aya-pay`, `yoma-mmqr` or `cyber-source` |
| `payments.ErrFormRouteDisabled` | `AutoSubmitURL()` is called while `form_route.enabled` is `false` |
| `payments.ErrCryptNotAvailable` | `AutoSubmitURL()` is called without the crypt facade |
| `payments.ErrInvalidFormLink` | `Manager.ResolveFormPayment()` gets a tampered, foreign or expired link |
| `payments.ErrCallbackBodyTooLarge` | `CallbackRequestFromContext()` gets a body (or rebuilt form) larger than `payments.MaxCallbackBodyBytes` (64 KiB) |

## InvalidPaymentDataError

```go
import (
	"errors"
	"fmt"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

_, err := kbz.PWA(ctx, kbzpay.PaymentData{
	OrderID:     "ORDER-1",
	Amount:      myanmarpayments.Kyat(0),
	CallbackURL: "https://shop.test/payments/kbz/callback",
})

var invalid *myanmarpayments.InvalidPaymentDataError
if errors.As(err, &invalid) {
	fmt.Println(invalid.Errors)
	// map[amount:The amount field must be greater than 0.
	//     orderId:The orderId field may only contain letters, numbers and underscores.]
}
```

Validation runs inside the gateway call, before any request is sent. `err.Error()` is `myanmarpayments: Invalid payment data: ` followed by the messages, in field-name order.

## APIError

| Field | Type | Description |
|---|---|---|
| `Message` | `string` | What failed |
| `GatewayCode` | `string` | The gateway's error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `GatewayMessage` | `string` | The gateway's error message |
| `HTTPStatus` | `int` | HTTP status of the response, `0` when no response was received |
| `Raw` | `map[string]any` | The decoded response body |
| `Err` | `error` | The transport error, returned by `Unwrap()` |

`Message` describes what failed, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED] Duplicate order`; when the gateway sends a code without a message, it ends with the bracketed code. For a call that could not reach the gateway, `Message` is `Could not reach <url>: …` and `Unwrap()` returns the underlying transport error.

## SignatureVerificationError

`Message` says what failed; `Raw` holds the unverified payload. Log it, never act on it.

## ConfigurationError

The message names the gateway and the key, e.g. `myanmarpayments: The wave_pay configuration is missing [merchant_id].`, or `myanmarpayments: The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` for a time setting, with `Invalid` set. `Gateway`, `Key`, `Invalid` and `Requirement` hold the details; KBZ Pay's time to live reads `The kbz_pay configuration [time_to_live_in_minutes] must be a whole number from 1 to 120.` `AutoSubmitURL` returns it with `form_route` and `ttl_minutes` when the form link lifetime is missing or invalid.
