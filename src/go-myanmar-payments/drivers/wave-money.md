---
title: Wave Money
description: Integrate Wave Money (WavePay) in Go. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

| Method | Flow | Returns |
|---|---|---|
| `wave.Initiate(ctx, &data)` | Redirect to Wave's payment page | [`*RedirectPayment`](#initiate-response) |
| `wave.HandleCallback(request)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Wave puts in each result.

Wave has no status API: the callback is the only payment result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Money: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Money']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Money', label: 'Payment request with hash', detail: 'wave.Initiate(ctx, &data)' },
    { from: 'Wave Money', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Money', label: 'Pay with WavePay' },
    { from: 'Wave Money', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Money', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wave.HandleCallback(request)' },
  ]"
/>

## Initiating a Payment

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavemoney"
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
| `CallbackURL` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
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

`callback.OrderID` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`; a field the gateway didn't send is `""`. Network failures and a canceled `ctx` return `*APIError`, which unwraps to the cause (`errors.Is(err, context.DeadlineExceeded)`).

### `Initiate()` → `*myanmarpayments.RedirectPayment` {#initiate-response}

| Field | Wave value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `URL` | `{AuthenticateURL}/authenticate?transaction_id=…` (no port), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `GatewayReference` | Wave `transaction_id`. Always set |
| `Raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

Once `data` passes validation, `Initiate` writes the generated reference to `data.MerchantReferenceID` when you left it empty; invalid data is returned untouched. Errors: `*InvalidPaymentDataError` (no request sent), `*APIError` (HTTP error, `message` not `success`, or no `transaction_id`).

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | Wave value |
|---|---|
| `OrderID` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `Status` | `status` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `GatewayReference` | Wave `transactionId` |
| `Amount` | Wave `amount`, e.g. `5000` |
| `Raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Read the attempt's reference with `callback.Raw["merchantReferenceId"]`. Errors: `*SignatureVerificationError` when `hashValue` does not match.

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `StatusSuccessful` |
| `INSUFFICIENT_BALANCE` | `StatusPending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `StatusFailed` |
| `PAYMENT_REQUEST_CANCELLED` | `StatusCanceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `StatusExpired` |
| anything else | `StatusUnknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

A rejected request returns `*myanmarpayments.APIError`; `HTTPStatus` tells them apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`GatewayCode` is `VALIDATION_ERROR`).
