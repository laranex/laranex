---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in Go. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `yoma.Initiate(ctx, data)` | Check out the order and generate its first QR | [`*QrPayment`](/go-myanmar-payments/payment-flows#qr-payments) |
| `yoma.RenewQR(ctx, orderID)` | Generate a new QR for a checked-out order | `*QrPayment` |
| `yoma.Status(ctx, reference)` | Check a QR's payment status | `*PaymentStatusResult` |
| `yoma.HandleCallback(request)` | Verify the callback | `*PaymentCallback` |
| `yoma.ForgetToken()` | Drop the cached access token, e.g. after rotating the client secret | |

## Initiating a Payment

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments"
	"github.com/laranex/go-myanmar-payments/yomammqr"
)

yoma, err := yomammqr.New(
	yomammqr.Config{MerchantID: "...", ClientID: "...", ClientSecret: "...", WebhookHashKey: "..."},
	nil, // default HTTP client
	nil, // in-memory token cache; share this gateway across requests
)
if err != nil {
	return err
}

payment, err := yoma.Initiate(ctx, yomammqr.PaymentData{
	OrderID:     "ORD-" + orderID,
	Amount:      myanmarpayments.Kyat(10000),
	Description: "Order #" + orderID,
})
if err != nil {
	return err
}
saveQRReference(orderID, payment.Reference)
// <img src="{{.QR}}"> with template.URL(payment.QRImageDataURI(""))
```

`QRImage` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

### yomammqr.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique order number, at most 20 characters |
| `Amount` | `myanmarpayments.Amount` | Yes | Whole kyat, greater than 0 (Yoma documents no decimals or currency) |
| `Description` | `string` | Yes | At most 50 characters |

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`yomammqr.QRLifetime`); `payment.ExpiresAt` tells you when. Yoma accepts each order number **once**, so never call `Initiate` again for the same order. Renew the QR instead:

```go
payment, err := yoma.RenewQR(ctx, "ORD-"+orderID)
```

Each renewal retires the previous `Reference`; only the newest one answers status checks.

## Status Checks

```go
result, err := yoma.Status(ctx, payment.Reference)
```

An expired QR returns `StatusExpired` (with `GatewayStatus` `QR EXPIRED`) instead of an error. `result.OrderID` is empty here because Yoma only returns the reference.

## Handling Callbacks

```go
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest)
	return
}
callback, err := yoma.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
if callback.IsSuccessful() {
	// callback.OrderID is your order number
}
callback.Acknowledgement.Write(w)
```

The callback URL is registered with Yoma, not sent per order. When `WebhookSecret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `WebhookHashKey`.

::: warning
Yoma's specification does not name the hash algorithm; HMAC-SHA256 is inferred from its sample. Confirm it with Yoma before going live.
:::

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `StatusSuccessful` |
| `PENDING` | `StatusPending` |
| `fail` (callback), `FAILED` (status) | `StatusFailed` |
| `QR EXPIRED` error | `StatusExpired` |
| anything else | `StatusUnknown` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The gateway keeps it in the [token cache](/go-myanmar-payments/configuration#token-cache) and fetches a new one, retrying once, when Yoma answers `401`.

## Errors

Yoma reports business errors with HTTP 200 and an `errorCode`; the package returns `*myanmarpayments.APIError` for them, e.g. `PAYMENT ALREADY EXISTS` when an order is checked out twice.
