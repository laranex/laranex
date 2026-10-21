---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App in plain PHP. Access tokens, signed payment payloads for Wave's JavaScript SDK and verified callbacks.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your server covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `$wavePayMiniApp->accessToken()` | Get an access token for the page, cached | `string` |
| `$wavePayMiniApp->payment($data)` | Sign the `makePayment` payload, no API call | [`MiniAppPayment`](#payment-response) |
| `$wavePayMiniApp->handleCallback($request, $callbackUrl)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

## How it works

The page logs in with a token from your server, then pays with a payload your server signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your server', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your server', label: 'Ask for an access token' },
    { from: 'Your server', to: 'Wave Pay', label: 'Token unless cached', detail: '$wavePayMiniApp->accessToken()' },
    { from: 'Your server', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your server', label: 'Check out' },
    { from: 'Your server', to: 'Your page', label: 'Signed payload', detail: '$wavePayMiniApp->payment($data)->toArray()', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your server', label: 'Callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your server', to: 'Your server', label: 'Verified callback is proof', detail: '$wavePayMiniApp->handleCallback($request, $callbackUrl)' },
  ]"
/>

## Configuration

```php
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniApp;
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniAppConfig;

$wavePayMiniApp = new WavePayMiniApp(
    new WavePayMiniAppConfig(
        clientId: '...',
        clientSecret: '...',
        miniAppId: '...',
        secretKey: '...',
        baseUrl: WavePayMiniAppConfig::PRODUCTION_URL,
    ),
    cache: $cache, // a shared PSR-16 cache for the access token
);
// or WavePayMiniApp::fromEnv(cache: $cache), or $payments->wavePayMiniApp()
```

| Variable | `fromArray()` key | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `client_id` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `client_secret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_MINI_APP_ID` | `mini_app_id` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `secret_key` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `base_url` | The API base URL, e.g. `WavePayMiniAppConfig::PRODUCTION_URL`. A trailing `/` is dropped |
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `timeout_in_seconds` | Optional, 30 seconds by default |

Every setting except the timeout is required. See [Configuration](/php-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return `$wavePayMiniApp->accessToken()` from an endpoint of your own:

```php
// GET /mini-app/token
header('Content-Type: application/json');
echo json_encode(['accessToken' => $wavePayMiniApp->accessToken()]);
```

`accessToken()` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{baseUrl}/auth/v1/external-utility/token` and returns `access_token`. The token is kept in the [token cache](/php-myanmar-payments/configuration#token-cache) under `myanmar-payments.wave-pay-mini-app.token.<sha256(baseUrl|clientId)>`, the same key in every Laranex SDK, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). `$wavePayMiniApp->forgetToken()` drops it. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```php
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniAppItem;
use Laranex\PhpMyanmarPayments\WavePayMiniApp\WavePayMiniAppPaymentData;

$data = new WavePayMiniAppPaymentData(
    orderId: 'ORDER_'.$order->id,
    callbackUrl: 'https://shop.test/payments/wave-pay-mini-app/callback',
    items: [
        new WavePayMiniAppItem('Ticket', 3000),
        new WavePayMiniAppItem('Snack', 2000),
    ],
);

$payment = $wavePayMiniApp->payment($data);

// Store $data->merchantReferenceId with the order.

header('Content-Type: application/json');
echo $payment->toJson();
```

`payment()` sends no request: it signs the payload and returns it.

### WavePayMiniAppPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID (`orderID`) |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so verify the callback with this same URL |
| `items` | `list<WavePayMiniAppItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). `null` charges the exact sum of the items |
| `merchantReferenceId` | `?string` | No | Your ID for this attempt (`merchantRefID`). `null` or empty means a random 32-character hex ID |

`WavePayMiniAppItem` has a `name` (required) and an `amount` (`Amount|int`) in whole kyat, greater than 0. Errors are collected in this order: `orderId`, `callbackUrl`, `items`, `merchantReferenceId`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.`; a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.`

### The makePayment Payload

`$payment->toArray()` (or `json_encode($payment)`) is exactly the object Wave's `makePayment` takes, in this order:

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

Amounts are JSON integers. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`. For an amount above `PHP_INT_MAX`, use `toJson()`, which writes every digit.

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

Give every attempt, including a retry of the same order, a new `merchantReferenceId`. Leave it empty to get a fresh random ID, and **store it**: the callback's `merchantRefId` tells you which attempt was paid.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL, so pass the callback URL the payment was signed with: normally the URL the callback was posted to, without its query string. The mini app ID comes from the configuration.

```php
// POST /payments/wave-pay-mini-app/callback
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $wavePayMiniApp->handleCallback(
        CallbackRequest::fromGlobals(),
        'https://shop.test/payments/wave-pay-mini-app/callback',
    );
} catch (SignatureVerificationException) {
    http_response_code(400);
    echo 'invalid callback';
    exit;
}

if ($callback->isSuccessful()) {
    // $callback->orderId is your orderId
    // $callback->raw['merchantRefId'] is the attempt's reference
    // $callback->gatewayReference is Wave's transactionId
}

$callback->acknowledgement->send();
```

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL you pass, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or array in any callback field throws `SignatureVerificationException` with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it throws `Wave Pay Mini App callback is malformed.`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `Successful` |
| `processing` | `Pending` |
| `failed` | `Failed` |
| anything else | `Unknown` |

Wave Pay Mini App has no status API: rely on the callback.

## Responses

What Wave Pay Mini App puts in each property. See [Results](/php-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `payment()` → `MiniAppPayment` {#payment-response}

| Property / Method | Wave Pay Mini App value |
|---|---|
| `flow()` | `PaymentFlow::MiniApp` |
| `orderId` | Your `$data->orderId` |
| `amount` | The signed total, an `Amount` in whole kyat |
| `miniAppId` | The configured mini app ID |
| `merchantReferenceId` | Your `$data->merchantReferenceId`, generated when empty |
| `callbackUrl` | Your `$data->callbackUrl` |
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
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Errors

| Call | Throws | When |
|---|---|---|
| `new WavePayMiniAppConfig(...)` | `ConfigurationException` | A setting is missing or blank, e.g. `The wave_pay_mini_app configuration is missing [client_id].` |
| `new WavePayMiniAppPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above (`validate()` checks again). Item errors use `items.0.name` and `items.0.amount` keys |
| `accessToken()` | `ApiException` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `gatewayCode` is Wave's `error`, `gatewayMessage` its `error_description` (or `message`) |
| `handleCallback()` | `SignatureVerificationException` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or array. `Wave Pay Mini App callback is malformed.`: the hash matches but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |

When Wave can't be reached, `accessToken()` throws `ApiException` with `httpStatus` `0` and the original error as `getPrevious()`.
