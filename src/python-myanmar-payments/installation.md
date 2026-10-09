---
title: Installation
description: Install Python Myanmar Payments from PyPI. Requires Python 3.10+, ships type hints, has sync and async clients, and depends only on httpx.
---

# Installation

## Via pip

> **Requires** Python 3.10+. The only dependency is [`httpx`](https://www.python-httpx.org/), which sends the gateway requests.

::: code-group

```bash [pip]
pip install python-myanmar-payments
```

```bash [uv]
uv add python-myanmar-payments
```

```bash [Poetry]
poetry add python-myanmar-payments
```

:::

The package is fully typed (`py.typed`, checked with `mypy --strict`). Import everything from `python_myanmar_payments`:

```python
from python_myanmar_payments import Amount, CallbackRequest, KbzPay
```

The root package exports every public name. Each gateway also has its own module, which exports only that gateway's classes:

| Module | Contents |
|---|---|
| `python_myanmar_payments` | Everything below, plus `Amount`, results, `PaymentCallback`, `PaymentStatus`, `CallbackRequest`, `Acknowledgement`, errors, `TokenCache`, `AsyncTokenCache`, `MemoryTokenCache` and the `MyanmarPayments` / `AsyncMyanmarPayments` facades |
| `python_myanmar_payments.kbz_pay` | `KbzPay`, `AsyncKbzPay`, `KbzPayConfig`, `KbzPayPaymentData`, `KbzPaySigner` |
| `python_myanmar_payments.wave_money` | `WaveMoney`, `AsyncWaveMoney`, `WaveMoneyConfig`, `WaveMoneyPaymentData`, `WaveMoneyItem` |
| `python_myanmar_payments.aya_pay` | `AyaPay`, `AsyncAyaPay`, `AyaPayConfig`, `AyaPayPaymentData`, `AyaPayMethod`, `AyaPayService` |
| `python_myanmar_payments.yoma_mmqr` | `YomaMmqr`, `AsyncYomaMmqr`, `YomaMmqrConfig`, `YomaMmqrPaymentData` |
| `python_myanmar_payments.cyber_source` | `CyberSource`, `CyberSourceConfig`, `CyberSourcePaymentData`, `CyberSourceTransactionType` |

Both paths name the same classes, so `KbzPay` from the module and from the root are the same class. Modules whose names start with `_` are internal.

## Sync and Async

Every gateway that calls an API has a sync class and an async twin with the same methods, awaited:

| Sync | Async | Network calls |
|---|---|---|
| `KbzPay` | `AsyncKbzPay` | `pwa()`, `qr()`, `app()`, `status()` |
| `WaveMoney` | `AsyncWaveMoney` | `initiate()` |
| `AyaPay` | `AsyncAyaPay` | `services()`, `status()` |
| `YomaMmqr` | `AsyncYomaMmqr` | `initiate()`, `renew_qr()`, `status()`, `forget_token()` |
| `CyberSource` | `CyberSource` | None: one class for both |
| `MyanmarPayments` | `AsyncMyanmarPayments` | Builds the classes above |

Methods that make no network call are never awaited, on the async classes too: `handle_callback()`, AYA's `initiate()` and `verify_redirect()`, and everything on `CyberSource`. Use the sync classes in Django, Flask and other WSGI code, and the async classes inside an event loop (FastAPI, Starlette, async Django views).

## Quick Start

A Flask app that starts a KBZ Pay PWA payment and verifies the callback:

```python
from flask import Flask, Response, redirect, request
from python_myanmar_payments import (
    Amount,
    CallbackRequest,
    KbzPay,
    KbzPayPaymentData,
    SignatureVerificationError,
)

app = Flask(__name__)

# Raises a ConfigurationError naming the missing setting
kbz = KbzPay.from_env()


@app.get("/checkout")
def checkout():
    data = KbzPayPaymentData(
        order_id="ORDER_1",
        amount=Amount.kyat(10000),
        callback_url="https://shop.test/payments/kbz/callback",
    )
    payment = kbz.pwa(data)
    return redirect(payment.url)


@app.post("/payments/kbz/callback")
def kbz_callback():
    callback_request = CallbackRequest(
        body=request.get_data(),
        headers=request.headers,
        query=request.query_string,
    )
    try:
        callback = kbz.handle_callback(callback_request)
    except SignatureVerificationError:
        return Response("invalid callback", status=400)

    if callback.is_successful():
        # compare callback.amount with your order,
        # then fulfill callback.order_id
        ...

    ack = callback.acknowledgement  # KBZ Pay expects a plain "success"
    return Response(ack.body, status=ack.status, headers=dict(ack.headers))
```

See [Framework Integration](/python-myanmar-payments/framework-integration) for Django, Flask and FastAPI, sync and async.
