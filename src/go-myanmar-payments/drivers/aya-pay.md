---
title: AYA Pay
description: Integrate the AYA Payment Gateway in Go. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
|---|---|---|
| `aya.Services(ctx)` | List the channels enabled for your account | `[]ayapay.Service` |
| `aya.Initiate(data)` | Signed form posted to AYA | [`*FormPayment`](/go-myanmar-payments/payment-flows#form-payments) |
| `aya.Status(ctx, orderID)` | Enquire an order | `*PaymentStatusResult` |
| `aya.HandleCallback(request)` | Verify the backend callback | `*PaymentCallback` |
| `aya.VerifyRedirect(request)` | Verify the customer's return | `*PaymentCallback` |

## Channels and Methods

`Channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `Method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```go
import "github.com/laranex/go-myanmar-payments/ayapay"

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

Still fulfil orders from the backend callback.

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
