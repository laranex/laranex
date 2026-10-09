---
title: Callbacks & Status
description: Verify gateway callbacks with handle_callback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handle_callback` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`. It is never awaited, on the async classes too: verifying needs no network call.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/python-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callback_url' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'kbz.handle_callback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationError', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by callback.order_id' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: 'callback.acknowledgement', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```python
import logging

from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from python_myanmar_payments import (
    Amount,
    CallbackRequest,
    SignatureVerificationError,
)

from shop.models import Order

logger = logging.getLogger(__name__)


@csrf_exempt
def kbz_callback(request):
    callback_request = CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )
    try:
        callback = kbz.handle_callback(callback_request)
    except SignatureVerificationError as error:
        logger.warning("rejected KBZ callback: %s", error)
        return HttpResponse("invalid callback", status=400)

    with transaction.atomic():
        order = Order.objects.select_for_update().get(number=callback.order_id)
        paid = Amount.of(order.amount).equals(callback.amount)
        if callback.is_successful() and order.paid_at is None and paid:
            order.mark_paid(callback.gateway_reference)

    # KBZ Pay: HTTP 200 with plain-text "success"
    ack = callback.acknowledgement
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)
```

## Building a CallbackRequest

Signatures are checked against what the gateway actually sent, so build the request from the real incoming request: the raw body bytes, the headers and the query string. Never rebuild it from parsed input such as Django's `request.POST`, Flask's `request.json` or a FastAPI model: a JSON number such as `1000.50` would come back as `1000.5` and break a signature over the exact text.

| Constructor | Use when |
|---|---|
| `CallbackRequest(body=..., headers=..., query=...)` | Every framework: pass the raw body (`bytes` or `str`), the headers (any mapping or `(name, value)` pairs) and the query string (`str`, `bytes`, a mapping, Django's `QueryDict`, Werkzeug's `MultiDict` or Starlette's `QueryParams`). All three are optional |
| `CallbackRequest.from_json(payload, headers=None)` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table. `Decimal` values are written as strings |

| Framework | `body` | `headers` | `query` |
|---|---|---|---|
| Django | `request.body` | `request.headers` | `request.META.get("QUERY_STRING", "")` |
| Flask | `request.get_data()` | `request.headers` | `request.query_string` |
| FastAPI, Starlette | `await request.body()` | `request.headers` | `request.url.query` |

| Member | Description |
|---|---|
| `raw_body` | The raw body as `bytes`, exactly as received |
| `body` | The raw body, decoded as UTF-8 |
| `headers` | Headers with lowercase names; repeated headers are joined with `, ` |
| `query` | Query string values (the first of each) |
| `header(name)` | One header, case-insensitively, or `None` |
| `parsed_body()` | The body decoded as JSON or a urlencoded form; JSON numbers keep their exact text as `str` (`1000.50` stays `"1000.50"`) |
| `input()` | The parsed body merged over the query string |
| `query_input()` | The query string merged over the parsed body |

## Rules

- **Verify, then trust.** A callback that fails verification raises `SignatureVerificationError`, and so does one whose signed or hashed field holds an object or a list instead of a single value, since no gateway signs nested values. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount.equals`.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `callback.acknowledgement` holds the response the gateway expects (`status`, `body`, `headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`callback.acknowledgement` is an `Acknowledgement` with `status`, `body` and `headers`. Write them with your framework's response class:

| Framework | Response |
|---|---|
| Django | `HttpResponse(ack.body, status=ack.status, headers=ack.headers)` |
| Flask | `Response(ack.body, status=ack.status, headers=dict(ack.headers))` |
| FastAPI, Starlette | `Response(ack.body, status_code=ack.status, headers=dict(ack.headers))` |

`Acknowledgement.default()` is the empty `200 text/plain` response most gateways expect.

Gateway callbacks are server-to-server posts: exclude these routes from CSRF protection (Django's `@csrf_exempt`, Flask-WTF's `csrf.exempt`).

## PaymentStatus

Every gateway's own status values are mapped onto one `str` enum. The original value stays in `callback.gateway_status`.

| Member | Value | Meaning |
|---|---|---|
| `PaymentStatus.SUCCESSFUL` | `successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus.PENDING` | `pending` | Still in progress or waiting on the customer. |
| `PaymentStatus.FAILED` | `failed` | Attempted and failed or rejected. |
| `PaymentStatus.CANCELED` | `canceled` | Canceled or closed before completing. |
| `PaymentStatus.EXPIRED` | `expired` | The payment window ran out. |
| `PaymentStatus.UNKNOWN` | `unknown` | A status this package does not recognize yet. Inspect `gateway_status`. |

Members are strings, so `callback.status == "successful"` works and `str(callback.status)` is the value. `status.is_final()` is `False` for `PENDING` and `UNKNOWN`. Unknown statuses never raise.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: 'kbz.status(order_id)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: 'result.status.is_final()' },
  ]"
/>

Status checks return a `PaymentStatusResult` with the same `status`, `gateway_status`, `gateway_reference` and `amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `kbz.status(order_id)` |
| AYA Payment Gateway | `aya.status(order_id)` |
| Yoma MMQR | `yoma.status(payment.reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

On the async classes, `await` the same calls.

```python
import logging

from python_myanmar_payments import ApiError

logger = logging.getLogger(__name__)

try:
    result = kbz.status("ORDER_1")
except ApiError as error:
    logger.error("KBZ %s: %s", error.gateway_code, error.gateway_message)
    raise

if result.is_successful():
    ...
```

See [PaymentCallback & Status](/python-myanmar-payments/references/payment-callback) for every field.
