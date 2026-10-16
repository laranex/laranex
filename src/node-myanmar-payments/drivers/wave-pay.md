---
title: Wave Pay
description: Integrate Wave Pay in Node.js. Redirect payments with typed line items and verified callbacks.
---

# Wave Pay

Wave Pay (Pay with Wave API v1.3) sends the customer to Wave's payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `await wave.initiate(data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wave.handleCallback(request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Pay has no status API: the callback is the only payment result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Pay: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Pay', label: 'Payment request with hash', detail: 'await wave.initiate(data)' },
    { from: 'Wave Pay', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Pay', label: 'Pay with WavePay' },
    { from: 'Wave Pay', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wave.handleCallback(request)' },
  ]"
/>

## Initiating a Payment

```ts
import {
  WavePay,
  WavePayConfig,
  type WavePayPaymentData,
} from '@laranex/myanmar-payments/wave-pay';

const wave = new WavePay({
  merchantId: '...',
  secretKey: '...',
  merchantName: 'My Shop',
  baseUrl: WavePayConfig.PRODUCTION_URL,
  baseRedirectUrl: WavePayConfig.PRODUCTION_URL,
  timeToLiveSeconds: 300,
});

const data: WavePayPaymentData = {
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

Payments are posted as JSON, in MMK, to `{baseUrl}/payment`; the customer is sent to `{baseRedirectUrl}/authenticate?transaction_id=…`.

### WavePayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID, at most 100 characters: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to, at most 255 characters |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to, at most 255 characters. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer, at most 255 characters |
| `items` | `WavePayItem[]` | Yes | At least one item |
| `amount` | `Amount \| number \| bigint` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `string` | No | Unique ID of this attempt, at most 100 characters: letters, digits, `_` and `-` only. Unset or empty means a random ID |
| `merchantName` | `string` | No | Business name shown on Wave's page for this payment. Unset or `null` uses the configured `merchantName`; a blank one is rejected |
| `timeToLiveSeconds` | `number` | No | Seconds the customer has to pay this payment, a whole number greater than 0. Unset or `null` uses the configured `timeToLiveSeconds` |
| `additionalField3`, `additionalField4`, `additionalField5` | `string` | No | Extra information, at most 50 characters each, sent as `additional_field_3`–`5` and echoed in the callback's `additionalField3`–`5`. Unset, `null` or empty is not sent |

Length limits count UTF-8 bytes. `WavePayItem` has a `name` and an `amount` in whole kyat, greater than 0. The items are summed with exact `bigint` arithmetic, never floats; `WavePay.resolvedAmount(data)` returns the total that will be charged.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409`). Leave it empty to get a random one, and store `data.merchantReferenceId` after `initiate()`: Wave's callback may omit `orderId`.

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

## Responses

See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Field | Wave Pay value |
|---|---|
| `flow` | `'redirect'` |
| `orderId` | Your `data.orderId` |
| `url` | `{baseRedirectUrl}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | Wave Pay value |
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
| `BILL_COLLECTION_FAILED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_LOCKED` | `failed` |
| `PAYMENT_REQUEST_CANCELLED` | `canceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `expired` |
| anything else | `unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `WavePay.validate(data)` fails. Nothing is sent and `data` is left untouched. Item errors use `items.0.amount` keys |
| `initiate()` | `ApiError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationError` | `hashValue` doesn't match, a hashed field holds an object or array, `amount` isn't a decimal, both `orderId` and `merchantReferenceId` are empty, or either holds anything but letters, digits, `_` and `-` |

`httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`).
