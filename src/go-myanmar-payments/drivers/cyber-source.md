---
title: CyberSource
description: Integrate CyberSource Secure Acceptance Hosted Checkout card payments in Go. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance Hosted Checkout is a hosted page for card payments, in the currencies enabled on your Secure Acceptance profile (all are disabled by default; your merchant account provider lists the supported ones). The package follows CyberSource's [Secure Acceptance Hosted Checkout guide](https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance.html).

| Call | What it does | Returns |
|---|---|---|
| `cs.HostedCheckout(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](#hosted-checkout-response) |
| `cs.HandleCallback(request)` | Verify the result post | [`*PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result to your Merchant POST URL (`CallbackURL`). When a receipt page is set (`ReturnURL`, or the custom receipt page on your Secure Acceptance profile), the customer's browser also posts the result there, so you get two posts, both verified the same way. Without a receipt page there is one post, to the Merchant POST URL.

<SequenceDiagram
  title="CyberSource Hosted Checkout: signed form, card page, result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'cs.HostedCheckout(data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cs.HandleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt, when one is set', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cs.HandleCallback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Hosted Checkout

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
	BaseURL:   cybersource.ProductionURL,
})
if err != nil {
	return err
}

data := cybersource.PaymentData{
	OrderID:         fmt.Sprintf("ORDER_%d", order.ID),
	Amount:          myanmarpayments.Kyat(10000),
	CallbackURL:     "https://shop.test/payments/cybersource/callback",
	Currency:        "MMK",
	TransactionType: cybersource.Sale,
	Locale:          "en-us",
	ReturnURL:       "https://shop.test/payments/cybersource/receipt",
	CancelURL:       "https://shop.test/checkout",
}

payment, err := cs.HostedCheckout(data)
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
| `OrderID` | `string` | Yes | At most 40 characters, sent as `reference_number` |
| `Amount` | `myanmarpayments.Amount` | Yes | Order total in `Currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `Kyat(10000)` or `MustParseAmount("10.50")` |
| `CallbackURL` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters |
| `Currency` | `string` | Yes | Three-letter uppercase ISO 4217 code enabled on your Secure Acceptance profile, e.g. `MMK` |
| `TransactionType` | `cybersource.TransactionType` | Yes | `cybersource.Sale` (`"sale"`), `.Authorization` (`"authorization"`), `.SaleAndCreateToken` (`"sale,create_payment_token"`) or `.AuthorizationAndCreateToken` (`"authorization,create_payment_token"`) |
| `Locale` | `string` | Yes | Hosted page language, lowercase `xx-xx`, e.g. `en-us` |
| `ReturnURL` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters. Left out of the form when unset |
| `CancelURL` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters. Left out of the form when unset |

CyberSource requires the callback, receipt and cancel URLs to use HTTPS with TLS 1.2 or later on port 443; the package doesn't enforce it.

### Transaction Types

`sale` authorizes the payment and settles it in one step. `authorization` only authorizes it: the funds are held, not collected, until you capture the authorization through CyberSource (the Business Center or its API), which is outside this package. The `create_payment_token` variants also ask CyberSource to create a payment token for the card.

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

What CyberSource puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. CyberSource posts form fields, so every `Raw` value is a `string`, exactly as sent.

### `HostedCheckout()` → `*myanmarpayments.FormPayment` {#hosted-checkout-response}

| Field / Method | CyberSource value |
|---|---|
| `Flow()` | `FlowForm` |
| `OrderID` | Your `data.OrderID` |
| `Action` | `{BaseURL}/pay`, e.g. `https://secureacceptance.cybersource.com/pay` |
| `Fields` | The signed fields below, in signing order. Post them unchanged |
| `Enctype` | `application/x-www-form-urlencoded` |
| `HTML()` | A full HTML page that posts `Fields` to `Action` on load |
| `HTMLWithNonce(nonce)` | The same page with `nonce` on its inline script, for a Content-Security-Policy |

| Form field | Value |
|---|---|
| `access_key` | `Config.AccessKey` |
| `profile_id` | `Config.ProfileID` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The names of the fields sent, except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.Locale` |
| `transaction_type` | `data.TransactionType` |
| `reference_number` | `data.OrderID` |
| `amount` | `data.Amount`, e.g. `10000` |
| `currency` | `data.Currency` |
| `override_custom_receipt_page` | `data.ReturnURL`; left out when unset |
| `override_backoffice_post_url` | `data.CallbackURL` |
| `override_custom_cancel_page` | `data.CancelURL`; left out when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`FormPayment` has no `Raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `OrderID` | CyberSource `req_reference_number` (your `OrderID`) |
| `Status` | `decision` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `GatewayReference` | CyberSource `transaction_id`. `""` when it is not signed |
| `Amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`; `""` when both are. Signed values only. On `ACCEPT` it can be less than the order total (partial approval, reason code `110`); on `DECLINE`, `ERROR` and `CANCEL` it is the requested amount (`req_amount`), not a paid amount |
| `Raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `StatusSuccessful` |
| `REVIEW` | `StatusPending` |
| `DECLINE`, `ERROR` | `StatusFailed` |
| `CANCEL` | `StatusCanceled` |

`ACCEPT` includes partial approvals (reason code `110`), where the issuer approved less than the requested amount: compare `Amount` with the order total before fulfilling. With an `authorization` transaction type, `ACCEPT` means authorized, not captured, see [Transaction Types](#transaction-types).

`REVIEW` means the authorization needs your review (reason codes `200`, `201`, `230` and `520`), and CyberSource posts nothing again once it is decided: resolve it in the Business Center and update the order yourself.

Any other `decision` returns `*SignatureVerificationError` (`CyberSource callback is malformed.`), so a verified callback never has the `StatusUnknown` status.

## Errors

| Call | Returns | When |
|---|---|---|
| `HostedCheckout()` | `*InvalidPaymentDataError` | `data.Validate()` fails. Nothing is signed |
| `HandleCallback()` | `*SignatureVerificationError` | `CyberSource callback signature verification failed.`: `signature` is missing, not a string or doesn't match, a field listed in `signed_field_names` is missing or holds an object or array, or `signed_field_names` doesn't list itself or has an empty, repeated or `=`-containing name. `CyberSource callback is malformed.`: the signature matches but `decision` or `req_reference_number` isn't signed, or `decision` isn't one of the five above |

CyberSource makes no HTTP calls, so nothing returns `*APIError`.
