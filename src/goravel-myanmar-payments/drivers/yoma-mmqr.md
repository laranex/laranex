---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR with Goravel Myanmar Payments. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

Yoma MMQR is Yoma Bank's MMQR gateway: it issues ready-made QR images that customers scan with any MMQR wallet.

| Call | What it does | Returns |
|---|---|---|
| `yoma.Initiate(ctx, data)` | Check out the order and generate its first QR | [`*QrPayment`](#initiate-response) |
| `yoma.RenewQR(ctx, orderID)` | Generate a new QR for a checked-out order | [`*QrPayment`](#renewqr-response) |
| `yoma.Status(ctx, reference)` | Check a QR's payment status | [`*PaymentStatusResult`](#status-response) |
| `yoma.HandleCallback(request)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |

`yoma` is the `*yomammqr.Gateway` that `paymentsfacades.MyanmarPayments().YomaMmqr()` returns. [Responses](#responses) shows what Yoma MMQR puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yoma.Initiate(ctx, data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: 'payment.QRImageDataURI(mimeType)', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yoma.RenewQR(ctx, orderID)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.HandleCallback(request)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: 'yoma.Status(ctx, reference)' },
  ]"
/>

## Initiating a Payment

```go
import (
	"fmt"
	"html/template"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) Yoma(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	yoma, err := paymentsfacades.MyanmarPayments().YomaMmqr()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	data := yomammqr.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		Amount:      myanmarpayments.Kyat(10000),
		Description: fmt.Sprintf("Order #%d", order.ID),
	}

	payment, err := yoma.Initiate(ctx, data)
	if err != nil {
		return ctx.Response().String(http.StatusBadGateway, "%s", err)
	}

	order.QRReference = payment.Reference
	saveOrder(order) // your own persistence

	return ctx.Response().View().Make("payments/qr.tmpl", map[string]any{
		"qr": template.URL(payment.QRImageDataURI("")),
	})
}
```

```html
<img src="{{ .qr }}" alt="Scan with any MMQR wallet">
```

### yomammqr.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique order number, at most 20 characters |
| `Amount` | `myanmarpayments.Amount` | Yes | Whole kyat, greater than 0, e.g. `Kyat(10000)`. Yoma documents no decimals or currency |
| `Description` | `string` | Yes | At most 50 characters |

### QR Image

`QRImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed. Wrap the data URI in `template.URL`, or `html/template` replaces it with `#ZgotmplZ`.

## Handling Callbacks

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Post("/payments/yoma/callback", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	yoma, err := paymentsfacades.MyanmarPayments().YomaMmqr()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	callback, err := yoma.HandleCallback(request)
	if err != nil { // *myanmarpayments.SignatureVerificationError
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	if callback.IsSuccessful() {
		// callback.OrderID is your orderNumber
	}

	return payments.Acknowledge(ctx, callback)
})
```

The callback URL is registered with Yoma, not sent per order. When `YOMA_MMQR_WEBHOOK_SECRET` is set, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `YOMA_MMQR_WEBHOOK_HASHKEY`.

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`yomammqr.QRLifetime`); `payment.ExpiresAt` tells you when. Yoma accepts each order number **once**, so never call `Initiate()` again for the same order. Renew the QR instead:

```go
import (
	"fmt"

	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

yoma, err := paymentsfacades.MyanmarPayments().YomaMmqr()
payment, err := yoma.RenewQR(ctx, fmt.Sprintf("ORDER_%d", order.ID))

order.QRReference = payment.Reference
```

Each renewal retires the previous `Reference`; only the newest one answers status checks.

## Status Checks

```go
import paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

yoma, err := paymentsfacades.MyanmarPayments().YomaMmqr()
result, err := yoma.Status(ctx, order.QRReference)

if err == nil && result.IsSuccessful() {
	// the QR was paid
}
```

`Status()` takes the QR's `Reference`, not your `OrderID`. An expired QR returns `StatusExpired` instead of an error.

## Responses

What Yoma MMQR puts in each field. See [Results](/goravel-myanmar-payments/references/results) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types.

### `Initiate()` → `*QrPayment` {#initiate-response}

| Field / Method | Yoma MMQR value |
|---|---|
| `OrderID` | Your `OrderID` (Yoma `orderNumber`) |
| `QRString` | Always empty |
| `QRImage` | Yoma `qrString`, a base64 PNG of the payment slip. Always set |
| `ExpiresAt` | Now + 120 seconds (`yomammqr.QRLifetime`). Always set |
| `Reference` | Yoma `refLabel`, e.g. `100000083331`. Pass it to `Status()`. Always set |
| `Raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`null`), `errorDescription` |
| `QRImageDataURI("")` | `data:image/png;base64,…` |

`Initiate()` checks the order out (`payment/checkout`), then generates its first QR; the result comes from the generate call.

### `RenewQR()` → `*QrPayment` {#renewqr-response}

The same values as [`Initiate()`](#initiate-response) for the `orderID` you passed, with a new `QRImage`, `Reference` and `ExpiresAt`. The previous `Reference` stops answering status checks.

### `Status()` → `*PaymentStatusResult` {#status-response}

| Field | Yoma MMQR value |
|---|---|
| `OrderID` | Always empty: Yoma only returns the reference |
| `Status` | `paymentStatus` mapped, see [Statuses](#statuses). `StatusExpired` for a `QR EXPIRED` error |
| `GatewayStatus` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `GatewayReference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `Amount` | Always empty: Yoma's status response has no amount |
| `Raw` | The `payment/check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | Yoma MMQR value |
|---|---|
| `OrderID` | Yoma `orderNumber` (your `OrderID`) |
| `Status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `GatewayStatus` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `GatewayReference` | Always empty: Yoma's callback has no reference |
| `Amount` | Always empty: Yoma's callback has no amount |
| `Raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`payments.Acknowledge(ctx, callback)` writes `Acknowledgement` as the Goravel response. `HandleCallback()` takes the `*myanmarpayments.CallbackRequest` that `payments.CallbackRequestFromContext(ctx)` builds.

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `StatusSuccessful` |
| `PENDING` | `StatusPending` |
| `fail` (callback), `FAILED` (status) | `StatusFailed` |
| `QR EXPIRED` error | `StatusExpired` |
| anything else | `StatusUnknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The package caches it in your cache store (see [Configuration](/goravel-myanmar-payments/configuration#cache)) and fetches a new one, retrying once, when Yoma answers `401`. `yoma.ForgetToken()` drops the cached token, e.g. after rotating the client secret.

## Errors

| Call | Returns | When |
|---|---|---|
| `Initiate()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is sent |
| `Initiate()` | `*APIError` | The token request fails, Yoma answers with an HTTP error or an `errorCode` (e.g. `PAYMENT ALREADY EXISTS`), `checkOutStatus` isn't `true`, or there is no `qrString` or `refLabel` |
| `RenewQR()` | `*APIError` | As `Initiate()`, without the checkout |
| `Status()` | `*APIError` | The token request fails, or Yoma answers with an HTTP error or any `errorCode` other than `QR EXPIRED` |
| `HandleCallback()` | `*SignatureVerificationError` | `X-Webhook-Secret` is missing or wrong (when a webhook secret is set), `orderNumber` is missing, or `hashValue` doesn't match |

Yoma reports business errors with HTTP 200 and an `errorCode`; `*APIError` carries it in `GatewayCode` and Yoma's `errorDescription` in `GatewayMessage`. When Yoma can't be reached, the calls return an `*APIError` with `HTTPStatus` `0`.
