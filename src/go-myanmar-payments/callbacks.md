---
title: Callbacks & Status
description: Verify gateway callbacks with HandleCallback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `HandleCallback` takes a `*myanmarpayments.CallbackRequest`, verifies the gateway's signature and returns a `*myanmarpayments.PaymentCallback`. It takes no context: verifying needs no network call.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/go-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
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
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: 'callback.Acknowledgement.Write(w)', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```go
package shop

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

type Handlers struct {
	DB  *sql.DB
	KBZ *kbzpay.Gateway
}

func (h *Handlers) KBZCallback(w http.ResponseWriter, r *http.Request) {
	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		http.Error(w, "invalid callback", http.StatusBadRequest)
		return
	}
	callback, err := h.KBZ.HandleCallback(request)
	if err != nil {
		log.Printf("rejected KBZ callback: %v", err)
		http.Error(w, "invalid callback", http.StatusBadRequest)
		return
	}

	var amount string
	var paidAt sql.NullInt64
	err = h.DB.QueryRowContext(r.Context(),
		`SELECT amount, paid_at FROM orders WHERE number = ?`,
		callback.OrderID,
	).Scan(&amount, &paidAt)
	if err != nil {
		http.Error(w, "try again", http.StatusInternalServerError)
		return
	}
	order, err := myanmarpayments.ParseAmount(amount)
	if err != nil {
		http.Error(w, "try again", http.StatusInternalServerError)
		return
	}
	paid := order.Equals(callback.Amount)
	if callback.IsSuccessful() && !paidAt.Valid && paid {
		// paid_at IS NULL keeps a duplicate callback from fulfilling twice
		_, err = h.DB.ExecContext(r.Context(), `UPDATE orders
			SET paid_at = ?, gateway_reference = ?
			WHERE number = ? AND paid_at IS NULL`,
			time.Now().Unix(), callback.GatewayReference, callback.OrderID)
		if err != nil {
			http.Error(w, "try again", http.StatusInternalServerError)
			return
		}
	}

	// KBZ Pay: HTTP 200 with plain-text "success"
	callback.Acknowledgement.Write(w)
}
```

## Building a CallbackRequest

Signatures are checked against what the gateway actually sent, so build the request from the real incoming request: the raw body bytes, the headers and the query string. Never rebuild it from parsed input such as `r.ParseForm()` values, a struct decoded with `json.Unmarshal` or Gin's `c.ShouldBind`: a JSON number such as `1000.50` would come back as `1000.5` and break a signature over the exact text.

| Constructor | Use when |
|---|---|
| `myanmarpayments.NewCallbackRequestFromHTTP(r)` | Every framework that exposes an `*http.Request`: reads the body once and keeps the headers and query. The body of `r` is restored, so it can still be read |
| `myanmarpayments.NewCallbackRequest(body, header, query)` | Any other server: pass the raw body bytes, an `http.Header` and `url.Values`. `nil` header and query are allowed |
| `myanmarpayments.NewCallbackRequestFromJSON(payload, header)` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table |

| Framework | `*http.Request` |
|---|---|
| `net/http`, chi | `r` |
| Gin | `c.Request` |
| Echo | `c.Request()` |

| Member | Description |
|---|---|
| `Body` | The raw body as `[]byte`, exactly as received |
| `Header` | The request headers, an `http.Header` |
| `Query` | The query string values, `url.Values` |
| `HeaderValue(name)` | One header, case-insensitively, or `""` |
| `ParsedBody()` | The body decoded as JSON (when it is a JSON object) or a urlencoded form (the first value of a repeated key; a malformed pair is skipped); JSON numbers become `json.Number`, which keeps their exact text |
| `Input()` | The parsed body merged over the query string |
| `QueryInput()` | The query string merged over the parsed body |

## Rules

- **Verify, then trust.** A callback that fails verification returns `*myanmarpayments.SignatureVerificationError`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; `Raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.Amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount.Equals`.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `callback.Acknowledgement` holds the response the gateway expects (`Status`, `Body`, `Headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`callback.Acknowledgement` is an `Acknowledgement` with `Status`, `Body` and `Headers`. `Write` sets the headers, then writes the status (`200` when it is `0`) and the body to any `http.ResponseWriter`:

| Framework | Response |
|---|---|
| `net/http`, chi | `callback.Acknowledgement.Write(w)` |
| Gin | `callback.Acknowledgement.Write(c.Writer)` |
| Echo | `callback.Acknowledgement.Write(c.Response())` |

`myanmarpayments.DefaultAcknowledgement()` is the empty `200 text/plain` response most gateways expect.

Gateway callbacks are server-to-server posts: exclude these routes from CSRF protection (e.g. `gorilla/csrf` middleware).

## PaymentStatus

Every gateway's own status values are mapped onto one `string` type. The original value stays in `callback.GatewayStatus`.

| Constant | Value | Meaning |
|---|---|---|
| `StatusSuccessful` | `successful` | The customer paid. The only status that means money was collected. |
| `StatusPending` | `pending` | Still in progress or waiting on the customer. |
| `StatusFailed` | `failed` | Attempted and failed or rejected. |
| `StatusCanceled` | `canceled` | Canceled or closed before completing. |
| `StatusExpired` | `expired` | The payment window ran out. |
| `StatusUnknown` | `unknown` | A status this package does not recognize yet. Inspect `GatewayStatus`. |

`PaymentStatus` is a `string` type, so `callback.Status == "successful"` works and `string(callback.Status)` is the value. `status.IsFinal()` is `false` for `StatusPending` and `StatusUnknown`. Unknown statuses never return an error.

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

Status checks return a `*myanmarpayments.PaymentStatusResult` with the same `Status`, `GatewayStatus`, `GatewayReference` and `Amount` fields.

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
