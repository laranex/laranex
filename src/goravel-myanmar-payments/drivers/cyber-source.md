---
title: CyberSource
description: Integrate CyberSource Secure Acceptance Hosted Checkout card payments with Goravel Myanmar Payments. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance Hosted Checkout is a hosted page for card payments, in the currencies enabled on your Secure Acceptance profile (all are disabled by default; your merchant account provider lists the supported ones). The package follows CyberSource's [Secure Acceptance Hosted Checkout guide](https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance.html).

| Call | What it does | Returns |
|---|---|---|
| `cyberSource.HostedCheckout(data)` | Signed form posted to the hosted checkout | [`*FormPayment`](#hosted-checkout-response) |
| `cyberSource.HandleCallback(request)` | Verify the result post | [`*PaymentCallback`](#handlecallback-response) |

`cyberSource` is the `*cybersource.Gateway` that `paymentsfacades.MyanmarPayments().CyberSource()` returns. CyberSource has no status API in this package: the callback is the only payment result.

## How it works

CyberSource posts the result to your Merchant POST URL (`CallbackURL`). When a receipt page is set (`ReturnURL`, or the custom receipt page on your Secure Acceptance profile), the customer's browser also posts the result there, so you get two posts, both verified the same way. Without a receipt page there is one post, to the Merchant POST URL.

<SequenceDiagram
  title="CyberSource Hosted Checkout: signed form, card page, result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'cyberSource.HostedCheckout(data), payments.AutoSubmitURL(form)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'HandleCallbackFromContext(name, ctx)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt, when one is set', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cyberSource.HandleCallback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Hosted Checkout

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
		OrderID:         fmt.Sprintf("ORDER_%d", order.ID),
		Amount:          myanmarpayments.Kyat(10000),
		CallbackURL:     "https://shop.test/payments/cybersource/callback",
		Currency:        "MMK",
		TransactionType: cybersource.Sale,
		Locale:          "en-us",
		ReturnURL:       "https://shop.test/payments/cybersource/receipt",
		CancelURL:       "https://shop.test/checkout",
	}

	form, err := cyberSource.HostedCheckout(data)
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
| `OrderID` | `string` | Yes | At most 40 characters, sent as `reference_number` |
| `Amount` | `myanmarpayments.Amount` | Yes | Order total in `Currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `Kyat(10000)` or `MustParseAmount("10.50")` |
| `CallbackURL` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters |
| `Currency` | `string` | Yes | Three-letter uppercase ISO 4217 code enabled on your Secure Acceptance profile, e.g. `MMK` |
| `TransactionType` | `cybersource.TransactionType` | Yes | `cybersource.Sale` (`"sale"`), `Authorization` (`"authorization"`), `SaleAndCreateToken` (`"sale,create_payment_token"`) or `AuthorizationAndCreateToken` (`"authorization,create_payment_token"`) |
| `Locale` | `string` | Yes | Hosted page language as a CyberSource locale code, e.g. `en-us` |
| `ReturnURL` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters. Left out of the form when unset |
| `CancelURL` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters. Left out of the form when unset |

CyberSource requires the callback, receipt and cancel URLs to use HTTPS with TLS 1.2 or later on port 443; the package doesn't enforce it.

### Transaction Types

`sale` authorizes the payment and settles it in one step. `authorization` only authorizes it: the funds are held, not collected, until you capture the authorization through CyberSource (the Business Center or its API), which is outside this package. The `create_payment_token` variants also ask CyberSource to create a payment token for the card.

### Amounts and Currencies

CyberSource accepts decimals and the currencies enabled on your Secure Acceptance profile. For another enabled currency, pass an [`Amount`](/goravel-myanmar-payments/amounts) with the currency: `Amount: myanmarpayments.MustParseAmount("10.50"), Currency: "USD"`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. `form.Enctype` carries it; use it if you [render the form yourself](/goravel-myanmar-payments/payment-flows#form-payments).

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
	callback, err := paymentsfacades.MyanmarPayments().
		HandleCallbackFromContext(payments.GatewayCyberSource, ctx)
	if err != nil { // *myanmarpayments.SignatureVerificationError, ...
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

The signed text is `name=value` pairs joined with `,`, and a signed value (a billing name, say) may contain both, so `signed_field_names` itself is checked too: it must list `signed_field_names`, and no name may be empty, repeated or contain `=`. `decision` must be `ACCEPT`, `DECLINE`, `REVIEW`, `ERROR` or `CANCEL` (any case); an unknown decision fails verification instead of returning `StatusUnknown`.

## Responses

What CyberSource puts in each field. See [Results](/goravel-myanmar-payments/references/results) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types. CyberSource posts form fields, so every `Raw` value is a `string`, exactly as sent.

### `HostedCheckout()` → `*FormPayment` {#hosted-checkout-response}

| Field / Method | CyberSource value |
|---|---|
| `OrderID` | Your `OrderID` |
| `Action` | `{base_url}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `Fields` | The signed fields below, in this order. Post them unchanged |
| `Enctype` | `application/x-www-form-urlencoded` |
| `HTML()` | A full HTML page that posts `Fields` to `Action` on load |
| `HTMLWithNonce(nonce)` | The same page with `nonce` on its inline script, for a Content-Security-Policy |

`Fields`, all signed, in this order:

| Form field | Value |
|---|---|
| `access_key` | Your configured access key |
| `profile_id` | Your configured profile ID |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The names of the fields sent, except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | Your `Locale`, e.g. `en-us` |
| `transaction_type` | Your `TransactionType`, e.g. `sale` |
| `reference_number` | Your `OrderID` |
| `amount` | Your `Amount`, e.g. `10000` |
| `currency` | Your `Currency`, e.g. `MMK` |
| `override_custom_receipt_page` | Your `ReturnURL`; left out when unset |
| `override_backoffice_post_url` | Your `CallbackURL` |
| `override_custom_cancel_page` | Your `CancelURL`; left out when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`HostedCheckout()` makes no HTTP call. `FormPayment` has no `Raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `OrderID` | CyberSource `req_reference_number` (your `OrderID`) |
| `Status` | `decision` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `GatewayReference` | CyberSource `transaction_id`. Empty when it is not signed |
| `Amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only. On `ACCEPT` it can be less than the order total (partial approval, reason code `110`); on `DECLINE`, `ERROR` and `CANCEL` it is the requested amount (`req_amount`), not a paid amount |
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

Any other `decision` returns a `*SignatureVerificationError`, so a verified callback never has `StatusUnknown`.

## Errors

| Call | Returns | When |
|---|---|---|
| `HostedCheckout()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed |
| `HandleCallback()` | `*SignatureVerificationError` | `signature` doesn't match, a field listed in `signed_field_names` is missing, `decision` or `req_reference_number` isn't signed, `signed_field_names` doesn't list itself or has an empty, repeated or `=`-containing name, or `decision` isn't one of the five above |

CyberSource makes no HTTP calls, so nothing returns an `*APIError`.
