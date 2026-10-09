---
title: KBZ Pay
description: Integrate KBZ Pay in Python. PWA redirect, QR and in-app payments from one KbzPayPaymentData, plus status checks and verified callbacks, sync or async.
---

# KBZ Pay

KBZ Pay is KBZ Bank's mobile wallet: customers pay in the KBZ Pay PWA, by scanning a QR code, or from your mobile app.

| Call | What it does | Returns |
|---|---|---|
| `kbz.pwa(data)` | Redirect to the KBZ Pay PWA | [`RedirectPayment`](#pwa-response) |
| `kbz.qr(data)` | Customer scans a QR | [`QrPayment`](#qr-response) |
| `kbz.app(data)` | Your mobile app opens the KBZ Pay SDK | [`AppPayment`](#app-response) |
| `kbz.status(order_id)` | Query an order | [`PaymentStatusResult`](#status-response) |
| `kbz.handle_callback(request)` | Verify the notification | [`PaymentCallback`](#handle-callback-response) |

`AsyncKbzPay` has the same methods: await `pwa()`, `qr()`, `app()` and `status()`; `handle_callback()` stays a plain call.

[Responses](#responses) shows what KBZ Pay puts in each result.

## How it works

Every KBZ Pay flow starts with the same precreate call and ends with KBZ's signed notification.

<SequenceDiagram
  title="KBZ Pay: precreate, pay, notify"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Pick the flow', detail: 'kbz.pwa() / qr() / app()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Precreate the order', detail: 'PWAAPP / PAY_BY_QRCODE / APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', detail: 'plus qrCode for QR', response: true },
    { from: 'Your app', to: 'Customer', label: 'PWA URL, QR or signed order', detail: 'url / qr_string / order_info + sign', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Notify callbackUrl', detail: 'signed JSON under Request' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handle_callback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Plain-text success', detail: 'within about 10 s, or KBZ retries', response: true },
    { from: 'Your app', to: 'KBZ Pay', label: 'No notify? Query the order', detail: 'kbz.status(order_id)' },
  ]"
/>

## Initiating a Payment

```python
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from python_myanmar_payments import KbzPay, KbzPayConfig, KbzPayPaymentData

from shop.models import Order

kbz = KbzPay(
    KbzPayConfig(
        app_id="...",
        app_key="...",
        merchant_code="...",
    )
)


def kbz_data(order: Order) -> KbzPayPaymentData:
    return KbzPayPaymentData(
        order_id=f"ORDER_{order.id}",
        amount=10000,
        callback_url="https://shop.test/payments/kbz/callback",
    )


def kbz_pwa(request, order_id: int):
    data = kbz_data(get_object_or_404(Order, pk=order_id))

    # PWA: send the customer to the KBZ Pay PWA
    payment = kbz.pwa(data)
    return redirect(payment.url)


def kbz_qr(request, order_id: int):
    data = kbz_data(get_object_or_404(Order, pk=order_id))

    # QR: encode payment.qr_string into a QR image
    payment = kbz.qr(data)
    return render(request, "kbz_qr.html", {"payment": payment})


def kbz_app(request, order_id: int):
    data = kbz_data(get_object_or_404(Order, pk=order_id))

    # In-app: hand the signed values to your mobile app
    payment = kbz.app(data)
    return JsonResponse(payment.to_dict())
```

### KbzPayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | Unique per order. Letters, digits and `_` only, at most 40 characters |
| `amount` | `Amount \| int \| str \| Decimal` | Yes | Kyat, greater than 0, at most 2 decimal places, e.g. `10000` or `Amount.parse("1000.50")`. KBZ only accepts MMK |
| `callback_url` | `str` | Yes | Public URL KBZ posts the result to. Absolute http or https URL, at most 512 characters, no query string |
| `title` | `str` | No | Product name shown to the customer |
| `timeout_minutes` | `int` | No | An integer from 1 to 120. Unset leaves it to KBZ (120) |
| `callback_info` | `str` | No | Free text echoed back in the callback, at most 512 characters once URL-encoded |

### PWA Notes

- The PWA only opens on a phone with the KBZ Pay app installed.
- KBZ checks the redirect's `Referer` against the URL registered with them (error `AOP08512`). Redirect from that domain and don't strip the referrer.
- After payment, KBZ sends the customer to the return URL registered with them during onboarding; it cannot be set per payment.

## Handling Callbacks

KBZ Pay posts JSON nested under a `Request` key; build the `CallbackRequest` from the whole request.

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError


# POST /payments/kbz/callback
@csrf_exempt
def kbz_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = kbz.handle_callback(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your merch_order_id
        # callback.gateway_reference is KBZ's mm_order_id
        ...

    ack = callback.acknowledgement()  # plain-text "success"
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

KBZ requires an HTTP 200 with the plain-text body `success`, answered within about 10 seconds. Otherwise it retries after 60 and 600 seconds; when no callback arrives, [query the order](#status-checks).

## Status Checks

```python
result = kbz.status(f"ORDER_{order.id}")

if result.is_successful():
    # result.gateway_reference is KBZ's mm_order_id
    ...
```

`status()` takes your `order_id`. An order KBZ doesn't know raises `ApiError`.

## Responses

What KBZ Pay puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `None`. `raw` holds plain Python values (JSON integers become `int` and other numbers an exact `Decimal`, never a `float`), while the typed fields such as `amount` keep the exact text KBZ sent.

### `pwa()` → `RedirectPayment` {#pwa-response}

| Field | KBZ Pay value |
|---|---|
| `flow` | `PaymentFlow.REDIRECT` |
| `order_id` | Your `data.order_id` |
| `url` | `{pwa_url}?appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…&sign=…` |
| `gateway_reference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response: `result`, `code`, `msg`, `merch_order_id`, `prepay_id`, `nonce_str`, `sign_type`, `sign` |

### `qr()` → `QrPayment` {#qr-response}

| Field / Method | KBZ Pay value |
|---|---|
| `flow` | `PaymentFlow.QR` |
| `order_id` | Your `data.order_id` |
| `qr_string` | KBZ `qrCode`, a payload to encode into a QR image. Always set |
| `qr_image` | Always `None` |
| `expires_at` | Now + `timeout_minutes`, in UTC. `None` when `timeout_minutes` is unset (KBZ then allows 120 minutes) |
| `reference` | KBZ `prepay_id`. Always set |
| `raw` | The `precreate` response, as for `pwa()` plus `qrCode` |
| `qr_image_data_uri()` | Always `None`, as `qr_image` is |

### `app()` → `AppPayment` {#app-response}

| Field / Method | KBZ Pay value |
|---|---|
| `flow` | `PaymentFlow.APP` |
| `order_id` | Your `data.order_id` |
| `order_info` | `appid=…&merch_code=…&nonce_str=…&prepay_id=…&timestamp=…` |
| `sign` | SHA-256 signature of `order_info`, uppercase hex. See [Signing](#signing) |
| `sign_type` | `SHA256` |
| `raw` | The `precreate` response, as for `pwa()` |
| `to_dict()` | `orderId`, `orderInfo`, `sign` and `signType`, without `raw` |

### `status()` → `PaymentStatusResult` {#status-response}

| Field | KBZ Pay value |
|---|---|
| `order_id` | KBZ `merch_order_id`, falling back to the `order_id` you passed. Always set |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gateway_status` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gateway_reference` | KBZ `mm_order_id`. `None` until KBZ has created the payment |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The `queryorder` response: `result`, `code`, `msg`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `nonce_str`, `sign_type`, `sign` |

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | KBZ Pay value |
|---|---|
| `order_id` | KBZ `merch_order_id` (your `order_id`) |
| `status` | `trade_status` mapped, see [Statuses](#statuses) |
| `gateway_status` | KBZ `trade_status`, trimmed, e.g. `PAY_SUCCESS` |
| `gateway_reference` | KBZ `mm_order_id` |
| `amount` | KBZ `total_amount`, e.g. `10000` |
| `raw` | The verified `Request`: `appid`, `notify_time`, `merch_code`, `merch_order_id`, `mm_order_id`, `total_amount`, `trans_currency`, `trade_status`, `trans_end_time`, `callback_info`, `nonce_str`, `sign_type`, `sign` |
| `acknowledgement()` | HTTP `200`, body `success`, `Content-Type: text/plain` |

## Statuses

| KBZ `trade_status` | `PaymentStatus` |
|---|---|
| `PAY_SUCCESS` | `SUCCESSFUL` |
| `WAIT_PAY`, `PAYING` | `PENDING` |
| `PAY_FAILED` | `FAILED` |
| `ORDER_CLOSED` | `CANCELED` |
| `ORDER_EXPIRED` | `EXPIRED` |
| anything else | `UNKNOWN` |

## Signing

KBZ signs requests, the in-app `order_info` and notifications the same way: every non-empty field except `sign` and `sign_type`, sorted by key, joined as raw `key=value` pairs, with `&key=<app key>` appended, hashed with SHA-256 and uppercased. The package signs every request and verifies every notification for you; `kbz.signer` (a `KbzPaySigner`, also exported from `python_myanmar_payments`) exposes the same signature for custom calls: `sign_string(fields)`, `sign(fields)` and `verify(fields)`.

## Errors

| Call | Raises | When |
|---|---|---|
| `pwa()`, `qr()`, `app()` | `InvalidPaymentDataError` | `KbzPay.validate(data)` fails. Nothing is sent |
| `pwa()`, `qr()`, `app()` | `ApiError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, or without a `prepay_id` |
| `qr()` | `ApiError` | KBZ returns no `qrCode` |
| `status()` | `ApiError` | KBZ answers with an HTTP error, `result` other than `SUCCESS` or `code` other than `0`, e.g. for an unknown order |
| `handle_callback()` | `SignatureVerificationError` | `sign` doesn't match |

`AsyncKbzPay` raises the same errors. `ApiError` carries KBZ's `code` (e.g. `ORDER_ID_USED`, `AOP08508`) in `gateway_code` and its `msg` in `gateway_message`. When KBZ can't be reached or the request times out, the calls raise `ApiError` with the original `httpx` error as `__cause__`.
