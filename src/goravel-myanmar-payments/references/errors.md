---
title: Errors
description: Every error returned by Goravel Myanmar Payments is one of the SDK's typed errors or one of the package's sentinel errors. Reference for validation, API, signature and configuration errors.
---

# Errors

Gateways return the SDK's typed errors from `github.com/laranex/go-myanmar-payments/v4`; match them with `errors.As`.

| Error | Returned when |
|---|---|
| `*InvalidPaymentDataError` | Payment data has values the gateway would reject |
| `*APIError` | A gateway rejects a request, answers with an error (including errors sent with HTTP 200), or cannot be reached |
| `*SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `*ConfigurationError` | A gateway is requested without a credential it needs |

The package adds its own sentinel errors; match them with `errors.Is`:

| Error | Returned when |
|---|---|
| `payments.ErrUnknownGateway` | `Manager.Gateway()` or `Manager.HandleCallback()` gets a name other than `kbz-pay`, `wave-money`, `aya-pay`, `yoma-mmqr` or `cyber-source` |
| `payments.ErrFormRouteDisabled` | `AutoSubmitURL()` is called while `form_route.enabled` is `false` |
| `payments.ErrCryptNotAvailable` | `AutoSubmitURL()` is called without the crypt facade |
| `payments.ErrInvalidFormLink` | `Manager.ResolveFormPayment()` gets a tampered, foreign or expired link |

## InvalidPaymentDataError

```go
import (
	"errors"

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
	invalid.Errors
	// map[orderId:The orderId field may only contain ...
	//     amount:The amount field must be greater than 0.]
}
```

Validation runs inside the gateway call, before any request is sent.

## APIError

| Field | Type | Description |
|---|---|---|
| `GatewayCode` | `string` | The gateway's error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `GatewayMessage` | `string` | The gateway's error message |
| `HTTPStatus` | `int` | HTTP status of the response, `0` when no response was received |
| `Raw` | `map[string]any` | The decoded response body |

`Message` describes what failed, and `Unwrap()` returns the underlying transport error, if any.

## SignatureVerificationError

`Raw` holds the unverified payload. Log it, never act on it.

## ConfigurationError

`Gateway` and `Key` name the gateway and the missing key, and the message reads e.g. `myanmarpayments: the wave_money configuration is missing [merchant_id]`.
