---
title: Wave Money
description: Integrate Wave Money (WavePay) in plain PHP. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

| Method | Flow | Returns |
|---|---|---|
| `$waveMoney->initiate($data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `$waveMoney->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what Wave Money puts in each result.

Wave has no status API: the callback is the only payment result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Money: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Money']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Money', label: 'Payment request with hash', detail: '$waveMoney->initiate($data)' },
    { from: 'Wave Money', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Money', label: 'Pay with WavePay' },
    { from: 'Wave Money', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Money', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$waveMoney->handleCallback()' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoney;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyConfig;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyItem;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyPaymentData;

$waveMoney = new WaveMoney(new WaveMoneyConfig(merchantId: '...', secretKey: '...', merchantName: 'My Shop', sandbox: true));

$data = new WaveMoneyPaymentData(
    orderId: (string) $order->id,
    callbackUrl: 'https://shop.test/wave/callback.php',
    returnUrl: 'https://shop.test/orders/'.$order->id,
    description: 'Order #'.$order->id,
    items: [
        new WaveMoneyItem('Product A', 3000),
        new WaveMoneyItem('Product B', 2000),
    ],
);

$order->saveWaveReference($data->merchantReferenceId);

$payment = $waveMoney->initiate($data);

header('Location: '.$payment->url);
exit;
```

### WaveMoneyPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order id. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Valid URL Wave sends the customer back to. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer |
| `items` | `list<WaveMoneyItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat (Wave does not accept decimals), greater than 0. Defaults to the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `?string` | No | Unique id of this attempt. Defaults to a random id |

`WaveMoneyItem` takes a `name` and an `amount` (`Amount|int`) in whole kyat, greater than 0. The default total is summed with integers, never floats.

### Merchant Reference Id

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. The default is a fresh random id. **Store it**: read it from `$data->merchantReferenceId`. Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present.

## Handling Callbacks

```php
// wave/callback.php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$callback = $waveMoney->handleCallback(CallbackRequest::fromGlobals());

if ($callback->isSuccessful()) {
    // $callback->orderId, $callback->raw['merchantReferenceId'], $callback->gatewayReference (Wave transactionId)
}

$callback->acknowledgement()->send();
```

`$callback->orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave Money puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Property | Wave Money value |
|---|---|
| `orderId` | Your `orderId` |
| `url` | `{authenticate_url}/authenticate?transaction_id=…` (URL-encoded) |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's response: `message` (`success`), `transaction_id` |

The attempt's `merchantReferenceId` is not on the result: read it from `$data->merchantReferenceId`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Wave Money value |
|---|---|
| `orderId` | Wave `orderId`, or `merchantReferenceId` when `orderId` is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `status`, e.g. `PAYMENT_CONFIRMED` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `1000` |
| `raw` | The verified callback: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `Successful` |
| `INSUFFICIENT_BALANCE` | `Pending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `Failed` |
| `PAYMENT_REQUEST_CANCELLED` | `Cancelled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `Expired` |
| anything else | `Unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

A rejected request throws `ApiException`; `httpStatus` tells them apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`).
