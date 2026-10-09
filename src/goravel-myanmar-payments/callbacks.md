---
title: Callbacks & Status
description: Turn a Goravel request into the SDK's CallbackRequest, verify it with HandleCallback, answer with the gateway's acknowledgement, and check payment status when a callback is late.
---

# Callbacks & Status

::: tip Recommended
For production, store every callback and process it in a queued job: [Handling webhooks](/goravel-myanmar-payments/webhooks) shows the complete flow (migration, model, controller, job with retries, replay and pruning) built on the helpers on this page.
:::

This page covers the two helpers that connect Goravel to the SDK's callback handling, and the inline (low-level) way to use them.

## CallbackRequestFromContext

```go
import payments "github.com/laranex/goravel-myanmar-payments/v4"

// request is a *myanmarpayments.CallbackRequest
request, err := payments.CallbackRequestFromContext(ctx)
```

It builds the SDK's [`CallbackRequest`](/go-myanmar-payments/callbacks#building-a-callbackrequest) from the current Goravel request: the raw body, the headers and the query string. Signatures are verified against what the gateway sent, so always build it from the real request, never from `ctx.Request().All()`.

| Body | What you get |
|---|---|
| JSON (KBZ Pay, Wave Money, Yoma MMQR, AYA Pay) | The body byte for byte |
| `application/x-www-form-urlencoded` or `multipart/form-data` (CyberSource, AYA Pay) | Goravel's gin driver parses form bodies before your handler runs, which consumes them. The body is rebuilt from the parsed form fields as urlencoded and `Content-Type` says so. These gateways sign field values, so the result verifies the same |

## Acknowledge

```go
import payments "github.com/laranex/goravel-myanmar-payments/v4"

return payments.Acknowledge(ctx, callback)
```

Gateways retry until they receive the response they expect. `Acknowledge` writes `callback.Acknowledgement` (status, body and headers) as the Goravel response: KBZ Pay gets HTTP 200 with a plain-text `success`, the other gateways an empty 200. A nil callback sends an empty 200.

## Inline handling

```go
import (
	"errors"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

func (c *PaymentController) Callback(ctx http.Context) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}

	kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
	if err != nil {
		return ctx.Response().
			String(http.StatusInternalServerError, "not configured")
	}

	callback, err := kbz.HandleCallback(request)
	var signatureError *myanmarpayments.SignatureVerificationError
	if errors.As(err, &signatureError) {
		facades.Log().
			Error("rejected KBZ Pay callback: " + signatureError.Message)
		return ctx.Response().String(http.StatusBadRequest, "invalid signature")
	}
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "invalid callback")
	}

	if callback.IsSuccessful() {
		// find the order by callback.OrderID, skip it if it is already paid,
		// compare callback.Amount with the order total, then mark it paid
	}

	return payments.Acknowledge(ctx, callback)
}
```

`yourapp/app/facades` is the `facades` package Goravel generates in your app; replace `yourapp` with your module name. Register callback routes as `POST` without authentication or CSRF middleware. Every gateway's `HandleCallback` works the same way; see the SDK's [Callbacks & Status](/go-myanmar-payments/callbacks) for the `PaymentCallback` fields and the [driver pages](/go-myanmar-payments/drivers/kbz-pay) for each gateway's callback format.

`callback.Status` is gateway-independent: `myanmarpayments.StatusSuccessful` is the only status that means money was collected. `GatewayStatus` and `Raw` keep the gateway's own values for logging.

## AYA Pay's browser return

AYA sends the customer back to your `ReturnURL` with a signed query string. Verify it to show the right page, and fulfill orders from the backend callback only:

```go
import (
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

request, err := payments.CallbackRequestFromContext(ctx)
aya, err := paymentsfacades.MyanmarPayments().AyaPay()
result, err := aya.VerifyRedirect(request)
```

## Checking status

When a callback is late or missing, ask the gateway. KBZ Pay and AYA Pay take your order ID, Yoma MMQR the QR reference; Wave Money and CyberSource have no status API.

```go
import (
	"fmt"

	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

kbz, _ := paymentsfacades.MyanmarPayments().KbzPay()
// result is a *myanmarpayments.PaymentStatusResult
result, err := kbz.Status(ctx, fmt.Sprintf("ORDER_%d", order.ID))
if err == nil && result.IsSuccessful() {
	// fulfill, exactly as from a callback
}
```
