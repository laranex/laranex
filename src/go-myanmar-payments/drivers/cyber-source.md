---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Go. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance is a hosted checkout for card payments, in MMK or any other currency.

| Call | What it does | Returns |
|---|---|---|
| `cs.Initiate(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](#initiate-response) |
| `cs.HandleCallback(request)` | Verify the result post | [`*PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'cs.Initiate(data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cs.HandleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cs.HandleCallback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```go
import (
	"fmt"
	"io"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/cybersource"
)

cs, err := cybersource.New(cybersource.Config{
	ProfileID: "...",
	AccessKey: "...",
	SecretKey: "...",
})
if err != nil {
	return err
}

data := cybersource.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	Amount:      myanmarpayments.Kyat(10000),
	CallbackURL: "https://shop.test/payments/cybersource/callback",
	ReturnURL:   "https://shop.test/payments/cybersource/receipt",
	CancelURL:   "https://shop.test/checkout",
}

payment, err := cs.Initiate(data)
if err != nil {
	return err
}

// The page posts the signed form to CyberSource on load.
w.Header().Set("Content-Type", "text/html; charset=utf-8")
io.WriteString(w, payment.HTML())
```

### cybersource.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `Amount` | `myanmarpayments.Amount` | Yes | Order total in `Currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `Kyat(10000)` or `MustParseAmount("10.50")` |
| `CallbackURL` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `ReturnURL` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `CancelURL` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `Currency` | `string` | No | Any three-letter uppercase ISO 4217 code. Empty means `MMK` |
| `TransactionType` | `cybersource.TransactionType` | No | `cybersource.Sale` (`"sale"`, the default), `.Authorization` (`"authorization"`), `.SaleAndCreateToken` (`"sale,create_payment_token"`) or `.AuthorizationAndCreateToken` (`"authorization,create_payment_token"`). Empty means `Sale` |
| `Locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`. Empty means `en-us` |

### Amounts and Currencies

CyberSource is multi-currency and accepts decimals. For another currency, pass an [`Amount`](/go-myanmar-payments/amounts) with the currency: `Amount: myanmarpayments.MustParseAmount("10.50"), Currency: "USD"`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. `payment.Enctype` carries it; use it if you [render the form yourself](/go-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

CyberSource posts a form to `CallbackURL`. The same check works for the browser post to your receipt page.

```go
import (
	"net/http"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

// POST /payments/cybersource/callback
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
callback, err := cs.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}

if callback.IsSuccessful() {
	// callback.OrderID is your req_reference_number
	// callback.GatewayReference is CyberSource's transaction_id
}

callback.Acknowledgement.Write(w)
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `Raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`. A field the gateway didn't send is `""`. CyberSource posts form fields, so every `Raw` value is a `string`, exactly as sent.

### `Initiate()` → `*myanmarpayments.FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `Flow()` | `FlowForm` |
| `OrderID` | Your `data.OrderID` |
| `Action` | `{BaseURL}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `Fields` | The signed fields below, in signing order. Post them unchanged |
| `Enctype` | `application/x-www-form-urlencoded` |
| `HTML()` | A full HTML page that posts `Fields` to `Action` on load |

| Form field | Value |
|---|---|
| `access_key` | `Config.AccessKey` |
| `profile_id` | `Config.ProfileID` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The field names in this table except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.Locale`, `en-us` when empty |
| `transaction_type` | `data.TransactionType`, `sale` when empty |
| `reference_number` | `data.OrderID` |
| `amount` | `data.Amount`, e.g. `10000` |
| `currency` | `data.Currency`, `MMK` when empty |
| `override_custom_receipt_page` | `data.ReturnURL`, `""` when unset |
| `override_backoffice_post_url` | `data.CallbackURL` |
| `override_custom_cancel_page` | `data.CancelURL`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`Initiate` makes no HTTP call, so it takes no context and `cybersource.New` takes no HTTP client. `FormPayment` has no `Raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `OrderID` | CyberSource `req_reference_number` (your `OrderID`) |
| `Status` | `decision` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `GatewayReference` | CyberSource `transaction_id`. `""` when it is not signed |
| `Amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only |
| `Raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `StatusSuccessful` |
| `REVIEW` | `StatusPending` |
| `DECLINE`, `ERROR` | `StatusFailed` |
| `CANCEL` | `StatusCanceled` |
| anything else | `StatusUnknown` |

## Errors

| Call | Returns | When |
|---|---|---|
| `Initiate()` | `*InvalidPaymentDataError` | `data.Validate()` fails. Nothing is signed |
| `HandleCallback()` | `*SignatureVerificationError` | `signature` doesn't match, a field listed in `signed_field_names` is missing or holds an object or array, or `decision` or `req_reference_number` isn't signed |

The error types live in the root `myanmarpayments` package. CyberSource makes no HTTP calls, so nothing returns `*APIError`.
