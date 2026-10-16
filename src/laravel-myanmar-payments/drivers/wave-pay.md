---
title: Wave Pay
description: Integrate Wave Pay with Laravel Myanmar Payments. Redirect payments with typed line items and verified callbacks.
---

# Wave Pay

Wave Pay (Pay with Wave API v1.3) sends the customer to Wave's payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `wavePay()->initiate($data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wavePay()->handleCallback($request)` | Verify the callback | [`PaymentCallback`](#handlecallback-response) |

Wave Pay has no status API in this package: the callback is the only payment result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Pay: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Pay', label: 'Payment request with hash', detail: 'wavePay()->initiate($data)' },
    { from: 'Wave Pay', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Pay', label: 'Pay with WavePay' },
    { from: 'Wave Pay', to: 'Customer', label: 'Back to the frontend URL', detail: 'returnUrl: not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callbackUrl, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wavePay()->handleCallback($request)' },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\WavePay\WavePayItem;
use Laranex\PhpMyanmarPayments\WavePay\WavePayPaymentData;

$data = new WavePayPaymentData(
    orderId: 'ORDER_'.$order->id,
    callbackUrl: route('payments.wave.callback'),
    returnUrl: route('orders.show', $order),
    description: 'Order #'.$order->id,
    items: [
        new WavePayItem('Product A', 6000),
        new WavePayItem('Product B', 4000),
    ],
);

$payment = MyanmarPayments::wavePay()->initiate($data);

$order->update(['wave_reference' => $data->merchantReferenceId]);

return redirect()->away($payment->url);
```

`initiate()` posts JSON, in MMK, to `{base_url}/payment` and sends the customer to `{base_redirect_url}/authenticate?transaction_id=…`. Set `WAVE_PAY_BASE_URL` and `WAVE_PAY_BASE_REDIRECT_URL`; see [Configuration](/laravel-myanmar-payments/configuration#production-endpoints).

### WavePayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order ID, at most 100 characters: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | Absolute http or https URL that Wave posts the result to, at most 255 characters. Wave may require HTTPS with a CA-issued certificate in production |
| `returnUrl` | `string` | Yes | Absolute http or https URL Wave sends the customer back to, at most 255 characters. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer, at most 255 characters |
| `items` | `list<WavePayItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). `null` charges the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `?string` | No | Unique ID of this attempt, at most 100 characters: letters, digits, `_` and `-` only. `null` or empty means a random ID |
| `merchantName` | `?string` | No | Business name shown on Wave's page for this payment. `null` uses `WAVE_PAY_MERCHANT_NAME`; a blank one throws `The merchantName field is required.` |
| `timeToLiveSeconds` | `?int` | No | Seconds the customer has to pay this payment, greater than 0. Overrides `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS` for this payment, in the request hash too; `null` uses it |
| `additionalField3`, `additionalField4`, `additionalField5` | `?string` | No | Extra information, at most 50 characters each, sent as `additional_field_3`–`5` and echoed in the callback's `additionalField3`–`5`. `null` or empty is not sent |

Length limits count UTF-8 bytes. `WavePayItem` takes a `name` and an `amount` (`Amount|int`) in whole kyat, greater than 0. The items are summed with exact integer arithmetic, never floats.

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it** from `$data->merchantReferenceId`: `orderId` is shared by every attempt of the order, while the callback's `merchantReferenceId` names the attempt that was paid.

## Handling Callbacks

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

Route::post('/payments/wave/callback', function (Request $request) {
    try {
        $callback = MyanmarPayments::wavePay()->handleCallback($request);
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

Wave hashes the values joined with no separator, so a matching `hashValue` alone doesn't pin down where one value ends and the next begins. After the hash matches, `amount` must be a non-negative decimal (e.g. `10000` or `10000.00`), at least one of `orderId` and `merchantReferenceId` must be sent, and each, when sent, may only hold letters, digits, `_` and `-`; otherwise `handleCallback()` throws `SignatureVerificationException`. New payments are held to the same ID rules, so every callback for a payment made with this package passes them.

## Responses

What Wave Pay puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Property | Wave Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `url` | `{base_redirect_url}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gatewayReference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `merchantReferenceId` is not on the result: read it from `$data->merchantReferenceId`.

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
| `new WavePayPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is sent |
| `initiate()` | `ApiException` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handleCallback()` | `SignatureVerificationException` | `hashValue` doesn't match, a hashed field holds an object or array, `amount` isn't a decimal, neither `orderId` nor `merchantReferenceId` is sent, or either holds anything but letters, digits, `_` and `-` |

`httpStatus` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`).
