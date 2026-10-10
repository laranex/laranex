---
title: AYA Pay
description: Integrate the AYA Payment Gateway with Goravel Myanmar Payments. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Call | What it does | Returns |
|---|---|---|
| `aya.Services(ctx)` | List the channels enabled for your account | [`[]ayapay.Service`](#services-response) |
| `aya.Initiate(data)` | Signed form posted to AYA | [`*FormPayment`](#initiate-response) |
| `aya.Status(ctx, orderID)` | Enquire an order | [`*PaymentStatusResult`](#status-response) |
| `aya.HandleCallback(request)` | Verify the backend callback | [`*PaymentCallback`](#handlecallback-response) |
| `aya.VerifyRedirect(request)` | Verify the customer's return | [`*PaymentCallback`](#verifyredirect-response) |

`aya` is the `*ayapay.Gateway` that `paymentsfacades.MyanmarPayments().AyaPay()` returns. [Responses](#responses) shows what AYA Pay puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'aya.Services(ctx)' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + ayapay.MethodQR' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'aya.Initiate(data), payments.AutoSubmitURL(form)', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the form and pay', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.HandleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: 'aya.VerifyRedirect(request)' },
  ]"
/>

## Channels and Methods

`Channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `Method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```go
import (
	"github.com/laranex/go-myanmar-payments/v4/ayapay"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

aya, err := paymentsfacades.MyanmarPayments().AyaPay()
services, err := aya.Services(ctx)

for _, service := range services {
	// service.Name: "AYA Pay"
	// service.Key: "aya_pay", pass it as Channel
	// service.ImageURL: the channel's logo
	// service.Methods: []ayapay.Method{ayapay.MethodQR, ayapay.MethodNoti}
	if service.Supports(ayapay.MethodQR) {
		// offer the QR method
	}
}
```

Methods AYA lists that this package doesn't know yet are kept in `service.UnknownMethods`.

| `ayapay.Method` | Value | Customer |
|---|---|---|
| `ayapay.MethodWeb` | `WEB` | Pays on a hosted web page (cards) |
| `ayapay.MethodQR` | `QR` | Scans a QR with the wallet app |
| `ayapay.MethodNoti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/ayapay"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) AyaPay(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	aya, err := paymentsfacades.MyanmarPayments().AyaPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	data := ayapay.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		Amount:      myanmarpayments.Kyat(10000),
		Channel:     "aya_pay",
		Method:      ayapay.MethodQR,
		ReturnURL:   "https://shop.test/payments/aya/return",
		Description: fmt.Sprintf("Order #%d", order.ID),
	}

	form, err := aya.Initiate(data)
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

### ayapay.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `Amount` | `myanmarpayments.Amount` | Yes | Whole kyat, greater than 0, e.g. `Kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `Channel` | `string` | Yes | A key from `Services()` |
| `Method` | `ayapay.Method` | Yes | A method the channel supports |
| `ReturnURL` | `string` | No | Absolute http or https URL. Empty uses the URL registered with AYA |
| `Description` | `string` | No | Shown to the customer |
| `UserRefs` | `[]string` | No | Up to 5 of your own values, echoed back in the callback |

### Form Encoding

AYA expects the form as `multipart/form-data`. `form.Enctype` carries it; use it if you [render the form yourself](/goravel-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

AYA posts to the callback URL registered with them.

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Post("/payments/aya/callback", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	aya, err := paymentsfacades.MyanmarPayments().AyaPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	callback, err := aya.HandleCallback(request)
	if err != nil { // *myanmarpayments.SignatureVerificationError
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	if callback.IsSuccessful() {
		// callback.OrderID is your merchOrderId
		// callback.GatewayReference is AYA's tranId
	}

	return payments.Acknowledge(ctx, callback)
})
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Get("/payments/aya/return", func(
	ctx http.Context,
) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	aya, err := paymentsfacades.MyanmarPayments().AyaPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	result, err := aya.VerifyRedirect(request)
	if err != nil { // *myanmarpayments.SignatureVerificationError
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	return ctx.Response().View().Make("payments/result.tmpl", map[string]any{
		"status": result.Status,
	})
})
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. The `payload` may be correctly padded or carry no padding at all; partial padding, the URL-safe alphabet, line breaks and text that isn't UTF-8 are rejected. Still fulfill orders from the backend callback.

## Status Checks

```go
import (
	"fmt"

	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

aya, err := paymentsfacades.MyanmarPayments().AyaPay()
result, err := aya.Status(ctx, fmt.Sprintf("ORDER_%d", order.ID))

if err == nil && result.IsSuccessful() {
	// result.GatewayReference is AYA's tranId
}
```

`Status()` takes your `OrderID`. An order AYA doesn't know returns an `*APIError` (`20` Transaction not found).

## Responses

What AYA Pay puts in each field. See [Results](/goravel-myanmar-payments/references/results) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types. `Raw` holds plain Go values (JSON numbers become `json.Number`s), while the typed fields such as `Amount` keep the exact text AYA sent.

### `Services()` → `[]ayapay.Service` {#services-response}

`ayapay.Service` is AYA-only, so it is listed in full here.

| Field / Method | AYA Pay value |
|---|---|
| `Name` | AYA `name`, e.g. `AYA Pay`. Falls back to `Key` |
| `Key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `Channel`. Always set |
| `ImageURL` | AYA `image_url`, the channel's logo. Empty when AYA sends none |
| `Methods` | `[]ayapay.Method` this package knows, e.g. `{ayapay.MethodQR, ayapay.MethodNoti}` |
| `UnknownMethods` | `[]string` of methods AYA listed that this package doesn't know yet. Usually empty |
| `Supports(method)` | Whether `Methods` contains `method` |

Entries AYA sends without a `key` are skipped.

### `Initiate()` → `*FormPayment` {#initiate-response}

| Field / Method | AYA Pay value |
|---|---|
| `OrderID` | Your `OrderID` |
| `Action` | `{base_url}/v1/payment/request`, e.g. `https://pgw.ayainnovation.com/v1/payment/request` |
| `Fields` | The signed fields below, in signing order. Post them unchanged |
| `Enctype` | `multipart/form-data` |
| `HTML()` | A full HTML page that posts `Fields` to `Action` on load |

`payments.AutoSubmitURL(form)` returns the encrypted link to the `myanmar-payments.form` route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. It expires after `form_route.ttl_minutes`. With `form_route.enabled` set to `false` it returns `payments.ErrFormRouteDisabled`.

`Fields`, in the order AYA signs them:

| Form field | Value |
|---|---|
| `merchOrderId` | Your `OrderID` |
| `amount` | Your `Amount`, e.g. `10000` |
| `appKey` | Your configured app key |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | Your `UserRefs`, `""` when unused |
| `description` | Your `Description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | Your `Channel`, e.g. `aya_pay` |
| `method` | Your `Method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | Your `ReturnURL`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`Initiate()` makes no HTTP call. `FormPayment` has no `Raw`: nothing is sent to AYA until the customer's browser posts the form.

### `Status()` → `*PaymentStatusResult` {#status-response}

| Field | AYA Pay value |
|---|---|
| `OrderID` | AYA `merchOrderId`, falling back to the `orderID` you passed. Always set |
| `Status` | `statusCode` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `GatewayReference` | AYA `tranId` |
| `Amount` | AYA `amount`, e.g. `10000` |
| `Raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `Raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | AYA Pay value |
|---|---|
| `OrderID` | AYA `merchOrderId` (your `OrderID`) |
| `Status` | `statusCode` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `GatewayReference` | AYA `tranId` |
| `Amount` | AYA `amount`, e.g. `10000` |
| `Raw` | The verified, decoded payload, with the same keys as `Status()` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`payments.Acknowledge(ctx, callback)` writes `Acknowledgement` as the Goravel response.

### `VerifyRedirect()` → `*PaymentCallback` {#verifyredirect-response}

The same values as [`HandleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). There is nothing to acknowledge: return your own page.

`HandleCallback()` and `VerifyRedirect()` take the `*myanmarpayments.CallbackRequest` that `payments.CallbackRequestFromContext(ctx)` builds.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `StatusSuccessful` |
| `01` | `StatusPending` |
| `02` (fail), `03` (reject) | `StatusFailed` |
| `04` | `StatusExpired` |
| anything else | `StatusUnknown` |

## Errors

| Call | Returns | When |
|---|---|---|
| `Initiate()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed |
| `Services()` | `*APIError` | AYA answers with an HTTP error or a `status` other than `00` |
| `Status()` | `*APIError` | AYA answers with an HTTP error or a `status` other than `00`, e.g. `20` Transaction not found |
| `Status()` | `*SignatureVerificationError` | The enquiry payload's `checkSum` doesn't match |
| `HandleCallback()`, `VerifyRedirect()` | `*SignatureVerificationError` | `payload` is missing or not base64 JSON, a signed field holds an object or array, or `checkSum` doesn't match |

`*APIError` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `GatewayCode` and its `message` in `GatewayMessage`. When AYA can't be reached, the calls return an `*APIError` with `HTTPStatus` `0`.
