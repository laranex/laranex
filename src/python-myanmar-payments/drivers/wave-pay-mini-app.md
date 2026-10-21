---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App in Python. Access tokens, signed payment payloads for Wave's JavaScript SDK and verified callbacks, sync or async.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your server covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `mini_app.access_token()` | Get an access token for the page, cached | `str` |
| `mini_app.payment(data)` | Sign the `makePayment` payload, no API call | [`MiniAppPayment`](#payment-response) |
| `mini_app.handle_callback(request, callback_url)` | Verify the callback | [`PaymentCallback`](#handle-callback-response) |

Wave Pay Mini App has no status API: the callback is the only payment result.

`AsyncWavePayMiniApp` has the same methods: await `access_token()` and `forget_token()`; `payment()` and `handle_callback()` send no request and stay plain calls.

## How it works

The page logs in with a token from your server, then pays with a payload your server signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your server', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your server', label: 'Ask for an access token' },
    { from: 'Your server', to: 'Wave Pay', label: 'Token unless cached', detail: 'mini_app.access_token()' },
    { from: 'Your server', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your server', label: 'Check out' },
    { from: 'Your server', to: 'Your page', label: 'Signed payload', detail: 'mini_app.payment(data).to_dict()', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your server', label: 'Callback', detail: 'POST to callback_url, hashValue' },
    { from: 'Your server', to: 'Your server', label: 'Verified callback is proof', detail: 'mini_app.handle_callback(request, callback_url)' },
  ]"
/>

## Configuration

```python
from python_myanmar_payments import WavePayMiniApp, WavePayMiniAppConfig

mini_app = WavePayMiniApp(
    WavePayMiniAppConfig(
        client_id="...",
        client_secret="...",
        mini_app_id="...",
        secret_key="...",
        base_url=WavePayMiniAppConfig.PRODUCTION_URL,
    ),
    token_cache=cache,  # a shared TokenCache for the access token
)
# or WavePayMiniApp.from_env(token_cache=cache), or payments.wave_pay_mini_app()
```

| Variable | Config field | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `client_id` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `client_secret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_MINI_APP_ID` | `mini_app_id` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `secret_key` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `base_url` | The API base URL, e.g. `WavePayMiniAppConfig.PRODUCTION_URL`. A trailing `/` is dropped |
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `timeout_seconds` | Optional, 30 seconds by default |

Every setting except the timeout is required. See [Configuration](/python-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return `mini_app.access_token()` from an endpoint of your own:

```python
from django.http import JsonResponse

# GET /mini-app/token
def mini_app_token(request):
    return JsonResponse({"accessToken": mini_app.access_token()})
```

`access_token()` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{base_url}/auth/v1/external-utility/token` and returns `access_token`. The token is kept in the [token cache](/python-myanmar-payments/configuration#token-cache) under `myanmar-payments.wave-pay-mini-app.token.<sha256(base_url|client_id)>`, the same key in every Laranex SDK, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). Concurrent calls share one token request. `mini_app.forget_token()` drops it. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```python
from django.http import HttpResponse
from python_myanmar_payments import WavePayMiniAppItem, WavePayMiniAppPaymentData

# POST /mini-app/orders/<order_id>/pay
def mini_app_pay(request, order_id: int):
    data = WavePayMiniAppPaymentData(
        order_id=f"ORDER_{order_id}",
        callback_url="https://shop.test/payments/wave-pay-mini-app/callback",
        items=[
            WavePayMiniAppItem(name="Ticket", amount=3000),
            WavePayMiniAppItem(name="Snack", amount=2000),
        ],
    )

    payment = mini_app.payment(data)

    # Store data.merchant_reference_id with the order: payment() filled it in.

    return HttpResponse(payment.to_json(), content_type="application/json")
```

`payment()` sends no request: it validates the data, signs the payload and returns it.

### WavePayMiniAppPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | Your order ID (`orderID`) |
| `callback_url` | `str` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so verify the callback with this same URL |
| `items` | `Sequence[WavePayMiniAppItem]` | Yes | At least one item, as a `list` or `tuple` |
| `amount` | `Amount \| int \| str \| Decimal` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the exact sum of the items |
| `merchant_reference_id` | `str` | No | Your ID for this attempt (`merchantRefID`). Unset or empty means a random 32-character hex ID |

`WavePayMiniAppItem(name, amount)` has a `name` (required) and an `amount` in whole kyat, greater than 0. `WavePayMiniApp.resolved_amount(data)` returns the total that will be charged as an `Amount` (`None` when an item amount is invalid). Errors are collected in this order: `order_id`, `callback_url`, `items`, `merchant_reference_id`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.`; a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.`

### The makePayment Payload

`payment.to_dict()` (or `payment.to_json()`) is exactly the object Wave's `makePayment` takes, in this order:

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

Amounts are JSON integers with every digit. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`.

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

Give every attempt, including a retry of the same order, a new `merchant_reference_id`. Leave it empty to get a fresh random ID, and **store it**: the callback's `merchantRefId` tells you which attempt was paid. `payment()` writes the generated ID to `data.merchant_reference_id` once `data` passes validation, so keep a reference to the object you pass.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL, so pass the callback URL the payment was signed with: normally the URL the callback was posted to, without its query string. The mini app ID comes from the configuration.

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError

# POST /payments/wave-pay-mini-app/callback
@csrf_exempt
def mini_app_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = mini_app.handle_callback(
            callback_request,
            request.build_absolute_uri(request.path),
        )
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your order_id
        # callback.raw["merchantRefId"] is the attempt's reference
        # callback.gateway_reference is Wave's transactionId
        ...

    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

Behind a proxy, pass the public callback URL you signed instead of the URL your app sees.

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL you pass, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or list in any callback field raises `SignatureVerificationError` with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it raises `Wave Pay Mini App callback is malformed.`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `SUCCESSFUL` |
| `processing` | `PENDING` |
| `failed` | `FAILED` |
| anything else | `UNKNOWN` |

## Responses

What Wave Pay Mini App puts in each field. See [Results](/python-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes.

### `payment()` → `MiniAppPayment` {#payment-response}

| Field / Method | Wave Pay Mini App value |
|---|---|
| `flow` | `PaymentFlow.MINI_APP` |
| `order_id` | Your `data.order_id` |
| `amount` | The signed total, an `Amount` in whole kyat |
| `mini_app_id` | The configured mini app ID |
| `merchant_reference_id` | Your `data.merchant_reference_id`, generated when empty |
| `callback_url` | Your `data.callback_url` |
| `hash_value` | The payload's hash |
| `items` | `tuple[tuple[str, Amount], ...]`, `(name, amount)` pairs |
| `to_dict()` | The `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as `int` |
| `to_json()` | The same object as compact JSON |

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | Wave Pay Mini App value |
|---|---|
| `order_id` | Wave `orderId` |
| `status` | `transactionStatus` mapped, see [Statuses](#statuses) |
| `gateway_status` | Wave `transactionStatus`, trimmed, e.g. `successful` |
| `gateway_reference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `1000` |
| `raw` | The verified body: `merchantRefId`, `orderId`, `amount`, `msisdn`, `hashValue`, `transactionId`, `transactionStatus` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Errors

| Call | Raises | When |
|---|---|---|
| `WavePayMiniAppConfig(...)` | `ConfigurationError` | A setting is missing or blank, e.g. `The wave_pay_mini_app configuration is missing [client_id].` |
| `payment()` | `InvalidPaymentDataError` | `WavePayMiniApp.validate(data)` fails. `data` is left untouched. Item errors use `items.0.name` and `items.0.amount` keys |
| `access_token()` | `ApiError` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `gateway_code` is Wave's `error`, `gateway_message` its `error_description` (or `message`) |
| `handle_callback()` | `SignatureVerificationError` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or a list. `Wave Pay Mini App callback is malformed.`: the hash matches but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |

`AsyncWavePayMiniApp` raises the same errors. When Wave can't be reached, `access_token()` raises `ApiError` with `http_status` `0`.
