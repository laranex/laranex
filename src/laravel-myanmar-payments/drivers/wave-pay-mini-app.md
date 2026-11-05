---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App with Laravel Myanmar Payments. Access tokens, signed payment payloads for Wave's JavaScript SDK and verified callbacks.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your Laravel app covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `wavePayMiniApp()->accessToken()` | Get an access token for the page, cached | `string` |
| `wavePayMiniApp()->payment($data)` | Sign the `makePayment` payload, no API call | [`MiniAppPayment`](#payment-response) |
| `wavePayMiniApp()->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Pay Mini App has no status API: the callback is the only payment result.

## How it works

The page logs in with a token from your app, then pays with a payload your app signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your app', label: 'Ask for an access token' },
    { from: 'Your app', to: 'Wave Pay', label: 'Token unless cached', detail: 'wavePayMiniApp()->accessToken()' },
    { from: 'Your app', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your page', label: 'Signed payload', detail: 'wavePayMiniApp()->payment($data)->toArray()', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wavePayMiniApp()->handleCallback($request)' },
  ]"
/>

## Configuration

| Variable | Config key | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `wave_pay_mini_app.client_id` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `wave_pay_mini_app.client_secret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_APP_ID` | `wave_pay_mini_app.mini_app_id` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `wave_pay_mini_app.secret_key` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `wave_pay_mini_app.base_url` | The API base URL. A trailing `/` is dropped |

Every setting is required; the shared `MYANMAR_PAYMENTS_HTTP_TIMEOUT` (30 seconds by default) applies to the token request. See [Configuration](/laravel-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return it from a route of your own:

```php
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;

Route::get('/mini-app/token', fn () => [
    'accessToken' => MyanmarPayments::wavePayMiniApp()->accessToken(),
]);
```

`accessToken()` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{base_url}/auth/v1/external-utility/token` through Laravel's `Http` client and returns `access_token`. The token is kept in your [cache store](/laravel-myanmar-payments/configuration#cache) under `myanmar-payments.wave-pay-mini-app.token.<sha256(base_url|client_id)>`, the same key in every Laranex package, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). `wavePayMiniApp()->forgetToken()` drops it. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniAppItem;
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniAppPaymentData;

$data = new WavePayMiniAppPaymentData(
    orderId: 'ORDER_'.$order->id,
    callbackUrl: route('payments.wave-pay-mini-app.callback'),
    items: [
        new WavePayMiniAppItem('Ticket', 3000),
        new WavePayMiniAppItem('Snack', 2000),
    ],
);

$payment = MyanmarPayments::wavePayMiniApp()->payment($data);

$order->update(['wave_reference' => $data->merchantReferenceId]);

return response()->json($payment->toArray());
```

`payment()` sends no request: it signs the payload and returns it.

### WavePayMiniAppPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID (`orderID`) |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so the callback is verified with this same URL |
| `items` | `list<WavePayMiniAppItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). `null` charges the exact sum of the items |
| `merchantReferenceId` | `?string` | No | Your ID for this attempt (`merchantRefID`). `null` or empty means a random 32-character hex ID |

`WavePayMiniAppItem` takes a `name` (required) and an `amount` (`Amount|int`) in whole kyat, greater than 0. Errors are collected in this order: `orderId`, `callbackUrl`, `items`, `merchantReferenceId`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.`; a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.`

### The makePayment Payload

`$payment->toArray()` is exactly the object Wave's `makePayment` takes, in this order:

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

Amounts are JSON integers. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`. For an amount above `PHP_INT_MAX`, return `$payment->toJson()`, which writes every digit.

### On the Page

Load Wave's SDK with this script tag, then pass the payload from your app unchanged. Never compute the token or the hash in the browser.

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

On `WM-AUTH-002` (TokenExpired) or `WM-AUTH-003` (InvalidToken), call `wavePayMiniApp()->forgetToken()` on your server, fetch a new token and log in again.

### Merchant Reference ID

Give every attempt, including a retry of the same order, a new `merchantReferenceId`. Leave it empty to get a fresh random ID, and **store it** from `$data->merchantReferenceId`: the callback's `merchantRefId` names the attempt that was paid.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL. `handleCallback($request)`, and `MyanmarPayments::handleCallback('wave-pay-mini-app', $request)`, verify it against the request's own URL (`$request->url()`: scheme, host and path, no query string), which is the callback URL the payment was signed with. `$request->url()` drops a trailing `/`, so build the payment's `callbackUrl` with the same `route()` or `url()` helper, which drops it too. The mini app ID comes from the configuration.

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

Route::post('/payments/wave-pay-mini-app/callback', function (Request $request) {
    try {
        $callback = MyanmarPayments::wavePayMiniApp()->handleCallback($request);
    } catch (SignatureVerificationException) {
        abort(400);
    }

    if ($callback->isSuccessful()) {
        // $callback->orderId is your orderId
        // $callback->raw['merchantRefId'] is the attempt's reference
        // $callback->gatewayReference is Wave's transactionId
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.wave-pay-mini-app.callback');
```

When your app sees a different URL than the one Wave posted to, e.g. behind a proxy Laravel doesn't trust, pass the signed URL: `wavePayMiniApp()->handleCallback($request, $callbackUrl)`. A framework-agnostic `CallbackRequest` has no URL, so it needs the second argument; without it, `handleCallback()` throws `InvalidArgumentException`.

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or array in any callback field throws `SignatureVerificationException` with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it throws `Wave Pay Mini App callback is malformed.`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `Successful` |
| `processing` | `Pending` |
| `failed` | `Failed` |
| anything else | `Unknown` |

## Responses

What Wave Pay Mini App puts in each property. See [Results](/laravel-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `payment()` → `MiniAppPayment` {#payment-response}

| Property / Method | Wave Pay Mini App value |
|---|---|
| `flow()` | `PaymentFlow::MiniApp` |
| `orderId` | Your `orderId` |
| `amount` | The signed total, an `Amount` in whole kyat |
| `miniAppId` | `WAVE_PAY_MINI_APP_APP_ID` |
| `merchantReferenceId` | Your `merchantReferenceId`, generated when empty |
| `callbackUrl` | Your `callbackUrl` |
| `hashValue` | The payload's hash |
| `items` | `list<array{name: string, amount: Amount}>` |
| `toArray()` / `jsonSerialize()` | The `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as `int` |
| `toJson()` | The same object as JSON, amounts with every digit |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Wave Pay Mini App value |
|---|---|
| `orderId` | Wave `orderId` |
| `status` | `transactionStatus` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `transactionStatus`, trimmed, e.g. `successful` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `1000` |
| `raw` | The verified body: `merchantRefId`, `orderId`, `amount`, `msisdn`, `hashValue`, `transactionId`, `transactionStatus` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain`; `MyanmarPayments::acknowledge($callback)` returns it |

## Errors

| Call | Throws | When |
|---|---|---|
| `wavePayMiniApp()` | `ConfigurationException` | A setting is missing or blank, e.g. `The wave_pay_mini_app configuration is missing [client_id].` |
| `new WavePayMiniAppPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is signed. Item errors use `items.0.name` and `items.0.amount` keys |
| `accessToken()` | `ApiException` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `gatewayCode` is Wave's `error`, `gatewayMessage` its `error_description` (or `message`) |
| `handleCallback()` | `SignatureVerificationException` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or array. `Wave Pay Mini App callback is malformed.`: the hash matches but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |
