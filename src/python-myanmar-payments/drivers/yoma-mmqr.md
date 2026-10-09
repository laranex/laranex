---
title: Yoma MMQR
description: Integrate Yoma Bank MMQR in Python. Ready-made QR images, QR renewal, status checks and verified callbacks, sync or async.
---

# Yoma MMQR

Yoma MMQR is Yoma Bank's MMQR gateway: it issues ready-made QR images that customers scan with any MMQR wallet.

| Call | What it does | Returns |
|---|---|---|
| `yoma.initiate(data)` | Check out the order and generate its first QR | [`QrPayment`](#initiate-response) |
| `yoma.renew_qr(order_id)` | Generate a new QR for a checked-out order | [`QrPayment`](#renew-qr-response) |
| `yoma.status(reference)` | Check a QR's payment status | [`PaymentStatusResult`](#status-response) |
| `yoma.handle_callback(request)` | Verify the callback | [`PaymentCallback`](#handle-callback-response) |

`AsyncYomaMmqr` has the same methods: await `initiate()`, `renew_qr()`, `status()` and `forget_token()`; `handle_callback()` stays a plain call.

[Responses](#responses) shows what Yoma MMQR puts in each result.

## How it works

Yoma checks each order out once, then issues QR codes that each stay payable for 120 seconds.

<SequenceDiagram
  title="Yoma MMQR: token, checkout, QR, renewal, result"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Your app', to: 'Yoma MMQR', label: 'Get a token unless cached', detail: 'POST /token, then cached' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yoma.initiate(data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the QR', detail: 'qr/generate: QR + refLabel' },
    { from: 'Your app', to: 'Customer', label: 'Show the QR for 120 s', detail: 'payment.qr_image_data_uri()', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yoma.renew_qr(order_id)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.handle_callback(request)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'No callback? Check status', detail: 'yoma.status(reference)' },
  ]"
/>

## Initiating a Payment

```python
from django.shortcuts import get_object_or_404, render
from python_myanmar_payments import (
    YomaMmqr,
    YomaMmqrConfig,
    YomaMmqrPaymentData,
)

from shop.models import Order

# Create it once at startup: the in-memory token cache lives on the instance.
yoma = YomaMmqr(
    YomaMmqrConfig(
        merchant_id="...",
        client_id="...",
        client_secret="...",
        webhook_hash_key="...",
    )
)


def yoma_checkout(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id)

    data = YomaMmqrPaymentData(
        order_id=f"ORDER_{order.id}",
        amount=10000,
        description=f"Order #{order.id}",
    )

    payment = yoma.initiate(data)

    # Store payment.reference with the order for status checks.

    return render(request, "yoma_qr.html", {"payment": payment})
```

```html
<img src="{{ payment.qr_image_data_uri }}" alt="Scan with any MMQR wallet">
```

### YomaMmqrPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | Unique order number, at most 20 characters |
| `amount` | `Amount \| int \| str \| Decimal` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. Yoma documents no decimals or currency |
| `description` | `str` | Yes | At most 50 characters |

### QR Image

`qr_image` is an already rendered base64 PNG of the payment slip: display it as is, no QR library needed.

## Handling Callbacks

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError


# POST /payments/yoma/callback
@csrf_exempt
def yoma_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = yoma.handle_callback(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your orderNumber
        ...

    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

The callback URL is registered with Yoma, not sent per order. When `webhook_secret` is configured, callbacks must carry it in the `X-Webhook-Secret` header. The hash is checked with HMAC-SHA256 keyed with your order number plus `webhook_hash_key`.

## QR Lifetime and Renewal

A QR is payable for 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`); `payment.expires_at` tells you when. Yoma accepts each order number **once**, so never call `initiate()` again for the same order. Renew the QR instead:

```python
payment = yoma.renew_qr(f"ORDER_{order.id}")

# Store the new payment.reference: the previous one stops working.
```

Each renewal retires the previous `reference`; only the newest one answers status checks.

## Status Checks

```python
# reference is the payment.reference you stored
result = yoma.status(reference)

if result.is_successful():
    ...  # the QR was paid
```

`status()` takes the QR's `reference`, not your `order_id`. An expired QR returns `EXPIRED` instead of raising.

## Responses

What Yoma MMQR puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `None`. `raw` holds plain Python values; every JSON number is kept as its exact text in a `str` (`1000.50` stays `"1000.50"`), never a `float`.

### `initiate()` → `QrPayment` {#initiate-response}

| Field / Method | Yoma MMQR value |
|---|---|
| `flow` | `PaymentFlow.QR` |
| `order_id` | Your `data.order_id` (Yoma `orderNumber`) |
| `qr_string` | Always `None` |
| `qr_image` | Yoma `qrString`, a base64 PNG of the payment slip. Always set |
| `expires_at` | Now + 120 seconds (`YomaMmqr.QR_LIFETIME_SECONDS`), in UTC. Always set |
| `reference` | Yoma `refLabel`, e.g. `100000083331`. Pass it to `status()`. Always set |
| `raw` | The `qr/generate` response: `refLabel`, `qrString`, `errorCode` (`None`), `errorDescription` |
| `qr_image_data_uri()` | `data:image/png;base64,…` |

`initiate()` checks the order out (`payment/checkout`), then generates its first QR; the result comes from the generate call.

### `renew_qr()` → `QrPayment` {#renew-qr-response}

The same values as [`initiate()`](#initiate-response) for the `order_id` you passed, with a new `qr_image`, `reference` and `expires_at`. The previous `reference` stops answering status checks.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | Yoma MMQR value |
|---|---|
| `order_id` | Always `None`: Yoma only returns the reference |
| `status` | `paymentStatus` mapped case-insensitively, see [Statuses](#statuses). `EXPIRED` for a `QR EXPIRED` error |
| `gateway_status` | Yoma `paymentStatus`, trimmed, e.g. `SUCCESS`. `QR EXPIRED` for an expired QR |
| `gateway_reference` | Yoma `refLabel`, falling back to the reference you passed. Always set |
| `amount` | Always `None`: Yoma's status response has no amount |
| `raw` | The `payment/check-status` response: `refLabel`, `paymentStatus`, `errorCode`, `errorDescription` |

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | Yoma MMQR value |
|---|---|
| `order_id` | Yoma `orderNumber` (your `order_id`) |
| `status` | `status` mapped case-insensitively, see [Statuses](#statuses) |
| `gateway_status` | Yoma `status`, trimmed, as sent, e.g. `success` |
| `gateway_reference` | Always `None`: Yoma's callback has no reference |
| `amount` | Always `None`: Yoma's callback has no amount |
| `raw` | The verified body: `orderNumber`, `status`, `hashValue` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| Yoma value | `PaymentStatus` |
|---|---|
| `success` (callback), `SUCCESS` (status) | `SUCCESSFUL` |
| `PENDING` | `PENDING` |
| `fail` (callback), `FAILED` (status) | `FAILED` |
| `QR EXPIRED` error | `EXPIRED` |
| anything else | `UNKNOWN` |

## Access Tokens

Yoma authenticates with an OAuth token that lasts hours. The gateway keeps it in the [token cache](/python-myanmar-payments/configuration#token-cache) (passed as `token_cache=`), shares one token request between concurrent calls (a thread lock on `YomaMmqr`, an `asyncio.Lock` on `AsyncYomaMmqr`), and fetches a new token, retrying once, when Yoma answers `401`. `yoma.forget_token()` (awaited on `AsyncYomaMmqr`) drops the cached token, e.g. after rotating the client secret.

The token is cached under `myanmar-payments.yoma-mmqr.token.<sha256(base_url|client_id)>`, the same key every Laranex SDK uses, so services in different languages can share one cache, for Yoma's `expires_in` minus 60 seconds (at least 60 seconds). `expires_in` is read from its leading digits, so `28800.0` is 28800 seconds; a missing or non-positive value means 3600.

## Errors

| Call | Raises | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `YomaMmqr.validate(data)` fails. Nothing is sent |
| `initiate()` | `ApiError` | The token request fails, Yoma answers with an HTTP error or an `errorCode` (e.g. `PAYMENT ALREADY EXISTS`), `checkOutStatus` isn't `true`, or there is no `qrString` or `refLabel` |
| `renew_qr()` | `ApiError` | As `initiate()`, without the checkout |
| `status()` | `ApiError` | The token request fails, or Yoma answers with an HTTP error or any `errorCode` other than `QR EXPIRED` |
| `handle_callback()` | `SignatureVerificationError` | `X-Webhook-Secret` is missing or wrong (when `webhook_secret` is set), `orderNumber` is missing, `status` holds an object or a list, or `hashValue` doesn't match |

`AsyncYomaMmqr` raises the same errors. Yoma reports business errors with HTTP 200 and an `errorCode`; `ApiError` carries it in `gateway_code` and Yoma's `errorDescription` in `gateway_message`. When Yoma can't be reached or the request times out, the calls raise `ApiError` with the original `httpx` error as `__cause__`.
