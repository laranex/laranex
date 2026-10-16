---
title: Configuration
description: Configure Python Myanmar Payments with one config class per gateway or from environment variables. Every setting is required except the HTTP timeout (30 seconds by default), URLs and time to live included. Pass your own httpx client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WavePayConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes keyword arguments. Gateways take the config object or a mapping of its keyword arguments (`KbzPay({"app_id": "...", ...})`); other keys in the mapping are ignored. Text settings also take integers (`merchant_code=200123` is `"200123"`); floats and booleans count as missing. Every setting of a gateway you use is required and has no default, except the HTTP timeout (`timeout_seconds`, default 30, `DEFAULT_TIMEOUT_SECONDS`). A missing or blank setting raises a `ConfigurationError` naming it:

```python
from python_myanmar_payments import ConfigurationError, KbzPay, KbzPayConfig

try:
    config = KbzPayConfig(
        app_id="...",
        app_key="",
        merchant_code="...",
        api_url=KbzPayConfig.PRODUCTION_API_URL,
        pwa_url=KbzPayConfig.PRODUCTION_PWA_URL,
        time_to_live_minutes=15,
    )
except ConfigurationError as error:
    # e.g. kbz_pay "app_key"
    print(f'missing {error.gateway} setting "{error.key}"')
    raise

kbz = KbzPay(config)
```

`str(error)` reads `The kbz_pay configuration is missing [app_key].`

The time settings take an `int` or integer text such as `"45"`: `timeout_seconds` and Wave Pay's `time_to_live_seconds` from 1 to 2147483647, KBZ Pay's `time_to_live_minutes` from 1 to 120. An invalid value such as `"2.5"` or `"2147483648"` raises e.g. `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

Settings are checked in the same order in every Laranex SDK, so the first error is the same: the credentials, URLs and other text settings, then the time to live, then the HTTP timeout. Only ASCII whitespace is trimmed; a no-break space or a byte order mark counts as text.

## Config Options

### KbzPayConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `app_id` | `str` | Yes | `appid` issued by KBZ |
| `app_key` | `str` | Yes | Secret key used to sign requests |
| `merchant_code` | `str` | Yes | `merch_code` issued by KBZ |
| `api_url` | `str` | Yes | The API base URL, e.g. `KbzPayConfig.PRODUCTION_API_URL` |
| `pwa_url` | `str` | Yes | The PWA checkout URL, e.g. `KbzPayConfig.PRODUCTION_PWA_URL`. Normalized to end with `/`, e.g. `…/pwa/#/` |
| `time_to_live_minutes` | `int \| str` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment's own `time_to_live_minutes` overrides it. A value outside 1 to 120 or not a whole number raises `The kbz_pay configuration [time_to_live_in_minutes] must be a whole number from 1 to 120.` |
| `timeout_seconds` | `int \| str` | No | Seconds before the default HTTP client gives up. Default 30 |

### WavePayConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | `str` | Yes | Merchant ID issued by Wave |
| `secret_key` | `str` | Yes | Hash secret key issued by Wave |
| `merchant_name` | `str` | Yes | Shown on Wave's payment page |
| `base_url` | `str` | Yes | The API base URL, e.g. `WavePayConfig.PRODUCTION_URL`. Payments are requested at its `/payment` |
| `base_redirect_url` | `str` | Yes | The host the customer is sent to, e.g. `WavePayConfig.PRODUCTION_URL`. The customer approves the payment at its `/authenticate` |
| `time_to_live_seconds` | `int \| str` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WavePayPaymentData`'s `time_to_live_seconds`. An invalid one is reported as `time_to_live_in_seconds` |
| `timeout_seconds` | `int \| str` | No | Seconds before the default HTTP client gives up. Default 30 |

### AyaPayConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `app_key` | `str` | Yes | Public application key |
| `app_secret` | `str` | Yes | Secret used for checksums |
| `base_url` | `str` | Yes | The gateway base URL, e.g. `AyaPayConfig.PRODUCTION_URL` |
| `timeout_seconds` | `int \| str` | No | Seconds before the default HTTP client gives up. Default 30 |

### YomaMmqrConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | `str` | Yes | Merchant ID issued by Yoma |
| `client_id` | `str` | Yes | OAuth client ID |
| `client_secret` | `str` | Yes | OAuth client secret |
| `webhook_hash_key` | `str` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `api_version` | `str` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `webhook_secret` | `str` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `base_url` | `str` | Yes | The API base URL, e.g. `YomaMmqrConfig.PRODUCTION_URL` |
| `timeout_seconds` | `int \| str` | No | Seconds before the default HTTP client gives up. Default 30 |

### CyberSourceConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `profile_id` | `str` | Yes | Secure Acceptance profile ID |
| `access_key` | `str` | Yes | Profile access key |
| `secret_key` | `str` | Yes | Profile secret key used to sign fields |
| `base_url` | `str` | Yes | The Secure Acceptance base URL, e.g. `CyberSourceConfig.PRODUCTION_URL` |

## Production Endpoints

```env
KBZ_PAY_BASE_URL=https://api.kbzpay.com/payment/gateway
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://wap.kbzpay.com/pgw/pwa/#/"
WAVE_PAY_BASE_URL=https://payments.wavemoney.io
WAVE_PAY_BASE_REDIRECT_URL=https://payments.wavemoney.io
AYA_PAY_BASE_URL=https://pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://paymenthubapi.yomabank.com
CYBER_SOURCE_BASE_URL=https://secureacceptance.cybersource.com
```

## UAT Endpoints

```env
KBZ_PAY_BASE_URL=http://api-uat.kbzpay.com/payment/gateway/uat
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://static.kbzpay.com/pgw/uat/pwa/#/"
WAVE_PAY_BASE_URL=https://preprodpayments.wavemoney.io:8107
WAVE_PAY_BASE_REDIRECT_URL=https://preprodpayments.wavemoney.io:8107
AYA_PAY_BASE_URL=https://uat-pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://devapi.yomabank.net
CYBER_SOURCE_BASE_URL=https://testsecureacceptance.cybersource.com
```

## From Environment Variables

Every config class and gateway has `from_env(env=None)`, which reads `os.environ` by default and takes any mapping instead, such as a `dict` in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```python
from python_myanmar_payments import KbzPay, KbzPayConfig

kbz = KbzPay.from_env()
# or
config = KbzPayConfig.from_env()
kbz = KbzPay(config)
```

Every variable is required unless it is marked optional. Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#uat-endpoints). The values after `=` are examples:

```env
# Every gateway that calls an API
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30      # optional, defaults to 30 seconds

# KBZ Pay
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=
KBZ_PAY_PWA_BASE_REDIRECT_URL=
KBZ_PAY_TIME_TO_LIVE_IN_MINUTES=15    # 1 to 120

# Wave Pay
WAVE_PAY_MERCHANT_ID=
WAVE_PAY_SECRET_KEY=
WAVE_PAY_MERCHANT_NAME=
WAVE_PAY_BASE_URL=
WAVE_PAY_BASE_REDIRECT_URL=
WAVE_PAY_TIME_TO_LIVE_IN_SECONDS=900   # greater than 0

# AYA Payment Gateway
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=

# Yoma MMQR
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_API_VERSION=v1rc
YOMA_MMQR_WEBHOOK_SECRET=             # every callback carries it in X-Webhook-Secret
YOMA_MMQR_BASE_URL=

# CyberSource
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=
```

The package never reads files itself: load the `.env` file with your framework or with [`python-dotenv`](https://pypi.org/project/python-dotenv/) (`load_dotenv()` before `from_env()`, or pass `dotenv_values(".env")` as `env`).

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from its config object, on first use, and reuses it. Only the gateways you call need to be configured:

```python
from python_myanmar_payments import (
    KbzPayConfig,
    MyanmarPayments,
    YomaMmqrConfig,
)

payments = MyanmarPayments(
    kbz_pay=KbzPayConfig(
        app_id="...",
        app_key="...",
        merchant_code="...",
        api_url=KbzPayConfig.PRODUCTION_API_URL,
        pwa_url=KbzPayConfig.PRODUCTION_PWA_URL,
        time_to_live_minutes=15,
    ),
    yoma_mmqr=YomaMmqrConfig(
        merchant_id="...",
        client_id="...",
        client_secret="...",
        webhook_hash_key="...",
        api_version="v1rc",
        webhook_secret="...",
        base_url=YomaMmqrConfig.PRODUCTION_URL,
    ),
)

