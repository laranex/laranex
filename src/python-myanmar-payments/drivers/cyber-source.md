---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Python. Signed hosted checkout form and verified callbacks, one class for sync and async code.
---

# CyberSource

CyberSource Secure Acceptance is a hosted checkout for card payments, in MMK or any other currency.

| Call | What it does | Returns |
|---|---|---|
| `cs.initiate(data)` | Signed form posted to the hosted checkout | [`FormPayment`](#initiate-response) |
| `cs.handle_callback(request)` | Verify the result post | [`PaymentCallback`](#handle-callback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

`CyberSource` makes no network calls, so the one class serves sync and async code and nothing is awaited.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'cs.initiate(data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cs.handle_callback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cs.handle_callback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```python
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from python_myanmar_payments import (
    CyberSource,
    CyberSourceConfig,
    CyberSourcePaymentData,
)

from shop.models import Order

cs = CyberSource(
    CyberSourceConfig(
        profile_id="...",
        access_key="...",
        secret_key="...",
    )
)


def cybersource_checkout(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id)

    data = CyberSourcePaymentData(
        order_id=f"ORDER_{order.id}",
        amount=10000,
        callback_url="https://shop.test/payments/cybersource/callback",
        return_url="https://shop.test/payments/cybersource/receipt",
        cancel_url="https://shop.test/checkout",
    )

    payment = cs.initiate(data)

    # The page posts the signed form to CyberSource on load.
    return HttpResponse(payment.to_html())
```

### CyberSourcePaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `Amount \| int \| str \| Decimal` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `10000` or `Amount.parse("10.50")` |
| `callback_url` | `str` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `return_url` | `str` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `cancel_url` | `str` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `currency` | `str` | No | Any three-letter uppercase ISO 4217 code. Unset means `MMK` |
| `transaction_type` | `CyberSourceTransactionType` | No | `CyberSourceTransactionType.SALE` (`"sale"`, the default), `.AUTHORIZATION` (`"authorization"`), `.SALE_AND_CREATE_TOKEN` (`"sale,create_payment_token"`) or `.AUTHORIZATION_AND_CREATE_TOKEN` (`"authorization,create_payment_token"`) |
| `locale` | `str` | No | Hosted page language as a CyberSource locale code such as `en-us`. Unset means `en-us` |

### Amounts and Currencies

CyberSource is multi-currency and accepts decimals. For another currency, pass an [`Amount`](/python-myanmar-payments/amounts) with the currency: `amount=Amount.parse("10.50"), currency="USD"`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. `payment.enctype` carries it; use it if you [render the form yourself](/python-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

CyberSource posts a form to `callback_url`. The same check works for the browser post to your receipt page.

```python
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import CallbackRequest, SignatureVerificationError


# POST /payments/cybersource/callback
@csrf_exempt
def cybersource_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = cs.handle_callback(callback_request)
    except SignatureVerificationError:
        return HttpResponse("invalid callback", status=400)

    if callback.is_successful():
        # callback.order_id is your req_reference_number
        # callback.gateway_reference is CyberSource's transaction_id
        ...

    ack = callback.acknowledgement()
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `None`. CyberSource posts form fields, so every `raw` value is a `str`, exactly as sent.

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `flow` | `PaymentFlow.FORM` |
| `order_id` | Your `data.order_id` |
| `action` | `{base_url}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `application/x-www-form-urlencoded` |
| `to_html()` | A full HTML page that posts `fields` to `action` on load |

| Form field | Value |
|---|---|
| `access_key` | `config.access_key` |
| `profile_id` | `config.profile_id` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The field names in this table except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.locale`, `en-us` when unset |
| `transaction_type` | `data.transaction_type`, `sale` when unset |
| `reference_number` | `data.order_id` |
| `amount` | `data.amount`, e.g. `10000` |
| `currency` | `data.currency`, `MMK` when unset |
| `override_custom_receipt_page` | `data.return_url`, `""` when unset |
| `override_backoffice_post_url` | `data.callback_url` |
| `override_custom_cancel_page` | `data.cancel_url`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`initiate()` makes no HTTP call, so it is never awaited, and `CyberSource` takes no HTTP options. `FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | CyberSource value |
|---|---|
| `order_id` | CyberSource `req_reference_number` (your `order_id`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gateway_status` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gateway_reference` | CyberSource `transaction_id`. `None` when it is not signed |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `SUCCESSFUL` |
| `REVIEW` | `PENDING` |
| `DECLINE`, `ERROR` | `FAILED` |
| `CANCEL` | `CANCELED` |
| anything else | `UNKNOWN` |

## Errors

| Call | Raises | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `CyberSource.validate(data)` fails. Nothing is signed |
| `handle_callback()` | `SignatureVerificationError` | `signature` doesn't match, a field listed in `signed_field_names` is missing, or `decision` or `req_reference_number` isn't signed |

CyberSource makes no HTTP calls, so nothing raises `ApiError`.
