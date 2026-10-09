---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments with Goravel Myanmar Payments. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance is a hosted checkout for card payments, in MMK or any other currency.

| Call | What it does | Returns |
|---|---|---|
| `cyberSource.Initiate(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](#initiate-response) |
| `cyberSource.HandleCallback(request)` | Verify the result post | [`*PaymentCallback`](#handlecallback-response) |

`cyberSource` is the `*cybersource.Gateway` that `paymentsfacades.MyanmarPayments().CyberSource()` returns. CyberSource has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'cyberSource.Initiate(data), payments.AutoSubmitURL(form)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cyberSource.HandleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cyberSource.HandleCallback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/cybersource"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) Card(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	cyberSource, err := paymentsfacades.MyanmarPayments().CyberSource()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	data := cybersource.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		Amount:      myanmarpayments.Kyat(10000),
		CallbackURL: "https://shop.test/payments/cybersource/callback",
		ReturnURL:   "https://shop.test/payments/cybersource/receipt",
		CancelURL:   "https://shop.test/checkout",
	}

	form, err := cyberSource.Initiate(data)
	if err != nil {
		return ctx.Response().String(http.StatusUnprocessableEntity, "%s", err)
	}
	link, err := payments.AutoSubmitURL(form)
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}

	return ctx.Response().Redirect(http.StatusFound, link)
}
```

### cybersource.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `Amount` | `myanmarpayments.Amount` | Yes | Order total in `Currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `Kyat(10000)` or `MustParseAmount("10.50")` |
| `CallbackURL` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `ReturnURL` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `CancelURL` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `Currency` | `string` | No | Any three-letter uppercase ISO 4217 code, default `MMK` |
| `TransactionType` | `cybersource.TransactionType` | No | `cybersource.Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `Locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`, default `en-us` |

### Amounts and Currencies

CyberSource is multi-currency and accepts decimals. For another currency, pass an [`Amount`](/goravel-myanmar-payments/amounts) with the currency: `Amount: myanmarpayments.MustParseAmount("10.50"), Currency: "USD"`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. The Go SDK leaves `form.Enctype` empty, and `form.HTML()` (which the form route serves) falls back to `application/x-www-form-urlencoded`; use that encoding if you [render the form yourself](/goravel-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

CyberSource posts a form to `CallbackURL`. The same check works for the browser post to your receipt page.

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Post("/payments/cybersource/callback", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	cyberSource, err := paymentsfacades.MyanmarPayments().CyberSource()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	callback, err := cyberSource.HandleCallback(request)
	if err != nil { // *myanmarpayments.SignatureVerificationError
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	if callback.IsSuccessful() {
		// callback.OrderID is your req_reference_number
		// callback.GatewayReference is CyberSource's transaction_id
	}

	return payments.Acknowledge(ctx, callback)
})
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `Raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each field. See [Results](/goravel-myanmar-payments/references/results) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types.

### `Initiate()` → `*FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `OrderID` | Your `OrderID` |
| `Action` | `{base_url}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `Fields` | The signed fields below, in this order. Post them unchanged |
| `Enctype` | Empty; `HTML()` posts it as `application/x-www-form-urlencoded` |
| `HTML()` | A full HTML page that posts `Fields` to `Action` on load |

`payments.AutoSubmitURL(form)` returns the encrypted link to the `myanmar-payments.form` route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. It expires after `form_route.ttl_minutes` (30). With `form_route.enabled` set to `false` it returns `payments.ErrFormRouteDisabled`.

`Fields`, all signed, in this order:

| Form field | Value |
|---|---|
| `access_key` | Your configured access key |
| `profile_id` | Your configured profile ID |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The field names in this table except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | Your `Locale`, e.g. `en-us` |
| `transaction_type` | Your `TransactionType`, e.g. `sale` |
| `reference_number` | Your `OrderID` |
| `amount` | Your `Amount`, e.g. `10000` |
| `currency` | Your `Currency`, e.g. `MMK` |
| `override_custom_receipt_page` | Your `ReturnURL`, `""` when unset |
| `override_backoffice_post_url` | Your `CallbackURL` |
| `override_custom_cancel_page` | Your `CancelURL`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`Initiate()` makes no HTTP call. `FormPayment` has no `Raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `OrderID` | CyberSource `req_reference_number` (your `OrderID`) |
| `Status` | `decision` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `GatewayReference` | CyberSource `transaction_id`. Empty when it is not signed |
| `Amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only |
| `Raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`payments.Acknowledge(ctx, callback)` writes `Acknowledgement` as the Goravel response. `HandleCallback()` takes the `*myanmarpayments.CallbackRequest` that `payments.CallbackRequestFromContext(ctx)` builds.

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
| `Initiate()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed |
| `HandleCallback()` | `*SignatureVerificationError` | `signature` doesn't match, a field listed in `signed_field_names` is missing, or `decision` or `req_reference_number` isn't signed |

CyberSource makes no HTTP calls, so nothing returns an `*APIError`.
