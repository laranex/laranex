---
title: KBZ Pay
description: Integrate KBZ Pay in Go. PWA redirect, QR and in-app payments from one kbzpay.PaymentData, plus status checks and verified callbacks.
---

# KBZ Pay

KBZ Pay is KBZ Bank's mobile wallet: customers pay in the KBZ Pay PWA, by scanning a QR code, or from your mobile app.

| Call | What it does | Returns |
|---|---|---|
| `kbz.PWA(ctx, data)` | Redirect to the KBZ Pay PWA | [`*RedirectPayment`](#pwa-response) |
| `kbz.QR(ctx, data)` | Customer scans a QR | [`*QrPayment`](#qr-response) |
| `kbz.App(ctx, data)` | Your mobile app opens the KBZ Pay SDK | [`*AppPayment`](#app-response) |
| `kbz.Status(ctx, orderID)` | Query an order | [`*PaymentStatusResult`](#status-response) |
| `kbz.HandleCallback(request)` | Verify the notification | [`*PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what KBZ Pay puts in each result.

## How it works

Every KBZ Pay flow starts with the same precreate call and ends with KBZ's signed notification.

<SequenceDiagram
  title="KBZ Pay: precreate, pay, notify"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Pick the flow', detail: 'kbz.PWA() / QR() / App()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Precreate the order', detail: 'PWAAPP / PAY_BY_QRCODE / APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', detail: 'plus qrCode for QR', response: true },
    { from: 'Your app', to: 'Customer', label: 'PWA URL, QR or signed order', detail: 'URL / QRString / OrderInfo + Sign', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Notify callbackUrl', detail: 'signed JSON under Request' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.HandleCallback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Plain-text success', detail: 'within about 10 s, or KBZ retries', response: true },
    { from: 'Your app', to: 'KBZ Pay', label: 'No notify? Query the order', detail: 'kbz.Status(ctx, orderID)' },
  ]"
/>

## Initiating a Payment

```go
import (
	"encoding/json"
	"fmt"
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

kbz, err := kbzpay.New(kbzpay.Config{
	AppID:        "...",
	AppKey:       "...",
	MerchantCode: "...",
}, nil)
if err != nil {
	return err
}

data := kbzpay.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	Amount:      myanmarpayments.Kyat(10000),
	CallbackURL: "https://shop.test/payments/kbz/callback",
}

// PWA: send the customer to the KBZ Pay PWA
redirect, err := kbz.PWA(ctx, data)
if err != nil {
	return err
}
http.Redirect(w, r, redirect.URL, http.StatusFound)

// QR: encode qr.QRString into a QR image
qr, err := kbz.QR(ctx, data)
if err != nil {
	return err
}

// In-app: hand the signed values to your mobile app
app, err := kbz.App(ctx, data)
if err != nil {
	return err
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(app)
```

### kbzpay.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique per order. Letters, digits and `_` only, at most 40 characters |
| `Amount` | `myanmarpayments.Amount` | Yes | Kyat, greater than 0, at most 2 decimal places, e.g. `Kyat(10000)` or `MustParseAmount("1000.50")`. KBZ only accepts MMK |
| `CallbackURL` | `string` | Yes | Public URL KBZ posts the result to. At most 512 characters, no query string |
| `Title` | `string` | No | Product name shown to the customer |
| `TimeoutMinutes` | `int` | No | 1 to 120. `0` leaves it to KBZ (120) |
| `CallbackInfo` | `string` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; build the `CallbackRequest` from the whole request.

```go
import (
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

// POST /payments/kbz/callback
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
callback, err := kbz.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}

if callback.IsSuccessful() {
	// callback.OrderID is your merch_order_id
	// callback.GatewayReference is KBZ's mm_order_id
}

callback.Acknowledgement.Write(w) // plain-text "success"
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, [query the order](#status-checks).

## Status Checks

```go
import "fmt"

result, err := kbz.Status(ctx, fmt.Sprintf("ORDER_%d", order.ID))
if err != nil {
	return err
}

if result.IsSuccessful() {
	// result.GatewayReference is KBZ's mm_order_id
}
```

`Status` takes your `OrderID`. An order KBZ doesn't know returns `*myanmarpayments.APIError`.

## Responses

What KBZ Pay puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`; a field the gateway didn't send is `""`.

### `PWA()` → `*myanmarpayments.RedirectPayment` {#pwa-response}

| Field | KBZ Pay value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `URL` | `{PWAURL}?appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…&sign=…` |
| `GatewayReference` | KBZ `prepay_id`. Always set |
| `Raw` | The `precreate` response: `result`, `code`, `msg`, `merch_order_id`, `prepay_id`, `nonce_str`, `sign_type`, `sign` |

### `QR()` → `*myanmarpayments.QrPayment` {#qr-response}

| Field / Method | KBZ Pay value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `QRString` | KBZ `qrCode`, a payload to encode into a QR image. Always set |
| `QRImage` | Always `""` |
| `ExpiresAt` | Now + `TimeoutMinutes`. The zero time when `TimeoutMinutes` is `0` (KBZ then allows 120 minutes) |
| `Reference` | KBZ `prepay_id`. Always set |
| `Raw` | The `precreate` response, as for `PWA()` plus `qrCode` |
| `QRImageDataURI("")` | Always `""`, as `QRImage` is |

### `App()` → `*myanmarpayments.AppPayment` {#app-response}

| Field | KBZ Pay value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `OrderInfo` | `appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…` |
| `Sign` | SHA-256 signature of `OrderInfo`, uppercase hex. See [Signing](#signing) |
| `SignType` | `SHA256` |
| `Raw` | The `precreate` response, as for `PWA()`. Left out of the JSON encoding |

### `Status()` → `*myanmarpayments.PaymentStatusResult` {#status-response}

| Field | KBZ Pay value |
|---|---|
| `OrderID` | KBZ `merch_order_id`, falling back to the `orderID` you passed. Always set |
| `Status` | `trade_status` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `GatewayReference` | KBZ `mm_order_id`. `""` until KBZ has created the payment |
| `Amount` | KBZ `total_amount`, e.g. `10000` |
| `Raw` | The `queryorder` response: `result`, `code`, `msg`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `nonce_str`, `sign_type`, `sign` |

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | KBZ Pay value |
|---|---|
| `OrderID` | KBZ `merch_order_id` (your `OrderID`) |
| `Status` | `trade_status` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `GatewayReference` | KBZ `mm_order_id` |
| `Amount` | KBZ `total_amount`, e.g. `10000` |
| `Raw` | The verified `Request`: `appid`, `notify_time`, `merch_code`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `callback_info`, `nonce_str`, `sign_type`, `sign` |
| `Acknowledgement` | HTTP `200`, body `success`, `Content-Type: text/plain` |

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `StatusSuccessful` |
| `WAIT_PAY`, `PAYING` | `StatusPending` |
| `PAY_FAILED` | `StatusFailed` |
| `ORDER_CLOSED` | `StatusCanceled` |
| `ORDER_EXPIRED` | `StatusExpired` |
| anything else | `StatusUnknown` |

## Signing

KBZ signs requests, the in-app `orderInfo` and notifications the same way: every non-empty field except `sign` and `sign_type`, sorted by key, joined as raw `key=value` pairs, with `&key=<app key>` appended, hashed with SHA-256 and uppercased. The package signs every request and verifies every notification for you; `kbzpay.NewSigner(appKey)` exposes the same signature for custom calls: `SignString(fields)`, `Sign(fields)` and `Verify(fields)`.

## Errors

| Call | Returns | When |
|---|---|---|
| `PWA()`, `QR()`, `App()` | `*InvalidPaymentDataError` | `data.Validate()` fails. Nothing is sent |
| `PWA()`, `QR()`, `App()` | `*APIError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, or without a `prepay_id` |
| `QR()` | `*APIError` | KBZ returns no `qrCode` |
| `Status()` | `*APIError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, e.g. for an unknown order |
| `HandleCallback()` | `*SignatureVerificationError` | `sign` doesn't match |

The error types live in the root `myanmarpayments` package. `*APIError` carries KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `GatewayCode` and its `msg` in `GatewayMessage`. When KBZ can't be reached or `ctx` is canceled, the calls return `*APIError`, which unwraps to the cause (`errors.Is(err, context.DeadlineExceeded)`).
