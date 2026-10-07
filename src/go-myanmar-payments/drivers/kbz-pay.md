---
title: KBZ Pay
description: Integrate KBZ Pay in Go. PWA redirect, QR and in-app payments from one kbzpay.PaymentData, plus status checks and verified callbacks.
---

# KBZ Pay

| Method | Flow | Returns |
|---|---|---|
| `kbz.PWA(ctx, data)` | Redirect to the KBZ Pay PWA | [`*RedirectPayment`](/go-myanmar-payments/payment-flows#redirect-payments) |
| `kbz.QR(ctx, data)` | Customer scans a QR | [`*QrPayment`](/go-myanmar-payments/payment-flows#qr-payments) |
| `kbz.App(ctx, data)` | Your mobile app opens the KBZ Pay SDK | [`*AppPayment`](/go-myanmar-payments/payment-flows#app-payments) |
| `kbz.Status(ctx, orderID)` | Query an order | `*PaymentStatusResult` |
| `kbz.HandleCallback(request)` | Verify the notification | `*PaymentCallback` |

## Initiating a Payment

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments"
	"github.com/laranex/go-myanmar-payments/kbzpay"
)

kbz, err := kbzpay.New(kbzpay.Config{AppID: "...", AppKey: "...", MerchantCode: "..."}, nil)
if err != nil {
	return err
}

data := kbzpay.PaymentData{
	OrderID:     "ORDER_" + orderID,
	Amount:      myanmarpayments.Kyat(10000),
	CallbackURL: "https://shop.test/payments/kbz/callback",
}

// PWA
redirect, err := kbz.PWA(ctx, data)
http.Redirect(w, r, redirect.URL, http.StatusFound)

// QR: encode qr.QRString into a QR image
qr, err := kbz.QR(ctx, data)

// In-app: hand the signed values to your mobile app
app, err := kbz.App(ctx, data)
json.NewEncoder(w).Encode(app)
```

### kbzpay.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique per order. Letters, digits and `_` only, at most 40 characters |
| `Amount` | `myanmarpayments.Amount` | Yes | Kyat, greater than 0, at most 2 decimal places, e.g. `MustParseAmount("1000.50")`. KBZ only accepts MMK |
| `CallbackURL` | `string` | Yes | Public URL KBZ posts the result to. At most 512 characters, no query string |
| `Title` | `string` | No | Product name shown to the customer |
| `TimeoutMinutes` | `int` | No | 1 to 120. `0` leaves it to KBZ (120) |
| `CallbackInfo` | `string` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

`data.Validate()` runs before every request and returns `*myanmarpayments.InvalidPaymentDataError`.

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.
- `QR` sets `ExpiresAt` only when `TimeoutMinutes` is given.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; build the `CallbackRequest` from the whole request.

```go
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest)
	return
}
callback, err := kbz.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
if callback.IsSuccessful() {
	// callback.OrderID is your merch_order_id, callback.GatewayReference is KBZ's mm_order_id
}
callback.Acknowledgement.Write(w) // plain-text "success"
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, poll `Status`.

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `StatusSuccessful` |
| `WAIT_PAY`, `PAYING` | `StatusPending` |
| `PAY_FAILED` | `StatusFailed` |
| `ORDER_CLOSED` | `StatusCancelled` |
| `ORDER_EXPIRED` | `StatusExpired` |
| anything else | `StatusUnknown` |

## Signing

`kbzpay.NewSigner(appKey)` exposes KBZ's signature (`SignString`, `Sign`, `Verify`) for custom calls: non-empty fields except `sign` and `sign_type`, sorted, joined as raw `key=value`, `&key=<app key>` appended, SHA-256, uppercase.

## Errors

A failed `precreate` or `queryorder` returns `*myanmarpayments.APIError` with KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `GatewayCode` and its `msg` in `GatewayMessage`.
