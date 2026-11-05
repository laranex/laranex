---
title: Wave Pay Mini App
description: Integrate Wave Pay Mini App with NestJS Myanmar Payments. Access tokens, signed payment payloads for Wave's JavaScript SDK and callbacks verified against the request URL.
---

# Wave Pay Mini App

Wave Pay Mini App (Wave Money JS SDK v1.8) lets the customer pay inside the WavePay app: your web page runs in the app's webview and calls Wave's JavaScript SDK. Your NestJS app covers the three parts that need secrets; the page itself calls `makePayment`.

| Call | What it does | Returns |
|---|---|---|
| `await wavePayMiniApp().accessToken()` | Get an access token for the page, cached | `string` |
| `wavePayMiniApp().payment(data)` | Sign the `makePayment` payload, no API call | [`MiniAppPayment`](#payment-response) |
| `@VerifiedCallback('wave-pay-mini-app')` | Verify the callback against the request URL | [`PaymentCallback`](#handlecallback-response) |

Wave Pay Mini App has no status API: the callback is the only payment result. `@InjectWavePayMiniApp()` (token `WAVE_PAY_MINI_APP`) injects the gateway directly.

## How it works

The page logs in with a token from your app, then pays with a payload your app signed. Wave posts the result to your callback URL.

<SequenceDiagram
  title="Wave Pay Mini App: token, signed payment, result"
  :participants="['Customer', 'Your page', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your page', label: 'Open your mini app in WavePay' },
    { from: 'Your page', to: 'Your app', label: 'Ask for an access token' },
    { from: 'Your app', to: 'Wave Pay', label: 'Token unless cached', detail: 'wavePayMiniApp().accessToken()' },
    { from: 'Your app', to: 'Your page', label: 'access_token', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Log in to the SDK', detail: 'authModule.loginWithAccessToken(token)' },
    { from: 'Your page', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your page', label: 'Signed payload', detail: 'return wavePayMiniApp().payment(data)', response: true },
    { from: 'Your page', to: 'Wave Pay', label: 'Pay', detail: 'paymentModule.makePayment(payload)' },
    { from: 'Customer', to: 'Wave Pay', label: 'Enter PIN' },
    { from: 'Wave Pay', to: 'Your page', label: 'Payment result', detail: 'not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '@VerifiedCallback, request URL' },
  ]"
/>

## Configuration

| Variable | Module option | Description |
|---|---|---|
| `WAVE_PAY_MINI_APP_CLIENT_ID` | `wavePayMiniApp.clientId` | Client ID issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_CLIENT_SECRET` | `wavePayMiniApp.clientSecret` | Client secret issued by Wave, for the token endpoint |
| `WAVE_PAY_MINI_APP_APP_ID` | `wavePayMiniApp.miniAppId` | Your mini app ID (`miniAppID`) |
| `WAVE_PAY_MINI_APP_SECRET_KEY` | `wavePayMiniApp.secretKey` | Hash secret key for payment and callback hashes |
| `WAVE_PAY_MINI_APP_BASE_URL` | `wavePayMiniApp.baseUrl` | The API base URL, e.g. `WavePayMiniAppConfig.PRODUCTION_URL`. A trailing `/` is dropped |

Every setting is required; `MYANMAR_PAYMENTS_HTTP_TIMEOUT` (30 seconds by default) applies to the token request. See [Configuration](/nestjs-myanmar-payments/configuration#production-endpoints) for the production and UAT base URLs.

## Access Token

The page needs an access token for `WaveJsSDK.authModule.loginWithAccessToken(token)`. Return it from a route of your own:

```ts
@Get('mini-app/token')
async token(): Promise<{ accessToken: string }> {
  return { accessToken: await this.payments.wavePayMiniApp().accessToken() };
}
```

`accessToken()` posts `client_id`, `client_secret` and `grant_type=client_credentials` as a form to `{baseUrl}/auth/v1/external-utility/token` and returns `access_token`. The token is kept in the module's [token cache](/nestjs-myanmar-payments/configuration#cache) (`@nestjs/cache-manager` when it is registered, else memory) under `myanmar-payments.wave-pay-mini-app.token.<sha256 of baseUrl|clientId>`, the same key in every Laranex package, for Wave's `expires_in` minus 60 seconds (at least 60 seconds; a missing or non-positive value means 3600). Concurrent calls share one token request. `await wavePayMiniApp().forgetToken()` drops it. Never request the token from the browser: it needs the client secret.

## Starting a Payment

```ts
import type {
  MiniAppPayment,
  WavePayMiniAppPaymentData,
} from '@laranex/myanmar-payments';
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';
import { Controller, Param, Post } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';

@Controller('mini-app')
export class MiniAppCheckoutController {
  constructor(
    private readonly payments: MyanmarPaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Post('orders/:id/pay')
  async pay(@Param('id') id: string): Promise<MiniAppPayment> {
    const order = await this.orders.findOrFail(id);

    const data: WavePayMiniAppPaymentData = {
      orderId: `ORDER_${order.id}`,
      callbackUrl: 'https://shop.test/payments/wave-pay-mini-app/callback',
      items: [
        { name: 'Ticket', amount: 3000 },
        { name: 'Snack', amount: 2000 },
      ],
    };

    const payment = this.payments.wavePayMiniApp().payment(data);

    await this.orders.update(order, {
      waveReference: data.merchantReferenceId,
    });

    // Serialized with toJSON(): the makePayment object
    return payment;
  }
}
```

`payment()` sends no request: it validates the data, signs the payload and returns it.

### WavePayMiniAppPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID (`orderID`) |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to (`callBackUrl`). It is signed, so it must be the URL of your callback route: `@VerifiedCallback` verifies against the URL the callback arrives at |
| `items` | `WavePayMiniAppItem[]` | Yes | At least one item |
| `amount` | `Amount \| number \| bigint` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset or `null` charges the exact sum of the items |
| `merchantReferenceId` | `string` | No | Your ID for this attempt (`merchantRefID`). Unset or empty means a random 32-character hex ID, written back to `data.merchantReferenceId` |

`WavePayMiniAppItem` has a `name` (required) and an `amount` in whole kyat, greater than 0. The items are summed with exact `bigint` arithmetic. Errors are collected in this order: `orderId`, `callbackUrl`, `items`, `merchantReferenceId`, each item's `items.0.name` and `items.0.amount`, then `amount`. Without items or `amount`, `amount` reports `The amount field is required.`; a negative amount reports `The amount field must not be negative.`; a decimal one reports `Wave Pay Mini App does not accept decimal amounts; the amount field must be a whole number.` Invalid data is left untouched.

### The makePayment Payload

Returning the `MiniAppPayment` from a handler serializes it with `toJSON()`, exactly the object Wave's `makePayment` takes, in this order:

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

Amounts are JSON integers. `hashValue` is the lowercase hex HMAC-SHA256, keyed with the secret key, of `amount`, `orderID`, `miniAppID`, `merchantRefID` and `callBackUrl` joined with no separator, e.g. `5000ORDER123MINI456MERCHANT789https://yourdomain.com/callback`. For an amount above `Number.MAX_SAFE_INTEGER`, send `payment.toJsonString()`, which writes every digit on every Node.js version.

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

On `WM-AUTH-002` (TokenExpired) or `WM-AUTH-003` (InvalidToken), call `await wavePayMiniApp().forgetToken()` on your server, fetch a new token and log in again.

### Merchant Reference ID

Give every attempt, including a retry of the same order, a new `merchantReferenceId`. Leave it empty to get a fresh random ID, and **store it** after `payment()`: the callback's `merchantRefId` tells you which attempt was paid.

## Handling Callbacks

The callback carries neither the mini app ID nor the callback URL. `@VerifiedCallback('wave-pay-mini-app')` and `this.payments.handleCallback('wave-pay-mini-app', req)` verify against the URL the callback was posted to, `callbackUrlFrom(req)`; the mini app ID comes from the configuration.

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';
import {
  AcknowledgeCallback,
  VerifiedCallback,
} from '@laranex/nestjs-myanmar-payments';
import { Controller, Post } from '@nestjs/common';

@Controller('payments')
export class WavePayMiniAppCallbackController {
  @Post('wave-pay-mini-app/callback')
  @AcknowledgeCallback()
  handle(
    @VerifiedCallback('wave-pay-mini-app') callback: PaymentCallback,
  ): PaymentCallback {
    if (callback.isSuccessful()) {
      // callback.orderId is your orderId
      // callback.raw.merchantRefId is the attempt's reference
      // callback.gatewayReference is Wave's transactionId
    }

    return callback;
  }
}
```

`callbackUrlFrom(req)` is the protocol, host and path, without the query string: the protocol and host name Express or Fastify resolve (`X-Forwarded-Proto` and `X-Forwarded-Host` count only from a proxy the app trusts: Express `trust proxy`, Fastify `trustProxy`), the port of the matching `Host` (or trusted `X-Forwarded-Host`) value, and the path as received (Express `originalUrl`, so a mounted app keeps its mount path). A request without a host throws. `handleCallback('wave-pay-mini-app', ...)` needs the Nest request, not a `CallbackRequest`; passing one throws. When the URL the callback arrives at isn't the one the payment was signed with (e.g. behind a proxy the app doesn't trust), verify with the signed URL yourself:

```ts
// callbackRequestFrom comes from '@laranex/nestjs-myanmar-payments'; req is @Req()
const callback = this.payments.wavePayMiniApp().handleCallback(
  await callbackRequestFrom(req),
  'https://shop.test/payments/wave-pay-mini-app/callback',
);
```

The expected `hashValue` is the same HMAC as the payment's, over the callback's `amount` (its exact JSON text), `orderId`, your mini app ID, `merchantRefId` and the callback URL, compared in constant time and ignoring the case of the hex digits. A missing or non-string `hashValue`, a mismatch, or an object or array in any callback field fails with `Wave Pay Mini App callback hash verification failed.`. After the hash matches, `orderId` and `merchantRefId` must not be empty and `amount` must be a whole number; otherwise it fails with `Wave Pay Mini App callback is malformed.`. `@VerifiedCallback` answers both with `400 Bad Request`. JSON callbacks need `rawBody: true` in `NestFactory.create()`.

## Statuses

Only `successful` means the customer paid. `transactionStatus` is matched trimmed and case-insensitively.

| Wave `transactionStatus` | `PaymentStatus` |
|---|---|
| `successful` | `Successful` |
| `processing` | `Pending` |
| `failed` | `Failed` |
| anything else | `Unknown` |

## Responses

What Wave Pay Mini App puts in each property. See [Results](/nestjs-myanmar-payments/references/results#miniapppayment) and [PaymentCallback & Status](/nestjs-myanmar-payments/references/payment-callback) for the full classes. `raw` holds plain JavaScript values, with JSON numbers kept as their exact text in a `string`.

### `payment()` → `MiniAppPayment` {#payment-response}

| Property / Method | Wave Pay Mini App value |
|---|---|
| `flow` | `mini_app` |
| `orderId` | Your `data.orderId` |
| `amount` | The signed total, an `Amount` in whole kyat |
| `miniAppId` | The configured mini app ID |
| `merchantReferenceId` | Your `data.merchantReferenceId`, generated when empty |
| `callbackUrl` | Your `data.callbackUrl` |
| `hashValue` | The payload's hash |
| `items` | `readonly MiniAppPaymentItem[]`: `{ name, amount }`, `amount` an `Amount` |
| `toJSON()` | The `makePayment` object: `amount`, `miniAppID`, `merchantRefID`, `orderID`, `callBackUrl`, `hashValue`, `items` (`name`, `amount`), amounts as numbers |
| `toJsonString()` | The same object as compact JSON, amounts with every digit |

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
| `wavePayMiniApp()` | `ConfigurationError` | A setting is missing or blank, e.g. `The wave_pay_mini_app configuration is missing [client_id].` |
| `payment()` | `InvalidPaymentDataError` | A value breaks the rules above. Nothing is signed. Item errors use `items.0.name` and `items.0.amount` keys |
| `accessToken()` | `ApiError` | Wave answers with an HTTP error, a body that isn't JSON, or no `access_token`. The message is `Wave Pay Mini App token request failed: [<error>] <error_description>` when Wave sends an `error`, else `Wave Pay Mini App token request failed with HTTP <status>.`; `gatewayCode` is Wave's `error`, `gatewayMessage` its `error_description` (or `message`) |
| `handleCallback()` | `SignatureVerificationError` | `Wave Pay Mini App callback hash verification failed.`: `hashValue` is missing, not a string or doesn't match, or a callback field holds an object or array. `Wave Pay Mini App callback is malformed.`: the hash matched but `orderId` or `merchantRefId` is empty, or `amount` isn't a whole number |

When Wave can't be reached, `accessToken()` throws `ApiError` with `httpStatus` `0`.
