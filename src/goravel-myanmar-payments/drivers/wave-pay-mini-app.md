---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App with Goravel Myanmar Payments. Access tokens, signed payment payloads for Wave's JavaScript SDK and verified callbacks.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your server covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `miniApp.AccessToken(ctx)` | Get an access token for the page, cached | `string` |
| `miniApp.Payment(data)` | Sign the `makePayment` payload, no API call | [`*MiniAppPayment`](#payment-response) |
| `HandleCallbackFromContext("wave-pay-mini-app", ctx)` | Verify the callback against the URL it was posted to | [`*PaymentCallback`](#handlecallback-response) |
| `miniApp.HandleCallback(request, callbackURL)` | Verify the callback against a callback URL you pass | [`*PaymentCallback`](#handlecallback-response) |

`miniApp` is the `*wavepayminiapp.Gateway` that `paymentsfacades.MyanmarPayments().WavePayMiniApp()` returns. Wave Pay Mini App has no status API: the callback is the only payment result.

## How it works

The page logs in with a token from your server, then pays with a payload your server signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your app', label: 'Ask for an access token' },
    { from: 'Your app', to: 'Wave Pay', label: 'Token unless cached', detail: 'miniApp.AccessToken(ctx)' },
    { from: 'Your app', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your page', label: 'Signed payload', detail: 'miniApp.Payment(data), then JSON()', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Callback', detail: 'POST to CallbackURL, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'HandleCallbackFromContext(name, ctx)' },
  ]"
/>

## Configuration

```env
WAVE_PAY_MINI_APP_CLIENT_ID=
WAVE_PAY_MINI_APP_CLIENT_SECRET=
WAVE_PAY_MINI_APP_MINI_APP_ID=
WAVE_PAY_MINI_APP_SECRET_KEY=
WAVE_PAY_MINI_APP_BASE_URL=
```

| Variable | Config key | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `wave_pay_mini_app.client_id` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `wave_pay_mini_app.client_secret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_MINI_APP_ID` | `wave_pay_mini_app.mini_app_id` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `wave_pay_mini_app.secret_key` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `wave_pay_mini_app.base_url` | The API base URL. A trailing `/` is dropped |

Every setting is required; `MYANMAR_PAYMENTS_HTTP_TIMEOUT` (30 seconds by default) applies to the token request. See [Configuration](/goravel-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return it from a route of your own:

```go
import (
	"github.com/goravel/framework/contracts/http"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Get("/mini-app/token", func(ctx http.Context) http.Response {
	miniApp, err := paymentsfacades.MyanmarPayments().WavePayMiniApp()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	token, err := miniApp.AccessToken(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadGateway, "token unavailable")
	}

	return ctx.Response().Json(http.StatusOK, http.Json{"accessToken": token})
})
```

`AccessToken()` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{base_url}/auth/v1/external-utility/token` and returns `access_token`. The token is kept in your [cache store](/goravel-myanmar-payments/configuration#cache) under `myanmar-payments.wave-pay-mini-app.token.<sha256(baseURL|clientID)>`, the same key in every Laranex SDK, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). Concurrent calls share one token request. `miniApp.ForgetToken()` drops it, e.g. after rotating the client secret. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavepayminiapp"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (r *CheckoutController) MiniApp(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	miniApp, err := paymentsfacades.MyanmarPayments().WavePayMiniApp()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err)
	}
	data := &wavepayminiapp.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		CallbackURL: "https://shop.test/payments/wave-pay-mini-app/callback",
		Items: []wavepayminiapp.Item{
			{Name: "Ticket", Amount: myanmarpayments.Kyat(3000)},
			{Name: "Snack", Amount: myanmarpayments.Kyat(2000)},
		},
	}

	payment, err := miniApp.Payment(data)
	if err != nil {
		return ctx.Response().String(http.StatusUnprocessableEntity, "%s", err)
	}

	order.WaveReference = data.MerchantReferenceID
	saveOrder(order) // your own persistence

	return ctx.Response().Data(http.StatusOK, "application/json", []byte(payment.JSON()))
}
```

`Payment()` sends no request: it signs the payload and returns it.

### wavepayminiapp.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Your order ID (`orderID`) |
| `CallbackURL` | `string` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so the callback is verified with this same URL; see [Handling Callbacks](#handling-callbacks) |
| `Items` | `[]wavepayminiapp.Item` | Yes | At least one item |
| `Amount` | `myanmarpayments.Amount` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the exact sum of the items |
| `MerchantReferenceID` | `string` | No | Your ID for this attempt (`merchantRefID`). Empty means a random 32-character hex ID; one made only of whitespace is rejected |

`wavepayminiapp.Item` has a `Name` (required) and an `Amount` in whole kyat, greater than 0. Errors are collected in this order: `orderId`, `callbackUrl`, `items`, `merchantReferenceId`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `Amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.`; a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.`

### The makePayment Payload

`payment.JSON()` is exactly the object Wave's `makePayment` takes, in this order:

```json
{
  "amount": 5000,
  "miniAppID": "MINI456",
  "merchantRefID": "3f9c0d6e5b2a41c8a7e1f0b9d4c3a2e1",
  "orderID": "ORDER_1",
  "callBackUrl": "https://shop.test/payments/wave-pay-mini-app/callback",
  "hashValue": "…",
  "items": [
    { "name": "Ticket", "amount": 3000 },
    { "name": "Snack", "amount": 2000 }
  ]
}
```

Amounts are JSON integers with every digit. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`. `ctx.Response().Json(http.StatusOK, payment)` also works, but `encoding/json` escapes `<`, `>` and `&`; `Data()` with `payment.JSON()` sends the exact text.

### On the Page

Load Wave's SDK with this script tag, then pass the payload from your server unchanged. Never compute the token or the hash in the browser.

```html
<script src="https://sdk.wavemoney.com.mm/js/jssdk/1.0.0.min.js" integrity="sha256-5Rs6crfDhIbuYzkMXj3uRGTQ3z6XMGulYcDRhypCSd8=" crossorigin="anonymous"></script>
```

This `integrity` hash is the one in the installation section of Wave's guide; the hash in its Quick Start (`sha256-/lINQ…`) is stale.

```js
const sdk = new WaveJsSDK({ appName: 'My Shop', appIconUrl: 'https://shop.test/icon.png' })
await sdk.init()

const { accessToken } = await (await fetch('/mini-app/token')).json()
await window.WaveJsSDK.authModule.loginWithAccessToken(accessToken)

const payload = await (await fetch('/mini-app/orders/1/pay', { method: 'POST' })).json()
const result = await window.WaveJsSDK.paymentModule.makePayment(payload)
```

`sdk.init()` only works inside the WavePay app; in a normal browser it throws.

`makePayment`'s success result, `{ response: { data: { amount, transactionID, transactionDate } } }`, only tells the page how the payment screen ended. It is not proof of payment: fulfill from the verified callback.

### SDK Errors

A failed SDK call answers with `{ response: { error: { code, message } } }`. Show Wave's `message` to the customer as-is: Wave writes it for the user.

| Error | `code` |
|---|---|
| PermissionDenied | `WM-PERMISSION-001` |
| PermissionDeniedForever | `WM-PERMISSION-002` |
| ServiceDisable | `WM-PERMISSION-003` |
| Unknown | `WM-OTHER-001` |
| NotFound | `WM-OTHER-002` |
| Canceled | `WM-OTHER-003` |
| Unsupported | `WM-OTHER-004` |
| ExceedSize | `WM-OTHER-005` |
| InvalidRequest | `WM-OTHER-006` |
| CapabilityDenied | `WM-AUTH-001` |
| TokenExpired | `WM-AUTH-002` |
| InvalidToken | `WM-AUTH-003` |

On `WM-AUTH-002` (TokenExpired) or `WM-AUTH-003` (InvalidToken), call `miniApp.ForgetToken()` on your server, fetch a new token and log in again.

### Merchant Reference ID

Give every attempt, including a retry of the same order, a new `MerchantReferenceID`. Leave it empty to get a fresh random ID, and **store it**: the callback's `merchantRefId` tells you which attempt was paid. `Payment()` takes a pointer and writes the generated ID to `data.MerchantReferenceID` once the data passes validation.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL, so it is verified against a callback URL; the mini app ID comes from the configuration. `HandleCallbackFromContext` uses the URL the callback was posted to (`payments.CallbackURLFromContext(ctx)`: scheme, host and path, no query string), so sign the payment with that route's URL:

```go
import (
	"github.com/goravel/framework/contracts/http"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
)

facades.Route().Post("/payments/wave-pay-mini-app/callback", func(
	ctx http.Context,
) http.Response {
	callback, err := paymentsfacades.MyanmarPayments().
		HandleCallbackFromContext(payments.GatewayWavePayMiniApp, ctx)
	if err != nil { // *myanmarpayments.SignatureVerificationError, ...
		return ctx.Response().String(http.StatusBadRequest, "invalid")
	}

	if callback.IsSuccessful() {
		// callback.OrderID is your OrderID
		// callback.Raw["merchantRefId"] is the attempt's reference
		// callback.GatewayReference is Wave's transactionId
	}

	return payments.Acknowledge(ctx, callback)
})
```

`CallbackURLFromContext` takes the scheme from the connection (`https` only when it used TLS) and the host from the `Host` header; `X-Forwarded-Proto` and `X-Forwarded-Host` are not read. Behind a proxy that changes either, verify with the public URL instead:

```go
miniApp, err := paymentsfacades.MyanmarPayments().WavePayMiniApp()
request, err := payments.CallbackRequestFromContext(ctx)
callback, err := miniApp.HandleCallback(request, "https://shop.test/payments/wave-pay-mini-app/callback")
```

`manager.HandleCallback("wave-pay-mini-app", request)` has no URL to verify against and returns `payments.ErrCallbackURLRequired`; so does the `*payments.WavePayMiniAppCallbackHandler` that `manager.Gateway("wave-pay-mini-app")` returns until you set its `CallbackURL`.

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or array in any callback field returns a `*myanmarpayments.SignatureVerificationError` with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it returns `Wave Pay Mini App callback is malformed.`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `StatusSuccessful` |
| `processing` | `StatusPending` |
| `failed` | `StatusFailed` |
| anything else | `StatusUnknown` |

## Responses

What Wave Pay Mini App puts in each field. See [Results](/goravel-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/goravel-myanmar-payments/references/payment-callback) for the full types.

### `Payment()` → `*MiniAppPayment` {#payment-response}

| Field / Method | Wave Pay Mini App value |
|---|---|
| `Flow()` | `FlowMiniApp` |
| `OrderID` | Your `OrderID` |
| `Amount` | The signed total, an `Amount` in whole kyat |
| `MiniAppID` | The configured `mini_app_id` |
| `MerchantReferenceID` | Your `MerchantReferenceID`, generated when empty |
| `CallbackURL` | Your `CallbackURL` |
| `HashValue` | The payload's hash |
| `Items` | `[]myanmarpayments.MiniAppItem` (`Name`, `Amount`) |
| `JSON()` / `MarshalJSON()` | The `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as JSON integers |

### `HandleCallback()` → `*PaymentCallback` {#handlecallback-response}

| Field | Wave Pay Mini App value |
|---|---|
| `OrderID` | Wave `orderId` |
| `Status` | `transactionStatus` mapped, see [Statuses](#statuses) |
| `GatewayStatus` | Wave `transactionStatus`, trimmed, e.g. `successful` |
| `GatewayReference` | Wave `transactionId` |
| `Amount` | Wave `amount`, e.g. `1000` |
| `Raw` | The verified body: `merchantRefId`, `orderId`, `amount`, `msisdn`, `hashValue`, `transactionId`, `transactionStatus` |
| `Acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Errors

| Call | Returns | When |
|---|---|---|
| `WavePayMiniApp()` | `*ConfigurationError` | A setting is missing or blank, e.g. `myanmarpayments: The wave_pay_mini_app configuration is missing [client_id].` |
| `Payment()` | `*InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed. Item errors use `items.0.name` and `items.0.amount` keys |
| `AccessToken()` | `*APIError` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `GatewayCode` is Wave's `error`, `GatewayMessage` its `error_description` (or `message`) |
| `HandleCallbackFromContext()`, `HandleCallback()` | `*SignatureVerificationError` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or array. `Wave Pay Mini App callback is malformed.`: the hash matches but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |
| `manager.HandleCallback()` | `payments.ErrCallbackURLRequired` | Called with `wave-pay-mini-app`: use `HandleCallbackFromContext` or `WavePayMiniApp().HandleCallback(request, callbackURL)` |
