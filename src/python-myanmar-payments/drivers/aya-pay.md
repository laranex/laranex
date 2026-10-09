---
title: AYA Pay
description: Integrate the AYA Payment Gateway in Python. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks, sync or async.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Call | What it does | Returns |
|---|---|---|
| `aya.services()` | List the channels enabled for your account | [`list[AyaPayService]`](#services-response) |
| `aya.initiate(data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `aya.status(order_id)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `aya.handle_callback(request)` | Verify the backend callback | [`PaymentCallback`](#handle-callback-response) |
| `aya.verify_redirect(request)` | Verify the customer's return | [`PaymentCallback`](#verify-redirect-response) |

`AsyncAyaPay` has the same methods: await `services()` and `status()`; `initiate()`, `handle_callback()` and `verify_redirect()` stay plain calls.

[Responses](#responses) shows what AYA Pay puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'aya.services()' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + AyaPayMethod.QR' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'aya.initiate(data)', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the form and pay', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.handle_callback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: 'aya.verify_redirect(request)' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```python
from python_myanmar_payments import AyaPay, AyaPayConfig, AyaPayMethod

aya = AyaPay(
    AyaPayConfig(
        app_key="...",
        app_secret="...",
    )
)

for service in aya.services():
    # service.name: "AYA Pay"
    # service.key: "aya_pay", pass it as channel
    # service.image_url: the channel's logo
    # service.methods: (AyaPayMethod.QR, AyaPayMethod.NOTI)
    if service.supports(AyaPayMethod.QR):
        ...  # offer the QR method
```

Methods AYA lists that this package doesn't know yet are kept in `service.unknown_methods`.

| `AyaPayMethod` | Value | Customer |
|---|---|---|
| `AyaPayMethod.WEB` | `WEB` | Pays on a hosted web page (cards) |
| `AyaPayMethod.QR` | `QR` | Scans a QR with the wallet app |
| `AyaPayMethod.NOTI` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```python
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from python_myanmar_payments import AyaPayMethod, AyaPayPaymentData

from shop.models import Order


def aya_checkout(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id)

    data = AyaPayPaymentData(
        order_id=f"ORDER_{order.id}",
        amount=10000,
        channel="aya_pay",
        method=AyaPayMethod.QR,
        return_url="https://shop.test/payments/aya/return",
        description=f"Order #{order.id}",
    )

    payment = aya.initiate(data)

    # The page posts the signed form to AYA on load.
    return HttpResponse(payment.to_html())
```

### AyaPayPaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `Amount \| int \| str \| Decimal` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount.kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `channel` | `str` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | `AyaPayMethod.WEB`, `.QR` or `.NOTI` (or the strings `"WEB"`, `"QR"`, `"NOTI"`) |
| `return_url` | `str` | No | Absolute http or https URL. Unset uses the URL registered with AYA |
| `description` | `str` | No | Shown to the customer |
| `user_refs` | `Sequence[str]` | No | Up to 5 of your own values, as a `list` or `tuple`, echoed back in the callback |

### Form Encoding

AYA expects the form as `multipart/form-data`. `payment.enctype` carries it; use it if you [render the form yourself](/python-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

AYA posts to the callback URL registered with them.

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError


# POST /payments/aya/callback
@csrf_exempt
def aya_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = aya.handle_callback(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your merchOrderId
        # callback.gateway_reference is AYA's tranId
        ...

    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```python
from django.http import HttpResponse
from python_myanmar_payments import CallbackRequest, SignatureVerificationError


# GET /payments/aya/return
def aya_return(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        result = aya.verify_redirect(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid return", status=400)

    if result.is_successful():
        return HttpResponse("Thank you, your payment was received.")
    return HttpResponse(f"Payment {result.status}.")
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. The `payload` may carry its `=` padding or leave it out; partial padding, the URL-safe alphabet, line breaks and text that isn't UTF-8 are rejected. Still fulfill orders from the backend callback.

## Status Checks

```python
result = aya.status(f"ORDER_{order.id}")

if result.is_successful():
    # result.gateway_reference is AYA's tranId
    ...
```

`status()` takes your `order_id`. An order AYA doesn't know raises `ApiError` (`20` Transaction not found).

## Responses

What AYA Pay puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `None`. `raw` holds plain Python values; every JSON number is kept as its exact text in a `str` (`1000.50` stays `"1000.50"`), never a `float`.

### `services()` → `list[AyaPayService]` {#services-response}

`AyaPayService` is AYA-only, so it is listed in full here. It is a frozen dataclass.

| Field / Method | AYA Pay value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `channel`. Always set |
| `image_url` | AYA `image_url`, the channel's logo. `None` when AYA sends none |
| `methods` | A `tuple[AyaPayMethod, ...]` of the methods this package knows, e.g. `(AyaPayMethod.QR, AyaPayMethod.NOTI)` |
| `unknown_methods` | A `tuple[str, ...]` of methods AYA listed that this package doesn't know yet. Usually `()` |
| `supports(method)` | Whether `methods` contains `method` (an `AyaPayMethod` or its string) |

Entries AYA sends without a `key` are skipped.

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | AYA Pay value |
|---|---|
| `flow` | `PaymentFlow.FORM` |
| `order_id` | Your `data.order_id` |
| `action` | `{base_url}/v1/payment/request`, e.g. `https://uat-pgw.ayainnovation.com/v1/payment/request` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `to_html()` | A full HTML page that posts `fields` to `action` on load |

| Form field | Value |
|---|---|
| `merchOrderId` | `data.order_id` |
| `amount` | `data.amount`, e.g. `10000` |
| `appKey` | `config.app_key` |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | `data.user_refs`, `""` when unused |
| `description` | `data.description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | `data.channel`, e.g. `aya_pay` |
| `method` | `data.method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | `data.return_url`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`initiate()` makes no HTTP call, so it is never awaited, on `AsyncAyaPay` too. `FormPayment` has no `raw`: nothing is sent to AYA until the customer's browser posts the form.

### `status()` → `PaymentStatusResult` {#status-response}

| Field | AYA Pay value |
|---|---|
| `order_id` | AYA `merchOrderId`, falling back to the `order_id` you passed. Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gateway_status` | AYA `statusCode`, trimmed, e.g. `00` |
| `gateway_reference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | AYA Pay value |
|---|---|
| `order_id` | AYA `merchOrderId` (your `order_id`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gateway_status` | AYA `statusCode`, trimmed, e.g. `00` |
| `gateway_reference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded payload, with the same keys as `status()` |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

### `verify_redirect()` → `PaymentCallback` {#verify-redirect-response}

The same values as [`handle_callback()`](#handle-callback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). There is nothing to acknowledge: render your own page.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `SUCCESSFUL` |
| `01` | `PENDING` |
| `02` (fail), `03` (reject) | `FAILED` |
| `04` | `EXPIRED` |
| anything else | `UNKNOWN` |

## Errors

| Call | Raises | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `AyaPay.validate(data)` fails. Nothing is signed |
| `services()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00` |
| `status()` | `ApiError` | AYA answers with an HTTP error or a `status` other than `00`, e.g. `20` Transaction not found |
| `status()` | `SignatureVerificationError` | The enquiry payload's `checkSum` doesn't match |
| `handle_callback()`, `verify_redirect()` | `SignatureVerificationError` | `payload` is missing or not base64 JSON, a signed field holds an object or a list, or `checkSum` doesn't match |

`AsyncAyaPay` raises the same errors. `ApiError` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `gateway_code` and its `message` in `gateway_message`. When AYA can't be reached or the request times out, the calls raise `ApiError` with the original `httpx` error as `__cause__`.
