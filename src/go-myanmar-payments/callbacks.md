---
title: Callbacks & Status
description: Verify gateway callbacks with HandleCallback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `HandleCallback` takes a `*myanmarpayments.CallbackRequest`, verifies the gateway's signature and returns a `*myanmarpayments.PaymentCallback`.

```go
func (h *handlers) kbzCallback(w http.ResponseWriter, r *http.Request) {
	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	callback, err := h.kbz.HandleCallback(request)
	if err != nil {
		var sigErr *myanmarpayments.SignatureVerificationError
		if errors.As(err, &sigErr) {
			log.Printf("rejected KBZ callback: %s", sigErr.Message)
		}
		http.Error(w, "invalid callback", http.StatusBadRequest)
		return
	}

	order := h.orders.Find(callback.OrderID)
	if callback.IsSuccessful() && !order.Paid && callback.Amount == order.Amount.String() {
		h.orders.MarkPaid(order, callback.GatewayReference)
	}

	callback.Acknowledgement.Write(w) // KBZ Pay: HTTP 200 with plain-text "success"
}
```

## Building a CallbackRequest

Signatures are checked against the exact bytes the gateway sent, so build the request from the real incoming request.

| Constructor | Use when |
|---|---|
| `myanmarpayments.NewCallbackRequestFromHTTP(r)` | A `net/http` handler: reads the body once, keeps the headers and query. The body of `r` is restored so it can still be read |
| `myanmarpayments.NewCallbackRequestFromJSON(payload, header)` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table |
| `myanmarpayments.NewCallbackRequest(body, header, query)` | Any other server: pass the raw body bytes, headers and query values |

`request.HeaderValue(name)` is case-insensitive, `ParsedBody()` decodes a JSON or form body (JSON numbers are kept as `json.Number`), `Input()` merges the body over the query string, and `QueryInput()` merges the query string over the body.

## Rules

- **Verify, then trust.** A callback that fails verification returns `*myanmarpayments.SignatureVerificationError`. Never act on its payload; `Raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.Amount` (as the gateway sent it, a string) with your order before fulfilling.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `callback.Acknowledgement` holds the response the gateway expects (`Status`, `Body`, `Headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`Acknowledgement.Write` sets the headers, writes the status (200 when unset) and the body:

```go
if err := callback.Acknowledgement.Write(w); err != nil {
	log.Printf("write acknowledgement: %v", err)
}
```

`myanmarpayments.DefaultAcknowledgement()` is the empty `200 text/plain` response most gateways expect.

## PaymentStatus

Every gateway's own status values are mapped onto one type. The original value stays in `callback.GatewayStatus`.

| Constant | Meaning |
|---|---|
| `StatusSuccessful` | The customer paid. The only status that means money was collected. |
| `StatusPending` | Still in progress or waiting on the customer. |
| `StatusFailed` | Attempted and failed or rejected. |
| `StatusCancelled` | Cancelled or closed before completing. |
| `StatusExpired` | The payment window ran out. |
| `StatusUnknown` | A status this package does not recognise yet. Inspect `GatewayStatus`. |

`status.IsFinal()` is `false` for `StatusPending` and `StatusUnknown`. Unknown statuses never return an error.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late or missing, ask the gateway directly. Status checks return a `*myanmarpayments.PaymentStatusResult` with the same `Status`, `GatewayStatus`, `GatewayReference` and `Amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `kbz.Status(ctx, orderID)` |
| AYA Payment Gateway | `aya.Status(ctx, orderID)` |
| Yoma MMQR | `yoma.Status(ctx, payment.Reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```go
result, err := kbz.Status(ctx, "ORDER_1")
if err != nil {
	var apiErr *myanmarpayments.APIError
	if errors.As(err, &apiErr) {
		log.Printf("KBZ %s: %s", apiErr.GatewayCode, apiErr.GatewayMessage)
	}
	return err
}
if result.IsSuccessful() {
	// ...
}
```

See [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for every field.
