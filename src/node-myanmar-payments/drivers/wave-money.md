---
title: Wave Money
description: Integrate Wave Money (WavePay) in Node.js. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

| Method | Flow | Returns |
|---|---|---|
| `await wave.initiate(data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wave.handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Wave puts in each result.

Wave has no status API: the callback is the only payment result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Money: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Money']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Money', label: 'Payment request with hash', detail: 'await wave.initiate(data)' },
    { from: 'Wave Money', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Money', label: 'Pay with WavePay' },
    { from: 'Wave Money', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Money', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wave.handleCallback(request)' },
  ]"
/>

## Initiating a Payment

```ts
import { Amount } from '@laranex/myanmar-payments';
import { WaveMoney, type WaveMoneyPaymentData } from '@laranex/myanmar-payments/wave-money';

const wave = new WaveMoney({ merchantId: '...', secretKey: '...', merchantName: 'My Shop' });

const data: WaveMoneyPaymentData = {
  orderId,
  callbackUrl: 'https://shop.test/payments/wave/callback',
  returnUrl: `https://shop.test/orders/${orderId}`,
  description: `Order #${orderId}`,
  items: [
    { name: 'Product A', amount: Amount.kyat(3000) },
    { name: 'Product B', amount: Amount.kyat(2000) },
  ],
};

const payment = await wave.initiate(data);
await saveWaveReference(orderId, data.merchantReferenceId); // filled in by initiate()
res.writeHead(302, { Location: payment.url }).end();
```

`initiate()` writes the generated `merchantReferenceId` onto the `data` object you pass, so keep a reference to it.

::: warning Wave sandbox host
Wave's sandbox API is `https://preprodpayments.wavemoney.io:8107`, while the customer-facing authenticate page is served without the port, at `https://preprodpayments.wavemoney.io/authenticate`. The package uses both hosts by default; set `baseUrl` and `authenticateUrl` in `WaveMoneyConfig` if Wave gives you others.
:::

### WaveMoneyPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order id. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer |
| `items` | `WaveMoneyItem[]` | Yes | At least one item, each with a `name` and an `amount` in whole kyat greater than 0 |
| `amount` | `Amount \| number \| bigint` | No | Whole kyat (Wave does not accept decimals), greater than 0. Leave it unset to charge the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `string` | No | Unique id of this attempt. Empty means a random id |

`WaveMoney.resolvedAmount(data)` returns the total that will be charged; items are summed with exact `bigint` arithmetic. `WaveMoney.validate(data)` runs before the request and throws `InvalidPaymentDataError`.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random id, and **store it** after `initiate()`: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present.

## Handling Callbacks

```ts
try {
  const callback = wave.handleCallback(await CallbackRequest.fromNodeRequest(req));
  if (callback.isSuccessful()) {
    // callback.orderId, callback.raw.merchantReferenceId, callback.gatewayReference (Wave transactionId)
  }
  callback.acknowledgement.send(res);
} catch (error) {
  res.writeHead(400).end('invalid callback');
}
```

`callback.orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. On error the method throws (the promise rejects); a field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s), while the typed fields such as `amount` keep the exact text Wave sent. Network failures, timeouts and an aborted `signal` throw `ApiError` with the original error as `cause`.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Field | Wave value |
|---|---|
| `flow` | `'redirect'` |
| `orderId` | Your `data.orderId` |
| `url` | `{authenticateUrl}/authenticate?transaction_id=…` (no port), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

Once `data` passes validation, `initiate()` writes the generated reference to `data.merchantReferenceId` when you left it empty; invalid data is left untouched. Errors: `InvalidPaymentDataError` (no request sent), `ApiError` (HTTP error, `message` not `success`, or no `transaction_id`).

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | Wave value |
|---|---|
| `orderId` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `5000` |
| `raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Read the attempt's reference with `callback.raw.merchantReferenceId`. Errors: `SignatureVerificationError` when `hashValue` does not match.

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `successful` |
| `INSUFFICIENT_BALANCE` | `pending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `failed` |
| `PAYMENT_REQUEST_CANCELLED` | `cancelled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `expired` |
| anything else | `unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

A rejected request throws `ApiError`; `httpStatus` tells them apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`).
