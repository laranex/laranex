---
title: Wave Pay
description: Integrate Wave Pay in Python. Redirect payments with typed line items and verified callbacks, sync or async.
---

# Wave Pay

Wave Pay (Pay with Wave API v1.3) sends the customer to Wave's payment page to pay with their WavePay wallet.

| Call | What it does | Returns |
|---|---|---|
| `wave.initiate(data)` | Redirect to Wave's payment page | [`RedirectPayment`](#initiate-response) |
| `wave.handle_callback(request)` | Verify the callback | [`PaymentCallback`](#handle-callback-response) |

Wave Pay has no status API in this package: the callback is the only payment result.

`AsyncWavePay` has the same methods: await `initiate()`; `handle_callback()` stays a plain call.

[Responses](#responses) shows what Wave Pay puts in each result.

## How it works

Wave sends the customer back to your return URL and posts the result to your callback URL separately.

<SequenceDiagram
  title="Wave Pay: payment request, authenticate, result"
  :participants="['Customer', 'Your app', 'Wave Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Wave Pay', label: 'Payment request with hash', detail: 'wave.initiate(data)' },
    { from: 'Wave Pay', to: 'Your app', label: 'transaction_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to authenticate', detail: '/authenticate?transaction_id=…', response: true },
    { from: 'Customer', to: 'Wave Pay', label: 'Pay with WavePay' },
    { from: 'Wave Pay', to: 'Customer', label: 'Back to the frontend URL', detail: 'return_url: not proof of payment', response: true },
    { from: 'Wave Pay', to: 'Your app', label: 'Backend result URL callback', detail: 'POST to callback_url, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'wave.handle_callback(request)' },
  ]"
/>

## Initiating a Payment

```python
from django.shortcuts import get_object_or_404, redirect
from python_myanmar_payments import (
    WavePay,
    WavePayConfig,
    WavePayItem,
    WavePayPaymentData,
)

from shop.models import Order

wave = WavePay(
    WavePayConfig(
        merchant_id="...",
        secret_key="...",
        merchant_name="My Shop",
        base_url=WavePayConfig.PRODUCTION_URL,
        base_redirect_url=WavePayConfig.PRODUCTION_URL,
        time_to_live_seconds=300,
    )
)

def wave_checkout(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id)

    data = WavePayPaymentData(
        order_id=f"ORDER_{order.id}",
        callback_url="https://shop.test/payments/wave/callback",
        return_url=f"https://shop.test/orders/{order.id}",
        description=f"Order #{order.id}",
        items=[
            WavePayItem(name="Product A", amount=6000),
            WavePayItem(name="Product B", amount=4000),
        ],
    )

    payment = wave.initiate(data)

    # Store data.merchant_reference_id with the order: initiate() filled it in.

    return redirect(payment.url)
```

`initiate()` posts JSON, in MMK, to `{base_url}/payment` and redirects to `{base_redirect_url}/authenticate?transaction_id=…`; see [Configuration](/python-myanmar-payments/configuration#production-endpoints) for both URLs.

### WavePayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | Your order ID, at most 100 characters: letters, digits, `_` and `-` only. One order can have several payment attempts |
| `callback_url` | `str` | Yes | Absolute http or https URL that Wave posts the result to, at most 255 characters |
| `return_url` | `str` | Yes | Absolute http or https URL Wave sends the customer back to, at most 255 characters. Not proof of payment |
| `description` | `str` | Yes | Shown to the customer, at most 255 characters |
| `items` | `Sequence[WavePayItem]` | Yes | At least one item, as a `list` or `tuple` |
| `amount` | `Amount \| int \| str \| Decimal` | No | Whole kyat, greater than 0 (Wave doesn't accept decimals). Unset charges the sum of the items. Wave only accepts MMK |
| `merchant_reference_id` | `str` | No | Unique ID of this attempt, at most 100 characters: letters, digits, `_` and `-` only. Unset or empty means a random ID |
| `merchant_name` | `str` | No | Business name shown on Wave's page for this payment. Unset uses `WavePayConfig`'s `merchant_name`; a blank one is rejected |
| `time_to_live_seconds` | `int` | No | Seconds the customer has to pay this payment, an `int` greater than 0. Unset uses `WavePayConfig`'s `time_to_live_seconds` (also in the request hash) |
| `additional_field_3`, `additional_field_4`, `additional_field_5` | `str` | No | Extra information, at most 50 characters each, sent as `additional_field_3`–`5` and echoed in the callback's `additionalField3`–`5`. Unset, `None` or empty is not sent |

Length limits count UTF-8 bytes. `WavePayItem(name, amount)` has a `name` and an `amount` in whole kyat, greater than 0. The items are summed with exact `int` arithmetic, never floats; `WavePay.resolved_amount(data)` returns the total that will be charged as an `Amount` (`None` when an item amount is invalid).

### Merchant Reference ID

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. Leave it empty to get a fresh random ID, and **store it**: callbacks always carry `merchantReferenceId`, and earlier Wave documents marked `orderId` optional. `initiate()` writes the generated ID to `data.merchant_reference_id` once `data` passes validation, so keep a reference to the object you pass.

## Handling Callbacks

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError

# POST /payments/wave/callback
@csrf_exempt
def wave_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = wave.handle_callback(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your order_id
        # callback.raw["merchantReferenceId"] is the attempt's reference
        # callback.gateway_reference is Wave's transactionId
        ...

    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

`callback.order_id` falls back to `merchantReferenceId` when Wave's `orderId` is missing, null or empty.

Wave hashes the values joined with no separator, so a matching `hashValue` alone doesn't pin down where one value ends and the next begins. After the hash matches, `amount` must be a decimal (e.g. `10000` or `10000.00`), at least one of `orderId` and `merchantReferenceId` must be present, and each one sent may only hold letters, digits, `_` and `-`; otherwise `handle_callback()` raises `SignatureVerificationError` with `Wave Pay callback is malformed.` (a wrong hash or a nested hashed value gives `Wave Pay callback hash verification failed.`). New payments are held to the same ID rules, so every callback for a payment made with this package passes them.

## Responses

What Wave Pay puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `RedirectPayment` {#initiate-response}

| Field | Wave Pay value |
|---|---|
| `flow` | `PaymentFlow.REDIRECT` |
| `order_id` | Your `data.order_id` |
| `url` | `{base_redirect_url}/authenticate?transaction_id=…` (URL-encoded), e.g. `https://payments.wavemoney.io/authenticate?transaction_id=…` |
| `gateway_reference` | Wave `transaction_id`. Always set |
| `raw` | Wave's `/payment` response: `message` (`success`), `transaction_id` |

The attempt's `merchant_reference_id` is not on the result: read it from `data.merchant_reference_id`.

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | Wave Pay value |
|---|---|
| `order_id` | Wave `orderId`, falling back to `merchantReferenceId` when it is missing, null or empty |
| `status` | `status` mapped, see [Statuses](#statuses) |
| `gateway_status` | Wave `status`, trimmed, e.g. `PAYMENT_CONFIRMED` |
| `gateway_reference` | Wave `transactionId` |
| `amount` | Wave `amount`, e.g. `10000` |
| `raw` | The verified body: `status`, `merchantId`, `orderId`, `merchantReferenceId`, `frontendResultUrl`, `backendResultUrl`, `initiatorMsisdn`, `amount`, `timeToLiveSeconds`, `paymentDescription`, `currency`, `additionalField1`–`5`, `transactionId`, `paymentRequestId`, `requestTime`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `SUCCESSFUL` |
| `BILL_COLLECTION_FAILED`, `INSUFFICIENT_BALANCE`, `ACCOUNT_LOCKED` | `FAILED` |
| `PAYMENT_REQUEST_CANCELLED` | `CANCELED` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `EXPIRED` |
| anything else | `UNKNOWN` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

| Call | Raises | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `WavePay.validate(data)` fails. Nothing is sent and `data` is left untouched. Item errors use `items.0.amount` keys |
| `initiate()` | `ApiError` | Wave answers with an HTTP error, a `message` other than `success`, or no `transaction_id` |
| `handle_callback()` | `SignatureVerificationError` | `hashValue` doesn't match, a hashed field holds an object or a list, `amount` isn't a decimal, both `orderId` and `merchantReferenceId` are empty, or one of them holds anything but letters, digits, `_` and `-` |

`AsyncWavePay` raises the same errors. `http_status` tells Wave's rejections apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gateway_code` is `VALIDATION_ERROR`).
