---
title: Framework Integration
description: Use Python Myanmar Payments with Django, Flask and FastAPI, sync and async. Create gateways once, build the CallbackRequest from the raw body, and return the acknowledgement.
---

# Framework Integration

The package needs only two things from your framework: the raw incoming request for callbacks and a response class to write the acknowledgement. Create each gateway once at startup (or one `MyanmarPayments`) and share it across requests, so the HTTP connections and Yoma's token cache stay warm.

| Framework | Build the request | Acknowledge |
|---|---|---|
| Django | `CallbackRequest(body=request.body, headers=request.headers, query=request.META.get("QUERY_STRING", ""))` | `HttpResponse(ack.body, status=ack.status, headers=ack.headers)` |
| Flask | `CallbackRequest(body=request.get_data(), headers=request.headers, query=request.query_string)` | `Response(ack.body, status=ack.status, headers=dict(ack.headers))` |
| FastAPI, Starlette | `CallbackRequest(body=await request.body(), headers=request.headers, query=request.url.query)` | `Response(ack.body, status_code=ack.status, headers=dict(ack.headers))` |

Use the sync classes (`MyanmarPayments`, `KbzPay`, …) in sync views and the async classes (`AsyncMyanmarPayments`, `AsyncKbzPay`, …) in `async def` views, so a gateway call never blocks the event loop.

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your framework applies.

## Django

Create the facade once, e.g. in `shop/payments.py`, and import it in your views:

```python
# shop/payments.py
from python_myanmar_payments import MyanmarPayments

payments = MyanmarPayments.from_env()
```

```python
# shop/views.py
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from python_myanmar_payments import (
    Amount,
    ApiError,
    AyaPayMethod,
    AyaPayPaymentData,
    CallbackRequest,
    InvalidPaymentDataError,
    SignatureVerificationError,
)

from shop.payments import payments


def callback_request(request) -> CallbackRequest:
    return CallbackRequest(
        body=request.body,
        headers=request.headers,
        query=request.META.get("QUERY_STRING", ""),
    )


@require_GET
def checkout(request, order_id: int):
    data = AyaPayPaymentData(
        order_id=f"ORDER_{order_id}",
        amount=Amount.kyat(8000),
        channel="aya_pay",
        method=AyaPayMethod.QR,
        return_url="https://shop.test/payments/aya/return",
    )
    try:
        payment = payments.aya_pay().initiate(data)
    except InvalidPaymentDataError as error:
        return JsonResponse({"errors": dict(error.errors)}, status=422)
    return HttpResponse(payment.to_html())


@csrf_exempt
@require_POST
def kbz_callback(request):
    try:
        callback = payments.kbz_pay().handle_callback(callback_request(request))
    except SignatureVerificationError:
        return HttpResponse("invalid signature", status=400)
    # fulfill callback.order_id when callback.is_successful()
    # and the amount matches
    ack = callback.acknowledgement()
    return HttpResponse(ack.body, status=ack.status, headers=ack.headers)


@require_GET
def aya_return(request):
    try:
        result = payments.aya_pay().verify_redirect(callback_request(request))
    except SignatureVerificationError:
        return HttpResponse("invalid return", status=400)
    if result.is_successful():
        return HttpResponse("Thank you, your payment was received.")
    return HttpResponse(f"Payment {result.status}.")


@require_GET
def kbz_status(request, order_id: int):
    try:
        result = payments.kbz_pay().status(f"ORDER_{order_id}")
    except ApiError as error:
        return JsonResponse(
            {"code": error.gateway_code, "message": error.gateway_message},
            status=502,
        )
    return JsonResponse({"status": result.status})
```

Read `request.body` before anything touches `request.POST` (once Django parsed a multipart body, the raw bytes are gone), and never rebuild the request from `request.POST` or `json.loads()`.

### Async Views

In `async def` views under ASGI, use `AsyncMyanmarPayments` and await the network calls. `handle_callback()`, AYA's `initiate()` and `verify_redirect()` stay plain calls:

```python
# shop/payments.py
from python_myanmar_payments import AsyncMyanmarPayments

async_payments = AsyncMyanmarPayments.from_env()
```