payments.kbz_pay()  # KbzPay, the same instance on every call
# raises ConfigurationError:
# The wave_pay configuration is missing [merchant_id].
payments.wave_pay()

# reads each gateway's variables on first use
from_env = MyanmarPayments.from_env()
```

The keyword arguments `kbz_pay`, `wave_pay`, `aya_pay`, `yoma_mmqr` and `cyber_source` take the config objects or mappings of their keyword arguments, and the facade also takes the `http_client` and `token_cache` options below, shared by every gateway it builds. `payments.cyber_source()` returns a `CyberSource` (one class for sync and async).

`AsyncMyanmarPayments` is the async twin: same arguments, but `kbz_pay()` returns an `AsyncKbzPay`, `wave_pay()` an `AsyncWavePay` and so on, and `http_client` takes an `httpx.AsyncClient`.

## HTTP Client

Gateways that call an API take `http_client=` (`httpx.Client`, or `httpx.AsyncClient` on the async classes), also on `from_env()`, for proxies, tracing, retries or test transports. A client you pass keeps its own timeout; without one, the gateway creates an `httpx` client and `timeout_seconds` is one overall deadline per request (connecting, sending and reading the whole response). A request past it raises `ApiError("Could not reach <url>: timed out")`.

```python
import httpx
from python_myanmar_payments import KbzPay, KbzPayConfig

client = httpx.Client(timeout=10, proxy="http://proxy.internal:3128")
kbz = KbzPay(KbzPayConfig.from_env(), http_client=client)
```

Without `http_client`, a gateway creates its client on first use and keeps it for later calls, so create gateways once at startup and share them. Close the client it created with `close()` (async: `await aclose()`) or a `with` (async: `async with`) block; a client you passed stays open, since you own it:

```python
from python_myanmar_payments import AsyncMyanmarPayments, MyanmarPayments

with MyanmarPayments.from_env() as payments:
    result = payments.kbz_pay().status("ORDER_1")
    print(result.status)

async def check() -> None:
    async with AsyncMyanmarPayments.from_env() as payments:
        result = await payments.kbz_pay().status("ORDER_1")
        print(result.status)
```

An `httpx.AsyncClient` belongs to the event loop it first ran on, so create async gateways inside the running loop, e.g. in a FastAPI lifespan, rather than at import time in code that starts several loops.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `YomaMmqr` keeps it in a `TokenCache`, under a key derived from the base URL and client ID that every Laranex payments SDK shares (see [Access Tokens](/python-myanmar-payments/drivers/yoma-mmqr#access-tokens)). `TokenCache` is a protocol with three methods:

```python
from typing import Protocol

class TokenCache(Protocol):
    def get(self, key: str) -> str | None: ...

    # ttl_seconds of 0 or less never expires
    def set(self, key: str, value: str, ttl_seconds: int) -> None: ...

    def delete(self, key: str) -> None: ...
```

The default is a thread-safe `MemoryTokenCache` (`clear()` empties it), which lives as long as the process: create one `YomaMmqr` (or one `MyanmarPayments`) at startup and share it across requests. When you run several processes, implement the protocol on top of Redis:

```python
import redis
from python_myanmar_payments import YomaMmqr

class RedisTokenCache:
    def __init__(self, client: redis.Redis) -> None:
        self.client = client

    def get(self, key: str) -> str | None:
        value = self.client.get(key)
        return None if value is None else value.decode()

    def set(self, key: str, value: str, ttl_seconds: int) -> None:
        self.client.set(key, value, ex=ttl_seconds if ttl_seconds > 0 else None)

    def delete(self, key: str) -> None:
        self.client.delete(key)

yoma = YomaMmqr.from_env(token_cache=RedisTokenCache(redis.Redis()))
```

`AsyncYomaMmqr` and `AsyncMyanmarPayments` also accept an `AsyncTokenCache`, the same protocol with `async def` methods, e.g. on top of `redis.asyncio`. Pass `token_cache` to `MyanmarPayments` to share one cache with the Yoma gateway it builds.
