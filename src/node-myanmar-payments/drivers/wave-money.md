---
title: Wave Money
description: Integrate Wave Money (WavePay) in Node.js. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

Wave Money's payment gateway sends the customer to a Wave payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `await wave.initiate(data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wave.handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Money has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what Wave Money puts in each result.

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
import {
  WaveMoney,
  type WaveMoneyPaymentData,
} from '@laranex/myanmar-payments/wave-money';

const wave = new WaveMoney({
  merchantId: '...',
  secretKey: '...',
  merchantName: 'My Shop',
});

const data: WaveMoneyPaymentData = {
  orderId: `ORDER_${order.id}`,
  callbackUrl: 'https://shop.test/payments/wave/callback',
  returnUrl: `https://shop.test/orders/${order.id}`,
  description: `Order #${order.id}`,
  items: [
    { name: 'Product A', amount: 6000 },
    { name: 'Product B', amount: 4000 },
  ],
};

const payment = await wave.initiate(data);

// Store data.merchantReferenceId with the order: initiate() filled it in.

res.writeHead(302, { Location: payment.url }).end();
```

### WaveMoneyPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer |
| `items` | `WaveMoneyItem[]` | Yes | At least one item |
| `amount` | `Amount \| number \| bigint` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `string` | No | Unique ID of this attempt. Unset or empty means a random ID |

`WaveMoneyItem` has a `name` and an `amount` in whole kyat, greater than 0. The items are summed with exact `bigint` arithmetic, never floats; `WaveMoney.resolvedAmount(data)` returns the total that will be charged.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present. `initiate()` writes the generated ID to `data.merchantReferenceId` once `data` passes validation, so keep a reference to the object you pass.

## Handling Callbacks

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// POST /payments/wave/callback
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = wave.handleCallback(request);

  if (callback.isSuccessful()) {
    // callback.orderId is your orderId
    // callback.raw.merchantReferenceId is the attempt's reference
    // callback.gatewayReference is Wave's transactionId
  }

  callback.acknowledgement.send(res);
} catch {
  res.writeHead(400).end('invalid callback');
}
```

`callback.orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave Money puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `undefined`. `raw` holds plain JavaScript values (JSON numbers become `number`s), while the typed fields such as `amount` keep the exact text Wave sent.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Field | Wave Money value |
|---|---|
| `flow` | `'redirect'` |
| `orderId` | Your `data.orderId` |
| `url` | `{authenticateUrl}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `merchantReferenceId` is not on the result: read it from `data.merchantReferenceId`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | Wave Money value |
|---|---|
| `orderId` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `10000` |
| `raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `successful` |
| `INSUFFICIENT_BALANCE` | `pending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `failed` |
| `PAYMENT_REQUEST_CANCELLED` | `canceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `expired` |
| anything else | `unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `WaveMoney.validate(data)` fails. Nothing is sent and `data` is left untouched |
| `initiate()` | `ApiError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationError` | `hashValue` doesn't match |

The async calls reject with these errors. `httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached, the request times out or the `signal` aborts, `initiate()` throws `ApiError` with the original error as `cause`.
