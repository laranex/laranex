---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App in Go. Access tokens, signed payment payloads for Wave's JavaScript SDK and verified callbacks.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your server covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `miniApp.AccessToken(ctx)` | Get an access token for the page, cached | `string` |
| `miniApp.Payment(&data)` | Sign the `makePayment` payload, no API call | [`*MiniAppPayment`](#payment-response) |
| `miniApp.HandleCallback(request, callbackURL)` | Verify the callback | [`*PaymentCallback`](#handlecallback-response) |

Wave Pay Mini App has no status API: the callback is the only payment result.

## How it works

The page logs in with a token from your server, then pays with a payload your server signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your server', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your server', label: 'Ask for an access token' },
    { from: 'Your server', to: 'Wave Pay', label: 'Token unless cached', detail: 'miniApp.AccessToken(ctx)' },
    { from: 'Your server', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your server', label: 'Check out' },
    { from: 'Your server', to: 'Your page', label: 'Signed payload', detail: 'miniApp.Payment(&data), then JSON()', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your server', label: 'Callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your server', to: 'Your server', label: 'Verified callback is proof', detail: 'miniApp.HandleCallback(request, callbackURL)' },
  ]"
/>

## Configuration

```go
import "github.com/laranex/go-myanmar-payments/v4/wavepayminiapp"

miniApp, err := wavepayminiapp.New(wavepayminiapp.Config{
	ClientID:     "...",
	ClientSecret: "...",
	MiniAppID:    "...",
	SecretKey:    "...",
	BaseURL:      wavepayminiapp.ProductionURL,
}, nil, cache) // cache: a shared TokenCache for the access token
if err != nil {
	return err
}
// or wavepayminiapp.New(wavepayminiapp.ConfigFromEnv(os.Getenv), nil, cache),
// or gateways.WavePayMiniApp()
```

| Variable | `Config` field | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `ClientID` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `ClientSecret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_MINI_APP_ID` | `MiniAppID` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `SecretKey` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `BaseURL` | The API base URL, e.g. `wavepayminiapp.ProductionURL`. A trailing `/` is dropped |
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `TimeoutSeconds` | Optional, 30 seconds by default |

Every setting except the timeout is required. See [Configuration](/go-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return `miniApp.AccessToken(ctx)` from a handler of your own:

```go
// GET /mini-app/token
token, err := miniApp.AccessToken(r.Context())
if err != nil {
	http.Error(w, "token unavailable", http.StatusBadGateway)
	return
}
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]string{"accessToken": token})
```

`AccessToken` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{BaseURL}/auth/v1/external-utility/token` (`wavepayminiapp.TokenPath`) and returns `access_token`. The token is kept in the [token cache](/go-myanmar-payments/configuration#token-cache) under `myanmar-payments.wave-pay-mini-app.token.<sha256(baseUrl|clientId)>`, the same key in every Laranex SDK, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). Concurrent calls share one token request, bounded by the configured timeout. `miniApp.ForgetToken()` drops it. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```go
import (
	"fmt"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavepayminiapp"
)

data := wavepayminiapp.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	CallbackURL: "https://shop.test/payments/wave-pay-mini-app/callback",
	Items: []wavepayminiapp.Item{
		{Name: "Ticket", Amount: myanmarpayments.Kyat(3000)},
		{Name: "Snack", Amount: myanmarpayments.Kyat(2000)},
	},
}

payment, err := miniApp.Payment(&data)
if err != nil {
	return err
}

// Store data.MerchantReferenceID with the order: Payment filled it in.

w.Header().Set("Content-Type", "application/json")
w.Write([]byte(payment.JSON()))
```

`Payment` sends no request: it signs the payload and returns it.

### wavepayminiapp.PaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `OrderID` | `string` | Yes | Your order ID (`orderID`) |
| `CallbackURL` | `string` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so verify the callback with this same URL |
| `Items` | `[]wavepayminiapp.Item` | Yes | At least one item |
| `Amount` | `myanmarpayments.Amount` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the exact sum of the items |
| `MerchantReferenceID` | `string` | No | Your ID for this attempt (`merchantRefID`). Empty means a random 32-character hex ID; one made only of whitespace is rejected |

`wavepayminiapp.Item` has a `Name` (required) and an `Amount` in whole kyat, greater than 0. `data.ResolvedAmount()` returns the total that will be charged, summed with exact integer arithmetic. `data.Validate()` collects errors in this order: `orderId`, `callbackUrl`, `items`, `merchantReferenceId`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `Amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.` (`items.0.amount` for an item); a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.`, and an item amount that is invalid or has decimals skips the total check.

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

Amounts are JSON integers with every digit. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`. `MiniAppPayment` also implements `json.Marshaler`, but `json.Marshal` escapes `<`, `>` and `&`; write `JSON()` (or use a `json.Encoder` with `SetEscapeHTML(false)`) to keep the exact text.

### On the Page

Load Wave's SDK as Wave's guide shows, then pass the payload from your server unchanged. Never compute the token or the hash in the browser.

```js
const sdk = new WaveJsSDK({ appName: 'My Shop', appIconUrl: 'https://shop.test/icon.png' })
await sdk.init()

const { accessToken } = await (await fetch('/mini-app/token')).json()
await window.WaveJsSDK.authModule.loginWithAccessToken(accessToken)

const payload = await (await fetch('/mini-app/orders/1/pay', { method: 'POST' })).json()
const result = await window.WaveJsSDK.paymentModule.makePayment(payload)
```

`makePayment`'s result only tells the page how the payment screen ended; fulfill from the verified callback.

### Merchant Reference ID

Give every attempt, including a retry of the same order, a new `MerchantReferenceID`. Leave it empty to get a fresh random ID, and **store it**: the callback's `merchantRefId` tells you which attempt was paid. `Payment` takes a pointer and writes the generated ID to `data.MerchantReferenceID` once `data` passes validation.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL, so pass the callback URL the payment was signed with: normally the URL the callback was posted to, without its query string. The mini app ID comes from the configuration.

```go
// POST /payments/wave-pay-mini-app/callback
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}
callback, err := miniApp.HandleCallback(request, "https://shop.test/payments/wave-pay-mini-app/callback")
if err != nil {
	http.Error(w, "invalid callback", http.StatusBadRequest)
	return
}

if callback.IsSuccessful() {
	// callback.OrderID is your OrderID
	// callback.Raw["merchantRefId"] is the attempt's reference
	// callback.GatewayReference is Wave's transactionId
}

callback.Acknowledgement.Write(w)
```

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL you pass, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or array in any callback field returns `*myanmarpayments.SignatureVerificationError` with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it returns `Wave Pay Mini App callback is malformed.`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `StatusSuccessful` |
| `processing` | `StatusPending` |
| `failed` | `StatusFailed` |
| anything else | `StatusUnknown` |

## Responses

What Wave Pay Mini App puts in each field. See [Results](/go-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/go-myanmar-payments/references/payment-callback) for the full structs.

### `Payment()` → `*myanmarpayments.MiniAppPayment` {#payment-response}

| Field / Method | Wave Pay Mini App value |
|---|---|
| `Flow()` | `FlowMiniApp` |
| `OrderID` | Your `data.OrderID` |
| `Amount` | The signed total, an `Amount` in whole kyat |
| `MiniAppID` | `Config.MiniAppID` |
| `MerchantReferenceID` | Your `data.MerchantReferenceID`, generated when empty |
| `CallbackURL` | Your `data.CallbackURL` |
| `HashValue` | The payload's hash |
| `Items` | `[]myanmarpayments.MiniAppItem` (`Name`, `Amount`) |
| `JSON()` / `MarshalJSON()` | The `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as JSON integers |

### `HandleCallback()` → `*myanmarpayments.PaymentCallback` {#handlecallback-response}

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
| `wavepayminiapp.New()` | `*ConfigurationError` | A setting is missing or blank, e.g. `myanmarpayments: The wave_pay_mini_app configuration is missing [client_id].`, or `TimeoutSeconds` is negative |
| `Payment()` | `*InvalidPaymentDataError` | `data.Validate()` fails. Nothing is signed and `data` is left untouched. Item errors use `items.0.name` and `items.0.amount` keys |
| `AccessToken()` | `*APIError` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `GatewayCode` is Wave's `error`, `GatewayMessage` its `error_description` (or `message`) |
| `HandleCallback()` | `*SignatureVerificationError` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or array. `Wave Pay Mini App callback is malformed.`: the hash matches but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |

When Wave can't be reached, or `ctx` ends first, `AccessToken()` returns `*APIError` with `HTTPStatus` `0` and the original error in `Err`.
