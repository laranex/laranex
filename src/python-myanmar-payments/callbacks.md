---
title: Callbacks & Status
description: Verify gateway callbacks with handle_callback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handle_callback` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`.

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

See [Framework Integration](/python-myanmar-payments/framework-integration) for each framework and [CallbackRequest](/python-myanmar-payments/references/payment-callback#callbackrequest) for every member, including `CallbackRequest.from_json()` to replay a stored payload.

## Rules

- **Verify, then trust.** A callback that fails verification raises `SignatureVerificationError`, and so does one whose signed or hashed field holds an object or a list instead of a single value, since no gateway signs nested values. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount.equals`. Yoma MMQR callbacks carry no amount, and neither does its [`status()`](/python-myanmar-payments/drivers/yoma-mmqr#status-checks): match the order number to your stored order and trust its stored amount.
- **Signed is not enough on its own.** Where a gateway joins the signed values with a separator (AYA Pay `:`, CyberSource `,` and `=`) or with none (Wave Pay), the package also rejects values that could be re-split into other fields: a correctly signed callback that fails these checks reports `... is malformed.` instead of `... verification failed.`. See each driver's Handling Callbacks section.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.

## Acknowledging

`callback.acknowledgement` is an `Acknowledgement` with `status`, `body` and `headers`, e.g. KBZ Pay's plain `success`; without it, gateways keep retrying. Write it with your framework's response class (see [Framework Integration](/python-myanmar-payments/framework-integration)). `Acknowledgement.default()` is the empty `200 text/plain` response most gateways expect.

## PaymentStatus

Every gateway's status maps onto `PaymentStatus` (see the [reference](/python-myanmar-payments/references/payment-callback#paymentstatus)); the original value stays in `gateway_status`. Only `SUCCESSFUL` means money was collected, and unknown statuses map to `UNKNOWN` instead of raising. Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Pay and CyberSource have no status API.

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
| Wave Pay | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

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
