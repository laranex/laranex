---
title: CyberSource
description: Integrate CyberSource Secure Acceptance Hosted Checkout card payments in Python. Signed hosted checkout form and verified callbacks, one class for sync and async code.
---

# CyberSource

CyberSource Secure Acceptance Hosted Checkout is a hosted page for card payments, in the currencies enabled on your Secure Acceptance profile (all are disabled by default; your merchant account provider lists the supported ones). The package follows CyberSource's [Secure Acceptance Hosted Checkout guide](https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance.html).

| Call | What it does | Returns |
|---|---|---|
| `cs.hosted_checkout(data)` | Signed form posted to the hosted checkout | [`FormPayment`](#hosted-checkout-response) |
| `cs.handle_callback(request)` | Verify the result post | [`PaymentCallback`](#handle-callback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

`CyberSource` makes no network calls, so the one class serves sync and async code and nothing is awaited.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result to your Merchant POST URL (`callback_url`). When a receipt page is set (`return_url`, or the custom receipt page on your Secure Acceptance profile), the customer's browser also posts the result there, so you get two posts, both verified the same way. Without a receipt page there is one post, to the Merchant POST URL.

<SequenceDiagram
  title="CyberSource Hosted Checkout: signed form, card page, result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'cs.hosted_checkout(data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cs.handle_callback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt, when one is set', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cs.handle_callback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Hosted Checkout

```python
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from python_myanmar_payments import (
    CyberSource,
    CyberSourceConfig,
    CyberSourcePaymentData,
    CyberSourceTransactionType,
)

from shop.models import Order

cs = CyberSource(
    CyberSourceConfig(
        profile_id="...",
        access_key="...",
        secret_key="...",
        base_url=CyberSourceConfig.PRODUCTION_URL,
    )
)


def cybersource_checkout(request, order_id: int):
    order = get_object_or_404(Order, pk=order_id)

    data = CyberSourcePaymentData(
        order_id=f"ORDER_{order.id}",
        amount=10000,
        callback_url="https://shop.test/payments/cybersource/callback",
        currency="MMK",
        transaction_type=CyberSourceTransactionType.SALE,
        locale="en-us",
        return_url="https://shop.test/payments/cybersource/receipt",
        cancel_url="https://shop.test/checkout",
    )

    payment = cs.hosted_checkout(data)

    # The page posts the signed form to CyberSource on load.
    return HttpResponse(payment.to_html())
```

### CyberSourcePaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `order_id` | `str` | Yes | At most 40 characters, sent as `reference_number` |
| `amount` | `Amount \| int \| str \| Decimal` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `10000` or `Amount.parse("10.50")` |
| `callback_url` | `str` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters |
| `currency` | `str` | Yes | Three-letter uppercase ISO 4217 code enabled on your Secure Acceptance profile, e.g. `MMK` |
| `transaction_type` | `CyberSourceTransactionType \| str` | Yes | `CyberSourceTransactionType.SALE` (`"sale"`), `.AUTHORIZATION` (`"authorization"`), `.SALE_AND_CREATE_TOKEN` (`"sale,create_payment_token"`) or `.AUTHORIZATION_AND_CREATE_TOKEN` (`"authorization,create_payment_token"`), or its string value |
| `locale` | `str` | Yes | Hosted page language, lowercase `xx-xx`, e.g. `en-us` |
| `return_url` | `str` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters. Left out of the form when unset |
| `cancel_url` | `str` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters. Left out of the form when unset |

CyberSource requires the callback, receipt and cancel URLs to use HTTPS with TLS 1.2 or later on port 443; the package doesn't enforce it.

### Transaction Types

`sale` authorizes the payment and settles it in one step. `authorization` only authorizes it: the funds are held, not collected, until you capture the authorization through CyberSource (the Business Center or its API), which is outside this package. The `create_payment_token` variants also ask CyberSource to create a payment token for the card.

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

    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each field. See [Results](/python-myanmar-payments/references/results) and [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for the full classes. CyberSource posts form fields, so every `raw` value is a `str`, exactly as sent.

### `hosted_checkout()` → `FormPayment` {#hosted-checkout-response}

| Field / Method | CyberSource value |
|---|---|
| `flow` | `PaymentFlow.FORM` |
| `order_id` | Your `data.order_id` |
| `action` | `{base_url}/pay`, e.g. `https://secureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `application/x-www-form-urlencoded` |
| `to_html(nonce=None)` | A full HTML page that posts `fields` to `action` on load; `nonce` is added to its inline script |

| Form field | Value |
|---|---|
| `access_key` | `config.access_key` |
| `profile_id` | `config.profile_id` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The names of the fields sent, except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.locale` |
| `transaction_type` | `data.transaction_type` |
| `reference_number` | `data.order_id` |
| `amount` | `data.amount`, e.g. `10000` |
| `currency` | `data.currency` |
| `override_custom_receipt_page` | `data.return_url`; left out when unset |
| `override_backoffice_post_url` | `data.callback_url` |
| `override_custom_cancel_page` | `data.cancel_url`; left out when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handle_callback()` → `PaymentCallback` {#handle-callback-response}

| Field / Method | CyberSource value |
|---|---|
| `order_id` | CyberSource `req_reference_number` (your `order_id`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gateway_status` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gateway_reference` | CyberSource `transaction_id`. `None` when it is not signed |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`; `None` when both are. Signed values only. On `ACCEPT` it can be less than the order total (partial approval, reason code `110`); on `DECLINE`, `ERROR` and `CANCEL` it is the requested amount (`req_amount`), not a paid amount |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `SUCCESSFUL` |
| `REVIEW` | `PENDING` |
| `DECLINE`, `ERROR` | `FAILED` |
| `CANCEL` | `CANCELED` |

`ACCEPT` includes partial approvals (reason code `110`), where the issuer approved less than the requested amount: compare `amount` with the order total before fulfilling. With an `authorization` transaction type, `ACCEPT` means authorized, not captured, see [Transaction Types](#transaction-types).

`REVIEW` means the authorization needs your review (reason codes `200`, `201`, `230` and `520`), and CyberSource posts nothing again once it is decided: resolve it in the Business Center and update the order yourself.

Any other `decision` raises `SignatureVerificationError` (`CyberSource callback is malformed.`), so a verified callback never has the `UNKNOWN` status.

## Errors

| Call | Raises | When |
|---|---|---|
| `hosted_checkout()` | `InvalidPaymentDataError` | `CyberSource.validate(data)` fails. Nothing is signed |
| `handle_callback()` | `SignatureVerificationError` | `CyberSource callback signature verification failed.`: `signature` is missing, not a string or doesn't match, a field listed in `signed_field_names` is missing or holds an object or a list, or `signed_field_names` doesn't list itself or has an empty, repeated or `=`-containing name. `CyberSource callback is malformed.`: the signature matches but `decision` or `req_reference_number` isn't signed, or `decision` isn't one of the five above |

CyberSource makes no HTTP calls, so nothing raises `ApiError`.
