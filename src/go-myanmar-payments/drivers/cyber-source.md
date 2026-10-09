---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Go. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `cs.Initiate(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](#initiate-response) |
| `cs.HandleCallback(request)` | Verify the result post | [`*PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what CyberSource puts in each result.

CyberSource has no status API in this package: rely on the callback.

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
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/cybersource"
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
| `CallbackURL` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `ReturnURL` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `CancelURL` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
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

Only signed fields are trusted. A post fails verification when `signed_field_names` lists a field that is missing, or when it does not list `decision` and `req_reference_number`. The amount and `transaction_id` are read only when they are signed, and `callback.Raw` keeps only the signed fields plus `signature`. This stops the signed request form, which the customer's browser sees, from being replayed to your callback URL as a payment result.

## Responses

What CyberSource puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`; a field the gateway didn't send is `""`. CyberSource makes no HTTP calls, so it never returns `*APIError`.

### `Initiate()` → `*myanmarpayments.FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `Action` | `{BaseURL}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `Fields` | The signed fields below, in signing order |
| `Enctype` | `""`, so `HTML()` posts as `application/x-www-form-urlencoded` |
| `HTML()` | A page that posts the fields to `Action` on load |

| Form field | Value |
|---|---|
| `access_key` | `Config.AccessKey` |
| `profile_id` | `Config.ProfileID` |
| `transaction_uuid` | A random id per call |
| `signed_field_names` | Every field name in this table except `signature`, comma-separated |
| `signed_date_time` | UTC, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.Locale`, `en-us` when empty |
| `transaction_type` | `data.TransactionType`, `sale` when empty |
| `reference_number` | `data.OrderID` |
| `amount` | `data.Amount`, e.g. `10.50` |
| `currency` | `data.Currency`, `MMK` when empty |
| `override_custom_receipt_page` | `data.ReturnURL`, `""` when unset |
| `override_backoffice_post_url` | `data.CallbackURL` |
| `override_custom_cancel_page` | `data.CancelURL`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`Initiate` makes no HTTP call. Errors: `*InvalidPaymentDataError` only.

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `OrderID` | CyberSource `req_reference_number` (your `OrderID`) |
| `Status` | `decision` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `GatewayReference` | CyberSource `transaction_id`, `""` when it is not signed |
| `Amount` | CyberSource `auth_amount`, falling back to `req_amount`, e.g. `10.50`. Only signed values are used |
| `Raw` | The signed fields plus `signature`: `decision`, `reason_code`, `message`, `transaction_id`, `req_reference_number`, `req_amount`, `req_currency`, `auth_amount`, `signed_field_names` and the other fields CyberSource signs. Unsigned fields are left out |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `*SignatureVerificationError` when `signature` does not match, a field listed in `signed_field_names` is missing, or `decision` or `req_reference_number` is not signed.

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `StatusSuccessful` |
| `REVIEW` | `StatusPending` |
| `DECLINE`, `ERROR` | `StatusFailed` |
| `CANCEL` | `StatusCanceled` |
| anything else | `StatusUnknown` |
