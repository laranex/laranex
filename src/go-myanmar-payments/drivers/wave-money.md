---
title: Wave Money
description: Integrate Wave Money (WavePay) in Go. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

| Method | Flow | Returns |
|---|---|---|
| `wave.Initiate(ctx, &data)` | Redirect to Wave's payment page | [`*RedirectPayment`](/go-myanmar-payments/payment-flows#redirect-payments) |
| `wave.HandleCallback(request)` | Verify the callback | `*PaymentCallback` |

Wave has no status API: the callback is the only payment result.

::: warning Sandbox host
Wave's documented test host `testpayments.wavemoney.io` no longer resolves in DNS (checked October 2026). If Wave gives you a different test host, set it as `BaseURL`; otherwise testing happens against production with your merchant credentials.
:::

## Initiating a Payment

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments"
	"github.com/laranex/go-myanmar-payments/wavemoney"
)

wave, err := wavemoney.New(wavemoney.Config{MerchantID: "...", SecretKey: "...", MerchantName: "My Shop"}, nil)
if err != nil {
	return err
}

data := wavemoney.PaymentData{
	OrderID:     orderID,
	CallbackURL: "https://shop.test/payments/wave/callback",
	ReturnURL:   "https://shop.test/orders/" + orderID,
	Description: "Order #" + orderID,
	Items: []wavemoney.Item{
		{Name: "Product A", Amount: myanmarpayments.Kyat(3000)},
		{Name: "Product B", Amount: myanmarpayments.Kyat(2000)},
	},
}

payment, err := wave.Initiate(ctx, &data)
if err != nil {
	return err
}
saveWaveReference(orderID, data.MerchantReferenceID) // filled in by Initiate
http.Redirect(w, r, payment.URL, http.StatusFound)
```

`Initiate` takes a pointer so it can record the generated `MerchantReferenceID` on your struct.

### wavemoney.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Your order id. One order can have several payment attempts |
| `CallbackURL` | `string` | Yes | HTTPS URL on the standard port 443 that Wave posts the result to, with a CA-issued certificate |
| `ReturnURL` | `string` | Yes | Valid URL Wave sends the customer back to. Not proof of payment |
| `Description` | `string` | Yes | Shown to the customer |
| `Items` | `[]wavemoney.Item` | Yes | At least one item, each with a `Name` and an `Amount` in whole kyat greater than 0 |
| `Amount` | `myanmarpayments.Amount` | No | Whole kyat (Wave does not accept decimals), greater than 0. Leave it unset to charge the sum of the items. Wave only accepts MMK |
| `MerchantReferenceID` | `string` | No | Unique id of this attempt. Empty means a random id |

`data.ResolvedAmount()` returns the total that will be charged; items are summed with exact integer arithmetic.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random id, and **store it** after `Initiate`: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present.

## Handling Callbacks

```go
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest)
	return
}
callback, err := wave.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
if callback.IsSuccessful() {
	// callback.OrderID, callback.Raw["merchantReferenceId"], callback.GatewayReference (Wave transactionId)
}
callback.Acknowledgement.Write(w)
```

`callback.OrderID` falls back to `merchantReferenceId` when Wave omits `orderId`.

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `StatusSuccessful` |
| `INSUFFICIENT_BALANCE` | `StatusPending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `StatusFailed` |
| `PAYMENT_REQUEST_CANCELLED` | `StatusCancelled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `StatusExpired` |
| anything else | `StatusUnknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

A rejected request returns `*myanmarpayments.APIError`; `HTTPStatus` tells them apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`GatewayCode` is `VALIDATION_ERROR`).