```python
from django.shortcuts import redirect
from python_myanmar_payments import Amount, KbzPayPaymentData

from shop.payments import async_payments


async def kbz_checkout(request, order_id: int):
    data = KbzPayPaymentData(
        order_id=f"ORDER_{order_id}",
        amount=Amount.kyat(1000),
        callback_url="https://shop.test/payments/kbz/callback",
    )
    payment = await async_payments.kbz_pay().pwa(data)
    return redirect(payment.url)
```

Django runs every ASGI request on one event loop, so one module-level `AsyncMyanmarPayments` is shared safely. Under WSGI (`runserver` without Daphne or Uvicorn, Gunicorn sync workers), Django gives each async view its own short-lived loop: use the sync `MyanmarPayments` there.

## Flask

Flask views are sync, so use `MyanmarPayments`:

```python
from flask import Flask, Response, jsonify, request
from python_myanmar_payments import (
    ApiError,
    CallbackRequest,
    MyanmarPayments,
    SignatureVerificationError,
)

app = Flask(__name__)
payments = MyanmarPayments.from_env()


def callback_request() -> CallbackRequest:
    return CallbackRequest(
        body=request.get_data(),
        headers=request.headers,
        query=request.query_string,
    )


@app.post("/payments/callback/wave")
def wave_callback() -> Response:
    callback = payments.wave_money().handle_callback(callback_request())
    # fulfill callback.order_id when callback.is_successful()
    # and the amount matches
    ack = callback.acknowledgement()
    return Response(ack.body, status=ack.status, headers=dict(ack.headers))


@app.errorhandler(SignatureVerificationError)
def invalid_signature(error: SignatureVerificationError) -> Response:
    return Response("invalid signature", status=400)


@app.errorhandler(ApiError)
def gateway_error(error: ApiError) -> tuple[Response, int]:
    body = {"code": error.gateway_code, "message": error.gateway_message}
    return jsonify(body), 502
```

Read `request.get_data()` before anything touches `request.form`: once Werkzeug parsed a form body, `get_data()` returns nothing. Reading `request.json` first is fine, since it caches the raw body. With Flask-WTF's `CSRFProtect`, decorate the callback views with `@csrf.exempt`.

## FastAPI

Create an `AsyncMyanmarPayments` in the app's lifespan, so its HTTP client belongs to the server's event loop and is closed on shutdown:

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse
from python_myanmar_payments import (
    AsyncMyanmarPayments,
    CallbackRequest,
    SignatureVerificationError,
    YomaMmqrPaymentData,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with AsyncMyanmarPayments.from_env() as payments:
        app.state.payments = payments
        yield


app = FastAPI(lifespan=lifespan)


@app.post("/payments/callback/yoma")
async def yoma_callback(request: Request) -> Response:
    callback_request = CallbackRequest(
        body=await request.body(),
        headers=request.headers,
        query=request.url.query,
    )
    payments: AsyncMyanmarPayments = request.app.state.payments
    try:
        callback = payments.yoma_mmqr().handle_callback(callback_request)
    except SignatureVerificationError:
        return Response("invalid signature", status_code=400)
    ack = callback.acknowledgement()
    return Response(ack.body, status_code=ack.status, headers=dict(ack.headers))


@app.get("/payments/yoma/{order_id}", response_class=HTMLResponse)
async def yoma_checkout(order_id: str, request: Request) -> str:
    payments: AsyncMyanmarPayments = request.app.state.payments
    data = YomaMmqrPaymentData(
        order_id=order_id,
        amount=1000,
        description="Order",
    )
    payment = await payments.yoma_mmqr().initiate(data)
    return f'<img src="{payment.qr_image_data_uri()}" alt="Scan to pay">'
```

Take the callback as a plain `Request`, not a Pydantic model or `Form(...)` parameters: the signature needs the body bytes exactly as the gateway sent them. Starlette caches `await request.body()`, so later code can still read it.

For a sync `def` endpoint, which FastAPI runs in a thread pool, use the sync `MyanmarPayments` instead.

## Other Frameworks

For any other framework, build the request from its parts with `CallbackRequest(body=..., headers=..., query=...)` (the raw body as `bytes` or `str`, the headers as any mapping or `(name, value)` pairs, the query string as `str`, `bytes` or a mapping), then write `ack.status`, `ack.headers` and `ack.body` with your framework's response API.

## Testing Your App

See [Testing](/python-myanmar-payments/testing) to replace the gateways' HTTP calls with `httpx.MockTransport` or respx, replay signed callbacks and build `PaymentCallback` objects for your own code.
