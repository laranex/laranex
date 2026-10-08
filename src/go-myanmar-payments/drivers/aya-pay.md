---
title: AYA Pay
description: Integrate the AYA Payment Gateway in Go. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
|---|---|---|
| `aya.Services(ctx)` | List the channels enabled for your account | [`[]ayapay.Service`](#services-response) |
| `aya.Initiate(data)` | Signed form posted to AYA | [`*FormPayment`](#initiate-response) |
| `aya.Status(ctx, orderID)` | Enquire an order | [`*PaymentStatusResult`](#status-response) |
| `aya.HandleCallback(request)` | Verify the backend callback | [`*PaymentCallback`](#handlecallback-response) |
| `aya.VerifyRedirect(request)` | Verify the customer's return | [`*PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'aya.Services(ctx)' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + ayapay.MethodQR' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'aya.Initiate(data)', response: true },
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
import "github.com/laranex/go-myanmar-payments/v4/ayapay"

aya, err := ayapay.New(ayapay.Config{AppKey: "...", AppSecret: "..."}, nil)
if err != nil {
	return err
}

services, err := aya.Services(ctx)
if err != nil {
	return err
}
for _, service := range services {
	// Name "AYA Pay", Key "aya_pay" (pass as Channel), ImageURL (logo),
	// Methods []ayapay.Method{ayapay.MethodQR, ayapay.MethodNoti}
	fmt.Println(service.Name, service.Key, service.Supports(ayapay.MethodQR))
}
```

Methods the gateway lists that this package does not know yet are kept in `service.UnknownMethods`.

| `ayapay.Method` | Value | Customer |
|---|---|---|
| `MethodWeb` | `WEB` | Pays on a hosted web page (cards) |
| `MethodQR` | `QR` | Scans a QR with the wallet app |
| `MethodNoti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```go
payment, err := aya.Initiate(ayapay.PaymentData{
	OrderID:   "ORDER" + orderID,
	Amount:    myanmarpayments.Kyat(8000),
	Channel:   "aya_pay",
	Method:    ayapay.MethodQR,
	ReturnURL: "https://shop.test/payments/aya/return",
})
if err != nil {
	return err
}
w.Header().Set("Content-Type", "text/html; charset=utf-8")
io.WriteString(w, payment.HTML()) // posts the signed form to AYA on load
```

`Initiate` only signs the fields, so it takes no context. AYA expects the form as `multipart/form-data`; `payment.Enctype` carries it if you [render the form yourself](/go-myanmar-payments/payment-flows#form-payments).

### ayapay.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `Amount` | `myanmarpayments.Amount` | Yes | Whole kyat, greater than 0 (AYA documents no decimals). AYA only accepts MMK (`104`) |
| `Channel` | `string` | Yes | A key from `Services` |
| `Method` | `ayapay.Method` | Yes | `MethodWeb`, `MethodQR` or `MethodNoti` |
| `ReturnURL` | `string` | No | Valid URL. Empty uses the URL registered with AYA |
| `Description` | `string` | No | Shown to the customer |
| `UserRefs` | `[]string` | No | Up to 5 of your own values, echoed back in the callback |

## Handling Callbacks

AYA posts to the callback URL registered with them.

```go
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest)
	return
}
callback, err := aya.HandleCallback(request)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
if callback.IsSuccessful() {
	// callback.OrderID (merchOrderId), callback.GatewayReference (tranId), callback.Amount
}
callback.Acknowledgement.Write(w)
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```go
request, _ := myanmarpayments.NewCallbackRequestFromHTTP(r)
result, err := aya.VerifyRedirect(request)
if err == nil && result.IsSuccessful() {
	io.WriteString(w, "Thank you, your payment was received.")
}
```

Still fulfill orders from the backend callback.

## Responses

What AYA puts in each field. See [Results](/go-myanmar-payments/references/results) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs. On error the result is `nil`; a field the gateway didn't send is `""`. Network failures and a canceled `ctx` return `*APIError`, which unwraps to the cause (`errors.Is(err, context.DeadlineExceeded)`).

AYA's signed payload carries, in this order and only when they apply: `merchOrderId`, `tranId`, `amount`, `currencyCode` (AYA spells it `currenyCode`), `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1` to `userRef5`, `description`, `dateTime`. Wallet payments leave out the card fields.

### `Services()` → `[]ayapay.Service` {#services-response}

`ayapay.Service` is AYA-only, so it is listed in full here.

| Field / Method | Type | AYA value |
|---|---|---|
| `Name` | `string` | AYA `name`, e.g. `AYA Pay`. Falls back to `Key` |
| `Key` | `string` | AYA `key`: pass it as `PaymentData.Channel`, e.g. `aya_pay`, `kbz_pay`, `visa`. Always set |
| `ImageURL` | `string` | AYA `image_url`, the channel's logo |
| `Methods` | `[]ayapay.Method` | The listed methods this package knows: `MethodWeb` (`WEB`), `MethodQR` (`QR`), `MethodNoti` (`NOTI`) |
| `UnknownMethods` | `[]string` | Listed methods this package does not know yet. `nil` when there are none |
| `Supports(method)` | `bool` | Whether `Methods` contains `method` |

Entries without a `key` are skipped. Errors: `*APIError` (AYA `status` not `00`).

### `Initiate()` → `*myanmarpayments.FormPayment` {#initiate-response}

| Field / Method | AYA value |
|---|---|
| `OrderID` | Your `data.OrderID` |
| `Action` | `{BaseURL}/v1/payment/request` |
| `Fields` | The signed fields below, in signing order |
| `Enctype` | `multipart/form-data` |
| `HTML()` | A page that posts the fields to `Action` as `multipart/form-data` on load |

| Form field | Value |
|---|---|
| `merchOrderId` | `data.OrderID` |
| `amount` | `data.Amount`, whole kyat, e.g. `8000` |
| `appKey` | `Config.AppKey` |
| `timestamp` | Unix seconds |
| `userRef1` … `userRef5` | `data.UserRefs`, `""` when unset |
| `description` | `data.Description` |
| `currencyCode` | `104` (MMK) |
| `channel` | `data.Channel` |
| `method` | `data.Method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | `data.ReturnURL`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`Initiate` makes no HTTP call. Errors: `*InvalidPaymentDataError` only.

### `Status()` → `*myanmarpayments.PaymentStatusResult` {#status-response}

| Field | AYA value |
|---|---|
| `OrderID` | AYA `merchOrderId`, falling back to the `orderID` you passed. Always set |
| `Status` | `statusCode` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `GatewayReference` | AYA `tranId` |
| `Amount` | AYA `amount`, e.g. `8000` |
| `Raw` | The verified, decoded enquiry payload (keys above) |

Errors: `*APIError` (AYA `status` not `00`, e.g. `20` Transaction not found), `*SignatureVerificationError` (the enquiry's `checkSum` does not match).

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

| Field | AYA value |
|---|---|
| `OrderID` | AYA `merchOrderId` (your `OrderID`) |
| `Status` | `statusCode` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `GatewayReference` | AYA `tranId` |
| `Amount` | AYA `amount`, e.g. `8000` |
| `Raw` | The verified, decoded payload (keys above) |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `*SignatureVerificationError` when `payload` is missing or not base64 JSON, or `checkSum` does not match.

### `VerifyRedirect()` → `*myanmarpayments.PaymentCallback` {#verifyredirect-response}

The same values as `HandleCallback()`, read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). `Acknowledgement` is set but there is nothing to acknowledge: render your return page instead. Errors: `*SignatureVerificationError`.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `StatusSuccessful` |
| `01` | `StatusPending` |
| `02` (fail), `03` (reject) | `StatusFailed` |
| `04` | `StatusExpired` |
| anything else | `StatusUnknown` |

## Errors

`Services` and `Status` return `*myanmarpayments.APIError` when AYA's `status` is not `00`, e.g. `20` Transaction not found, `09` Duplicate order ID.
