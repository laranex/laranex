---
title: Wave Money
description: Integrate Wave Money (WavePay) with Laravel Myanmar Payments. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

Wave Money's payment gateway sends the customer to a Wave payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `waveMoney()->initiate($data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `waveMoney()->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Money has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what Wave Money puts in each result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Money: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Money']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Money', label: 'Payment request with hash', detail: 'waveMoney()->initiate($data)' },
    { from: 'Wave Money', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Money', label: 'Pay with WavePay' },
    { from: 'Wave Money', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Money', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'waveMoney()->handleCallback($request)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyItem;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyPaymentData;

$data = new WaveMoneyPaymentData(
    orderId: 'ORDER_'.$order->id,
    callbackUrl: route('payments.wave.callback'),
    returnUrl: route('orders.show', $order),
    description: 'Order #'.$order->id,
    items: [
        new WaveMoneyItem('Product A', 6000),
        new WaveMoneyItem('Product B', 4000),
    ],
);

$payment = MyanmarPayments::waveMoney()->initiate($data);

$order->update(['wave_reference' => $data->merchantReferenceId]);

return redirect()->away($payment->url);
```

### WaveMoneyPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer |
| `items` | `list<WaveMoneyItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). `null` charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `?string` | No | Unique ID of this attempt. `null` or empty means a random ID |

`WaveMoneyItem` takes a `name` and an `amount` (`Amount|int`) in whole kyat, greater than 0. The items are summed with exact integer arithmetic, never floats.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present. Read it from `$data->merchantReferenceId`.

## Handling Callbacks

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

Route::post('/payments/wave/callback', function (Request $request) {
    try {
        $callback = MyanmarPayments::waveMoney()->handleCallback($request);
    } catch (SignatureVerificationException) {
        abort(400);
    }

    if ($callback->isSuccessful()) {
        // $callback->orderId is your orderId
        // $callback->raw['merchantReferenceId'] is the attempt's reference
        // $callback->gatewayReference is Wave's transactionId
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.wave.callback');
```

`$callback->orderId` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

## Responses

What Wave Money puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes. `raw` holds plain PHP values (JSON numbers stay `string`s with their exact text), while the typed properties such as `amount` keep the exact text Wave sent.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Property | Wave Money value |
|---|---|
| `orderId` | Your `orderId` |
| `url` | `{authenticate_url}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `merchantReferenceId` is not on the result: read it from `$data->merchantReferenceId`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | Wave Money value |
|---|---|
| `orderId` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `gatewayReference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `10000` |
| `raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement` into a `CallbackResponse` (`Responsable`). `handleCallback()` accepts an `Illuminate\Http\Request` or a `CallbackRequest`.

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `Successful` |
| `INSUFFICIENT_BALANCE` | `Pending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `Failed` |
| `PAYMENT_REQUEST_CANCELLED` | `Canceled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `Expired` |
| anything else | `Unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Throws | When |
|---|---|---|
| `new WaveMoneyPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is sent |
| `initiate()` | `ApiException` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationException` | `hashValue` doesn't match, or a hashed field holds an object or array |

`httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`). When Wave can't be reached, `initiate()` throws `ApiException` with `httpStatus` `0`.
