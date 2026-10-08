---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in Go. Ready-made QR images, QR renewal, status checks and verified callbacks.
---

# Yoma MMQR

| Method | Flow | Returns |
|---|---|---|
| `yoma.Initiate(ctx, data)` | Check out the order and generate its first QR | [`*QrPayment`](#initiate-response) |
| `yoma.RenewQR(ctx, orderID)` | Generate a new QR for a checked-out order | [`*QrPayment`](#renewqr-response) |
| `yoma.Status(ctx, reference)` | Check a QR's payment status | [`*PaymentStatusResult`](#status-response) |
| `yoma.HandleCallback(request)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |
| `yoma.ForgetToken()` | Drop the cached access token, e.g. after rotating the client secret | nothing |

[Responses](#responses) shows what Yoma puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yoma.Initiate(ctx, data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: 'QRImage, a base64 PNG', response: true },
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
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
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

## Responses

What Yoma puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`; a field the gateway didn't send is `""`. Network failures and a canceled `ctx` return `*APIError`, which unwraps to the cause (`errors.Is(err, context.DeadlineExceeded)`).

### `Initiate()` → `*myanmarpayments.QrPayment` {#initiate-response}

| Field / Method | Yoma value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `QRString` | Always `""` |
| `QRImage` | Yoma `qrString`, a base64 PNG to display as is. Always set |
| `ExpiresAt` | Now + 120 seconds (`yomammqr.QRLifetime`). Always set |
| `Reference` | Yoma `refLabel`: pass it to `Status`. Always set |
| `Raw` | The `qr/generate` response, including `qrString` and `refLabel` |
| `QRImageDataURI("")` | `data:image/png;base64,…` |

`Initiate` checks the order out (`payment/checkout`) and then calls `RenewQR`, so this is the first QR. Errors: `*InvalidPaymentDataError` (no request sent), `*APIError` (token request failed, HTTP error, an `errorCode` even on HTTP 200, e.g. `PAYMENT ALREADY EXISTS`, `checkOutStatus` not `true`, or no `qrString` / `refLabel`).

### `RenewQR()` → `*myanmarpayments.QrPayment` {#renewqr-response}

The same values as `Initiate()` for the `orderID` you passed, with a new `QRImage`, `Reference` and `ExpiresAt`. The previous `Reference` stops working. Errors: `*APIError`, as `Initiate()`.

### `Status()` → `*myanmarpayments.PaymentStatusResult` {#status-response}

| Field | Yoma value |
|---|---|
| `OrderID` | Always `""`: Yoma only returns the reference |
| `Status` | `paymentStatus` mapped, see [Statuses](#statuses). `StatusExpired` for a `QR EXPIRED` error |
| `GatewayStatus` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `GatewayReference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `Amount` | Always `""`: Yoma's status response has no amount |
| `Raw` | The `payment/check-status` response, including `paymentStatus` and `refLabel` (or `errorCode`) |

Errors: `*APIError` (token request failed, HTTP error, or any `errorCode` other than `QR EXPIRED`).

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | Yoma value |
|---|---|
| `OrderID` | Yoma `orderNumber` (your `OrderID`) |
| `Status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `GatewayStatus` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `GatewayReference` | Always `""`: Yoma's callback has no reference |
| `Amount` | Always `""`: Yoma's callback has no amount |
| `Raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `*SignatureVerificationError` when `X-Webhook-Secret` is missing or wrong (with `WebhookSecret` set), `orderNumber` is missing, or `hashValue` does not match.

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
