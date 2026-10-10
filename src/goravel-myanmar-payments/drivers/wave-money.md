---
title: Wave Money
description: Integrate Wave Money (WavePay) with Goravel Myanmar Payments. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

Wave Money's payment gateway sends the customer to a Wave payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `wave.Initiate(ctx, data)` | Redirect to Wave's payment page | [`*RedirectPayment`](#initiate-response) |
| `wave.HandleCallback(request)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |

`wave` is the `*wavemoney.Gateway` that `paymentsfacades.MyanmarPayments().WaveMoney()` returns. Wave Money has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what Wave Money puts in each result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Money: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Money']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Money', label: 'Payment request with hash', detail: 'wave.Initiate(ctx, data)' },
    { from: 'Wave Money', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Money', label: 'Pay with WavePay' },
    { from: 'Wave Money', to: 'Customer', label: 'Back to the frontend URL', detail: 'ReturnURL: not proof of payment', response: true },
    { from: 'Wave Money', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to CallbackURL, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wave.HandleCallback(request)' },
  ]"
/>

## Initiating a Payment

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavemoney"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) Wave(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	wave, err := paymentsfacades.MyanmarPayments().WaveMoney()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	data := &wavemoney.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		CallbackURL: "https://shop.test/payments/wave/callback",
		ReturnURL:   fmt.Sprintf("https://shop.test/orders/%d", order.ID),
		Description: fmt.Sprintf("Order #%d", order.ID),
		Items: []wavemoney.Item{
			{Name: "Product A", Amount: myanmarpayments.Kyat(6000)},
			{Name: "Product B", Amount: myanmarpayments.Kyat(4000)},
		},
	}

	payment, err := wave.Initiate(ctx, data)
	if err != nil {
		return ctx.Response().String(http.StatusBadGateway, "%s", err)
	}

	order.WaveReference = data.MerchantReferenceID
	saveOrder(order) // your own persistence

	return ctx.Response().Redirect(http.StatusFound, payment.URL)
}
```

### wavemoney.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Your order ID. One order can have several payment attempts |
| `CallbackURL` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `ReturnURL` | `string` | Yes | Absolute http or https URL Wave sends the customer back to. Not proof of payment |
| `Description` | `string` | Yes | Shown to the customer |
| `Items` | `[]wavemoney.Item` | Yes | At least one item |
| `Amount` | `myanmarpayments.Amount` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `MerchantReferenceID` | `string` | No | Unique ID of this attempt. Empty means a random ID |

`wavemoney.Item` takes a `Name` and an `Amount` (`myanmarpayments.Amount`) in whole kyat, greater than 0. The items are summed with exact integer arithmetic, never floats. `Initiate()` takes a pointer to the data, so it can fill in `MerchantReferenceID`.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present. Read it from `data.MerchantReferenceID`.

## Handling Callbacks

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Post("/payments/wave/callback", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	wave, err := paymentsfacades.MyanmarPayments().WaveMoney()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	callback, err := wave.HandleCallback(request)
	if err != nil { // *myanmarpayments.SignatureVerificationError
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	if callback.IsSuccessful() {
		// callback.OrderID is your OrderID
		// callback.Raw["merchantReferenceId"] is the attempt's reference
		// callback.GatewayReference is Wave's transactionId
	}

	return payments.Acknowledge(ctx, callback)
})
```

`callback.OrderID` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave Money puts in each field. See [Results](/goravel-myanmar-payments/references/results) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types. `Raw` holds plain Go values (JSON numbers become `json.Number`s), while the typed fields such as `Amount` keep the exact text Wave sent.

### `Initiate()` → `*RedirectPayment` {#initiate-response}

| Field | Wave Money value |
|---|---|
| `OrderID` | Your `OrderID` |
| `URL` | `{authenticate_url}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `GatewayReference` | Wave `transaction_id`. Always set |
| `Raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `MerchantReferenceID` is not on the result: read it from `data.MerchantReferenceID`.

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | Wave Money value |
|---|---|
| `OrderID` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `Status` | `status` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `GatewayReference` | Wave `transactionId` |
| `Amount` | Wave `amount`, e.g. `10000` |
| `Raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`payments.Acknowledge(ctx, callback)` writes `Acknowledgement` as the Goravel response. `HandleCallback()` takes the `*myanmarpayments.CallbackRequest` that `payments.CallbackRequestFromContext(ctx)` builds.

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

| Call | Returns | When |
|---|---|---|
| `Initiate()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is sent |
| `Initiate()` | `*APIError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `HandleCallback()` | `*SignatureVerificationError` | `hashValue` doesn't match, or a hashed field holds an object or array |

`HTTPStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`GatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached, `Initiate()` returns an `*APIError` with `HTTPStatus` `0`.
