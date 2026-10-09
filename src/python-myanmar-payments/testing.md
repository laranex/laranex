---
title: Testing
description: Test an app that uses Python Myanmar Payments - fake the gateways' HTTP calls with httpx.MockTransport or respx, replay signed callbacks with CallbackRequest, build PaymentCallback objects for your own code, sync and async.
---

# Testing

Every gateway call goes through `httpx`, and callbacks are plain `CallbackRequest` objects, so apps that use the package are tested with pytest and your framework's test client like any other code. Nothing below needs network access.

## Faking Gateway Calls

Pass an `httpx.Client` with an `httpx.MockTransport` as `http_client`. The handler receives every request the gateway sends and returns a canned response:

```python
import json

import httpx
from python_myanmar_payments import KbzPay, KbzPayConfig, KbzPayPaymentData

CONFIG = KbzPayConfig(app_id="kp1", app_key="kbz-secret", merchant_code="1")


def precreate(request: httpx.Request) -> httpx.Response:
    biz = json.loads(request.content)["Request"]["biz_content"]
    assert request.url.path.endswith("/precreate")
    assert biz["merch_order_id"] == "ORDER_1"
    return httpx.Response(
        200,
        json={
            "Response": {
                "result": "SUCCESS",
                "code": "0",
                "prepay_id": "PREPAY_1",
                "qrCode": "kbz-qr",
            }
        },
    )


def test_starts_a_kbz_pay_qr_payment() -> None:
    client = httpx.Client(transport=httpx.MockTransport(precreate))
    kbz = KbzPay(CONFIG, http_client=client)

    data = KbzPayPaymentData(
        order_id="ORDER_1",
        amount=10000,
        callback_url="https://shop.test/payments/kbz/callback",
    )
    payment = kbz.qr(data)

    assert payment.qr_string == "kbz-qr"
    assert payment.reference == "PREPAY_1"
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{api_url}/precreate`, `{api_url}/queryorder` |
| Wave Money | `{base_url}/payment` |
| AYA Pay | `{base_url}/v1/payment/services`, `{base_url}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{base_url}/token`, then `{base_url}/payment-gateway/{api_version}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/python-myanmar-payments/drivers/kbz-pay). To test failures, return an error body (e.g. `{"Response": {"result": "FAIL", "code": "ORDER_ID_USED"}}`) and assert that your code handles the `ApiError`; raise `httpx.ConnectError("down")` from the handler to simulate an unreachable gateway.

When your app builds gateways with `MyanmarPayments.from_env()`, pass a test environment and the fake client instead of touching `os.environ`:

```python
import httpx
from python_myanmar_payments import MyanmarPayments

TEST_ENV = {
    "KBZ_PAY_APP_ID": "kp1",
    "KBZ_PAY_APP_KEY": "kbz-secret",
    "KBZ_PAY_MERCHANT_CODE": "1",
}


def make_payments(handler) -> MyanmarPayments:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return MyanmarPayments.from_env(TEST_ENV, http_client=client)
```

### With respx

[respx](https://lundberg.github.io/respx/) patches every `httpx` client, so the gateways need no `http_client` argument:

```python
import httpx
import respx
from python_myanmar_payments import KbzPay, KbzPayConfig

CONFIG = KbzPayConfig(app_id="kp1", app_key="kbz-secret", merchant_code="1")


@respx.mock
def test_reports_a_paid_order() -> None:
    respx.post(url__regex=r"/queryorder$").mock(
        return_value=httpx.Response(
            200,
            json={
                "Response": {
                    "result": "SUCCESS",
                    "code": "0",
                    "merch_order_id": "ORDER_1",
                    "trade_status": "PAY_SUCCESS",
                    "total_amount": "10000",
                }
            },
        )
    )

    result = KbzPay(CONFIG).status("ORDER_1")

    assert result.is_successful()
```

## Async Tests

`httpx.MockTransport` serves `httpx.AsyncClient` too, so the async classes are faked the same way. With [pytest-asyncio](https://pypi.org/project/pytest-asyncio/) (or anyio's pytest plugin):

```python
import httpx
import pytest
from python_myanmar_payments import (
    AsyncKbzPay,
    KbzPayConfig,
    KbzPayPaymentData,
)

CONFIG = KbzPayConfig(app_id="kp1", app_key="kbz-secret", merchant_code="1")


def precreate(request: httpx.Request) -> httpx.Response:
    body = {"result": "SUCCESS", "code": "0", "prepay_id": "PREPAY_1"}
    return httpx.Response(200, json={"Response": body})


@pytest.mark.asyncio
async def test_starts_a_kbz_pay_pwa_payment() -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(precreate))
    async with client, AsyncKbzPay(CONFIG, http_client=client) as kbz:
        data = KbzPayPaymentData(
            order_id="ORDER_1",
            amount=10000,
            callback_url="https://shop.test/payments/kbz/callback",
        )
        payment = await kbz.pwa(data)

    assert "prepay_id=PREPAY_1" in payment.url
```

## Replaying Signed Callbacks

To run a callback through real verification, sign it with the secret from your test configuration. KBZ Pay's signer is public (`KbzPaySigner`); `CallbackRequest.from_json` encodes the payload as a JSON body:

```python
from python_myanmar_payments import (
    CallbackRequest,
    KbzPay,
    KbzPayConfig,
    KbzPaySigner,
    PaymentStatus,
)

CONFIG = KbzPayConfig(app_id="kp1", app_key="kbz-secret", merchant_code="1")


def signed_kbz_callback(**fields: str) -> CallbackRequest:
    fields["sign_type"] = "SHA256"
    fields["sign"] = KbzPaySigner("kbz-secret").sign(fields)
    return CallbackRequest.from_json({"Request": fields})


def test_verifies_a_kbz_pay_callback() -> None:
    request = signed_kbz_callback(
        merch_order_id="ORDER_1",
        mm_order_id="MM_1",
        total_amount="10000",
        trade_status="PAY_SUCCESS",
    )

    callback = KbzPay(CONFIG).handle_callback(request)

    assert callback.status is PaymentStatus.SUCCESSFUL
    assert callback.acknowledgement.body == "success"
```

A modified payload must be rejected: change `total_amount` after signing and `handle_callback()` raises `SignatureVerificationError`. To exercise your real callback view, post the same JSON with your framework's test client, e.g. Django's `client.post("/payments/kbz/callback", body, content_type="application/json")`, Flask's `client.post(..., data=body, content_type="application/json")` or Starlette's `TestClient.post(..., content=body)`.

The other gateways sign with HMAC-SHA256 over documented fields, as described on their [gateway pages](/python-myanmar-payments/drivers/wave-money). To replay a call you stored, rebuild it from the stored raw body and headers: `CallbackRequest(body=stored_body, headers=stored_headers)`.

## Testing Your Own Logic

To test fulfillment code without signatures, build the callback yourself:

```python
from python_myanmar_payments import PaymentCallback, PaymentStatus

from shop.payments import fulfill


def test_fulfills_a_paid_order() -> None:
    callback = PaymentCallback(
        order_id="ORDER_1",
        status=PaymentStatus.SUCCESSFUL,
        gateway_status="PAY_SUCCESS",
        amount="10000",
    )

    fulfill(callback)
```

`PaymentStatusResult`, `RedirectPayment`, `FormPayment`, `QrPayment` and `AppPayment` take their fields as keyword arguments the same way, so you can return them from a mocked gateway (`unittest.mock.create_autospec(KbzPay)`) when a test only covers your own views.
