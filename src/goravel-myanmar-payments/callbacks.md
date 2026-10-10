---
title: Callbacks & Status
description: Verify gateway callbacks with HandleCallback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `HandleCallback()` verifies the gateway's signature and returns a `*PaymentCallback`. Build its request with `payments.CallbackRequestFromContext(ctx)`: signatures are checked against the exact body the gateway sent.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/goravel-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to CallbackURL' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'kbz.HandleCallback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: '*SignatureVerificationError', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by callback.OrderID' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: 'payments.Acknowledge(ctx, callback)', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```go
import (
	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
	"yourapp/app/models"
)

facades.Route().Post("/payments/kbz/callback", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	callback, err := kbz.HandleCallback(request)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	var order models.Order
	err = facades.Orm().Query().
		Where("reference", callback.OrderID).
		FirstOrFail(&order)
	if err != nil {
		return ctx.Response().String(http.StatusNotFound, "unknown order")
	}

	// order.Amount is a string such as "10000"; compare by value, not floats
	amount, err := myanmarpayments.ParseAmount(order.Amount)
	paid := err == nil && amount.Equals(callback.Amount)

	if callback.IsSuccessful() && !order.IsPaid() && paid {
		order.MarkAsPaid(callback.GatewayReference)
	}

	return payments.Acknowledge(ctx, callback)
})
```

`yourapp/app/facades` is the `facades` package Goravel generates in your app; replace `yourapp` with your module name. Gateways post from their own servers, so keep callback routes free of CSRF and authentication middleware.

## Callback Helpers

| Helper | What it does |
|---|---|
| `kbz.HandleCallback(request)` | Verifies the callback. Takes the SDK's `*myanmarpayments.CallbackRequest` |
| `payments.CallbackRequestFromContext(ctx)` | Builds that request from the current Goravel request: the raw body, the headers and the query string |
| `manager.HandleCallback(gateway, request)` | The same, by gateway name, for one route that serves every gateway; see [Handling Webhooks](/goravel-myanmar-payments/webhooks#route-and-controller) |
| `manager.Gateway(name)` | The gateway for `kbz-pay`, `wave-money`, `aya-pay`, `yoma-mmqr` or `cyber-source` (`payments.GatewayNames()` lists them), as a `payments.CallbackHandler`. An unknown name returns an error wrapping `payments.ErrUnknownGateway` |
| `payments.Acknowledge(ctx, callback)` | The response the gateway expects, written as the Goravel response. With a nil callback, an empty 200 |
| `aya.VerifyRedirect(request)` | Verifies AYA's browser return; see [AYA Pay](/goravel-myanmar-payments/drivers/aya-pay) |

`manager` is `paymentsfacades.MyanmarPayments()`.

Signatures are computed over the exact bytes the gateway sent, so always build the request with `CallbackRequestFromContext`, never from `ctx.Request().All()`:

| Body | What you get |
|---|---|
| JSON (KBZ Pay, Wave Money, Yoma MMQR) | The body byte for byte |
| `application/x-www-form-urlencoded` or `multipart/form-data` (AYA Pay, CyberSource) | Goravel's gin driver parses form bodies before your handler runs, which consumes them. The body is rebuilt from the parsed form fields as urlencoded and `Content-Type` says so. These gateways sign field values, so the result verifies the same |

A body is read as JSON only when it is a single JSON object; any other body is read as a urlencoded form, skipping a malformed pair.

## Rules

- **Verify, then trust.** A callback that fails verification returns a `*myanmarpayments.SignatureVerificationError`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; it carries the unverified data in `Raw` for logging only.
- **Check the amount.** Compare `callback.Amount` (as the gateway sent it, a string) with your order before fulfilling. A gateway may format it differently from your order (`10000` or `10000.00`); `amount.Equals(callback.Amount)`, with `amount` parsed from your order by `myanmarpayments.ParseAmount()`, compares decimal strings exactly.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `payments.Acknowledge(ctx, callback)` returns the response the gateway expects, e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## PaymentStatus

Every gateway's own status values are mapped onto one type. The original value stays in `callback.GatewayStatus`.

| Constant | Meaning |
|---|---|
| `myanmarpayments.StatusSuccessful` | The customer paid. The only status that means money was collected. |
| `myanmarpayments.StatusPending` | Still in progress or waiting on the customer. |
| `myanmarpayments.StatusFailed` | Attempted and failed or rejected. |
| `myanmarpayments.StatusCanceled` | Canceled or closed before completing. |
| `myanmarpayments.StatusExpired` | The payment window ran out. |
| `myanmarpayments.StatusUnknown` | A status this package does not recognize yet. Inspect `GatewayStatus`. |

`status.IsFinal()` is `false` for `StatusPending` and `StatusUnknown`. Unknown statuses never return an error.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: 'kbz.Status(ctx, orderID)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: 'result.Status.IsFinal()' },
  ]"
/>

When a callback is late or missing, ask the gateway directly. Status checks return a `*PaymentStatusResult` with the same `Status`, `GatewayStatus`, `GatewayReference` and `Amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `KbzPay()` → `Status(ctx, orderID)` |
| AYA Payment Gateway | `AyaPay()` → `Status(ctx, orderID)` |
| Yoma MMQR | `YomaMmqr()` → `Status(ctx, payment.Reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```go
import (
	"fmt"

	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
result, err := kbz.Status(ctx, fmt.Sprintf("ORDER_%d", order.ID))

if err == nil && result.IsSuccessful() {
	// ...
}
```

See [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for every field.
