---
title: Wave Pay
description: Integrate Wave Pay in plain PHP. Redirect payments with typed line items and verified callbacks.
---

# Wave Pay

Wave Pay (Pay with Wave API v1.3) sends the customer to Wave's payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `$wavePay->initiate($data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `$wavePay->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Pay: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Pay', label: 'Payment request with hash', detail: '$wavePay->initiate($data)' },
    { from: 'Wave Pay', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Pay', label: 'Pay with WavePay' },
    { from: 'Wave Pay', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$wavePay->handleCallback($request)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\WavePay\WavePay;
use Laranex\PhpMyanmarPayments\WavePay\WavePayConfig;
use Laranex\PhpMyanmarPayments\WavePay\WavePayItem;
use Laranex\PhpMyanmarPayments\WavePay\WavePayPaymentData;

$wavePay = new WavePay(new WavePayConfig(
    merchantId: '...',
    secretKey: '...',
    merchantName: 'My Shop',
    baseUrl: WavePayConfig::PRODUCTION_URL,
    baseRedirectUrl: WavePayConfig::PRODUCTION_URL,
    timeToLiveSeconds: 300,
));

$data = new WavePayPaymentData(
    orderId: 'ORDER_'.$order->id,
    callbackUrl: 'https://shop.test/payments/wave/callback',
    returnUrl: 'https://shop.test/orders/'.$order->id,
    description: 'Order #'.$order->id,
    items: [
        new WavePayItem('Product A', 6000),
        new WavePayItem('Product B', 4000),
    ],
);

$payment = $wavePay->initiate($data);

// Store $data->merchantReferenceId with the order.

header('Location: '.$payment->url);
exit;
```

`initiate()` posts JSON, in MMK, to `{baseUrl}/payment` and sends the customer to `{baseRedirectUrl}/authenticate?transaction_id=…` (see [Configuration](/php-myanmar-payments/configuration#uat-endpoints)).

### WavePayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID, at most 100 characters: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to, at most 255 characters |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to, at most 255 characters. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer, at most 255 characters |
| `items` | `list<WavePayItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). `null` charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `?string` | No | Unique ID of this attempt, at most 100 characters: letters, digits, `_` and `-` only. `null` or empty means a random ID |
| `merchantName` | `?string` | No | Business name shown on Wave's page for this payment. `null` uses `WavePayConfig`'s `merchantName`; a blank one is rejected |
| `timeToLiveSeconds` | `?int` | No | Seconds the customer has to pay this payment, greater than 0. `null` uses `WavePayConfig`'s `timeToLiveSeconds` |
| `additionalField3`, `additionalField4`, `additionalField5` | `?string` | No | Extra information, at most 50 characters each, sent as `additional_field_3`–`5` and echoed in the callback's `additionalField3`–`5`. `null` or empty is not sent |

Length limits count UTF-8 bytes. `WavePayItem` has a `name` and an `amount` (`Amount|int`) in whole kyat, greater than 0. `$data->amount` holds the total that will be charged.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: the callback's `merchantReferenceId` tells you which attempt was paid.

## Handling Callbacks

```php
// POST /payments/wave/callback
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $wavePay->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException) {
    http_response_code(400);
    echo 'invalid callback';
    exit;
}

if ($callback->isSuccessful()) {
    // $callback->orderId is your orderId
    // $callback->raw['merchantReferenceId'] is the attempt's reference
    // $callback->gatewayReference is Wave's transactionId
}

$callback->acknowledgement->send();
```

`$callback->orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

Wave hashes the values joined with no separator, so a matching `hashValue` alone doesn't pin down where one value ends and the next begins. After the hash matches, at least one of `orderId` / `merchantReferenceId` must be present, `amount` must be a decimal (e.g. `10000` or `10000.00`) and `orderId` and `merchantReferenceId`, when sent, may only hold letters, digits, `_` and `-`; otherwise `handleCallback()` throws `SignatureVerificationException`.

## Responses

What Wave Pay puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes. A property the gateway didn't send is `null`. JSON numbers keep their exact text as strings.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Property / Method | Wave Pay value |
|---|---|
| `flow()` | `PaymentFlow::Redirect` |
| `orderId` | Your `$data->orderId` |
| `url` | `{baseRedirectUrl}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Wave Pay value |
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
| `PAYMENT_CONFIRMED` | `Successful` |
| `BILL_COLLECTION_FAILED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_LOCKED` | `Failed` |
| `PAYMENT_REQUEST_CANCELLED` | `Canceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `Expired` |
| anything else | `Unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Throws | When |
|---|---|---|
| `new WavePayItem(...)` | `InvalidPaymentDataException` | Its `amount` is a negative `int` |
| `new WavePayPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is sent. Item errors use `items.0.name` and `items.0.amount` keys |
| `initiate()` | `ApiException` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationException` | `hashValue` doesn't match, a hashed field holds an object or array, `amount` isn't a decimal, neither `orderId` nor `merchantReferenceId` is sent, or `orderId` or `merchantReferenceId` holds anything but letters, digits, `_` and `-` |

`httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached, `initiate()` throws `ApiException` with `httpStatus` `0` and the original error as `getPrevious()`.
