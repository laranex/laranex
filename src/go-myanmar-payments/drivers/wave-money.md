---
title: Wave Money
description: Integrate Wave Money (WavePay) in Go. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

Wave Money's payment gateway sends the customer to a Wave payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `wave.Initiate(ctx, &data)` | Redirect to Wave's payment page | [`*RedirectPayment`](#initiate-response) |
| `wave.HandleCallback(request)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |

Wave Money has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what Wave Money puts in each result.

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
	"fmt"
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavemoney"
)

wave, err := wavemoney.New(wavemoney.Config{
	MerchantID:        "...",
	SecretKey:         "...",
	MerchantName:      "My Shop",
	TimeToLiveSeconds: 300,
	TimeoutSeconds:    30,
}, nil)
if err != nil {
	return err
}

data := wavemoney.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	CallbackURL: "https://shop.test/payments/wave/callback",
	ReturnURL:   fmt.Sprintf("https://shop.test/orders/%d", order.ID),
	Description: fmt.Sprintf("Order #%d", order.ID),
	Items: []wavemoney.Item{
		{Name: "Product A", Amount: myanmarpayments.Kyat(6000)},
		{Name: "Product B", Amount: myanmarpayments.Kyat(4000)},
	},
}

payment, err := wave.Initiate(ctx, &data)
if err != nil {
	return err
}

// Store data.MerchantReferenceID with the order: Initiate filled it in.

http.Redirect(w, r, payment.URL, http.StatusFound)
```

### wavemoney.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Your order ID: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `CallbackURL` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `ReturnURL` | `string` | Yes | Absolute http or https URL Wave sends the customer back to. Not proof of payment |
| `Description` | `string` | Yes | Shown to the customer |
| `Items` | `[]wavemoney.Item` | Yes | At least one item |
| `Amount` | `myanmarpayments.Amount` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `MerchantReferenceID` | `string` | No | Unique ID of this attempt: letters, digits, `_` and `-` only. Empty means a random ID |
| `MerchantName` | `string` | No | Business name shown on Wave's page for this payment. Empty uses `Config.MerchantName`; a name made only of whitespace is rejected |
| `TimeToLiveSeconds` | `*int` | No | Seconds the customer has to pay this payment, greater than 0, e.g. `seconds := 600` then `TimeToLiveSeconds: &seconds`. `nil` uses `Config.TimeToLiveSeconds`; `0` is rejected |

`wavemoney.Item` has a `Name` and an `Amount` in whole kyat, greater than 0. The items are summed with exact integer arithmetic, never floats; `data.ResolvedAmount()` returns the total that will be charged. Item names are sent as written: `<`, `>` and `&` are not escaped in the `items` JSON.

### Per-Payment Merchant Name and Time to Live

`MerchantName` and `TimeToLiveSeconds` override the `wavemoney.Config` values for one payment, including in the request hash. The configured `MerchantName` is still required and applies to every payment that leaves it empty; the configured `TimeToLiveSeconds` is optional. With neither the configured time to live nor `TimeToLiveSeconds` set, `Initiate` returns `*myanmarpayments.InvalidPaymentDataError` with `The timeToLiveSeconds field is required when the wave_money configuration has no [time_to_live_in_seconds].` before any request.

```go
seconds := 600
data := wavemoney.PaymentData{
	OrderID:           fmt.Sprintf("ORDER_%d", order.ID),
	CallbackURL:       "https://shop.test/payments/wave/callback",
	ReturnURL:         fmt.Sprintf("https://shop.test/orders/%d", order.ID),
	Description:       fmt.Sprintf("Order #%d", order.ID),
	Items:             []wavemoney.Item{{Name: "Concert ticket", Amount: myanmarpayments.Kyat(25000)}},
	MerchantName:      "My Shop Events",
	TimeToLiveSeconds: &seconds,
}
```

A `MerchantName` made only of whitespace returns `*InvalidPaymentDataError` with `The merchantName field is required.`, and a `TimeToLiveSeconds` below 1 with `The timeToLiveSeconds field must be greater than 0.` Nothing is sent.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present. `Initiate` takes a pointer and writes the generated ID to `data.MerchantReferenceID` once `data` passes validation.

## Handling Callbacks

```go
import (
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

// POST /payments/wave/callback
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
callback, err := wave.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}

if callback.IsSuccessful() {
	// callback.OrderID is your OrderID
	// callback.Raw["merchantReferenceId"] is the attempt's reference
	// callback.GatewayReference is Wave's transactionId
}

callback.Acknowledgement.Write(w)
```

`callback.OrderID` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

Wave hashes the values joined with no separator, so a matching `hashValue` alone doesn't pin down where one value ends and the next begins. After the hash matches, `amount` must be a decimal (e.g. `10000` or `10000.00`), at least one of `orderId` and `merchantReferenceId` must be present, and each one sent may only hold letters, digits, `_` and `-`; otherwise `HandleCallback` returns `*myanmarpayments.SignatureVerificationError`. New payments are held to the same ID rules, so every callback for a payment made with this package passes them.

## Responses

What Wave Money puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`. A field the gateway didn't send is `""`. `Raw` holds plain Go values (JSON numbers become `json.Number`s), while the typed fields such as `Amount` keep the exact text Wave sent.

### `Initiate()` → `*myanmarpayments.RedirectPayment` {#initiate-response}

| Field / Method | Wave Money value |
|---|---|
| `Flow()` | `FlowRedirect` |
| `OrderID` | Your `data.OrderID` |
| `URL` | `{BaseURL}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `GatewayReference` | Wave `transaction_id`. Always set |
| `Raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `MerchantReferenceID` is not on the result: read it from `data.MerchantReferenceID`.

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | Wave Money value |
|---|---|
| `OrderID` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `Status` | `status` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `GatewayReference` | Wave `transactionId` |
| `Amount` | Wave `amount`, e.g. `10000` |
| `Raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

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
| `Initiate()` | `*InvalidPaymentDataError` | `data.Validate()` fails. Nothing is sent and `data` is left untouched. Item errors use `items.0.amount` keys |
| `Initiate()` | `*APIError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `HandleCallback()` | `*SignatureVerificationError` | `hashValue` doesn't match, a hashed field holds an object or array, `amount` isn't a decimal, both `orderId` and `merchantReferenceId` are empty, or either holds anything but letters, digits, `_` and `-` |

The error types live in the root `myanmarpayments` package. `HTTPStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`GatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached or `ctx` is canceled, `Initiate` returns `*APIError`, which unwraps to the cause (`errors.Is(err, context.DeadlineExceeded)`).
