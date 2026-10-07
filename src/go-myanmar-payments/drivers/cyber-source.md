---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Go. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `cs.Initiate(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](/go-myanmar-payments/payment-flows#form-payments) |
| `cs.HandleCallback(request)` | Verify the result post | `*PaymentCallback` |

CyberSource has no status API in this package: rely on the callback.

## Initiating a Payment

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments"
	"github.com/laranex/go-myanmar-payments/cybersource"
)

cs, err := cybersource.New(cybersource.Config{ProfileID: "...", AccessKey: "...", SecretKey: "..."})
if err != nil {
	return err
}

payment, err := cs.Initiate(cybersource.PaymentData{
	OrderID:     "ORDER-" + orderID,
	Amount:      myanmarpayments.MustParseAmount("10.50"),
	Currency:    "USD",
	CallbackURL: "https://shop.test/payments/cybersource/callback",
	ReturnURL:   "https://shop.test/payments/cybersource/receipt",
	CancelURL:   "https://shop.test/checkout",
})
if err != nil {
	return err
}
w.Header().Set("Content-Type", "text/html; charset=utf-8")
io.WriteString(w, payment.HTML()) // posts the signed form to CyberSource on load
```

`cybersource.New` takes no HTTP client: CyberSource only signs fields and makes no HTTP calls.

### cybersource.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `Amount` | `myanmarpayments.Amount` | Yes | Order total in `Currency`, 0 or more, any number of decimals, at most 15 characters |
| `CallbackURL` | `string` | Yes | HTTPS URL CyberSource posts the result to. At most 255 characters |
| `ReturnURL` | `string` | No | HTTPS receipt page for the customer. At most 255 characters |
| `CancelURL` | `string` | No | HTTPS page shown when the customer cancels. At most 255 characters |
| `Currency` | `string` | No | Any ISO 4217 code (CyberSource is multi-currency). Empty means `MMK` |
| `TransactionType` | `cybersource.TransactionType` | No | `Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `Locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`. Empty means `en-us` |

## Handling Callbacks

CyberSource posts a form to `CallbackURL`. The same check works for the browser post to your receipt page.

```go
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest)
	return
}
callback, err := cs.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
if callback.IsSuccessful() {
	// callback.OrderID (req_reference_number), callback.GatewayReference (transaction_id)
}
callback.Acknowledgement.Write(w)
```

A post whose `signed_field_names` lists a field that is missing fails verification.

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `StatusSuccessful` |
| `REVIEW` | `StatusPending` |
| `DECLINE`, `ERROR` | `StatusFailed` |
| `CANCEL` | `StatusCancelled` |
| anything else | `StatusUnknown` |
