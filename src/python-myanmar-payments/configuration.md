---
title: Configuration
description: Configure Python Myanmar Payments with one config class per gateway or from environment variables. Every setting is required; endpoints default to production. Pass your own httpx client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes keyword arguments. Gateways take the config object or a mapping of its keyword arguments (`KbzPay({"app_id": "...", ...})`). Every setting is required except the URL overrides and Yoma's webhook secret: there are no defaults, and a missing or blank setting raises a `ConfigurationError` naming it:

```python
from python_myanmar_payments import ConfigurationError, KbzPay, KbzPayConfig

try:
    config = KbzPayConfig(
        app_id="...",
        app_key="",
        merchant_code="...",
        timeout_seconds=30,
    )
except ConfigurationError as error:
    # e.g. kbz_pay "app_key"
    print(f'missing {error.gateway} setting "{error.key}"')
    raise

kbz = KbzPay(config)
```

`str(error)` reads `The kbz_pay configuration is missing [app_key].`

The time settings (`timeout_seconds`, and Wave Money's `time_to_live_seconds`) must be whole numbers greater than 0. Any other value raises the same error with the message `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

## Endpoints

Every gateway uses its production endpoints. There is no switch between test and production: to test against a gateway's UAT environment, or to go through a proxy, set the URL overrides (see [Testing Against UAT](#testing-against-uat)). A blank override means unset. Each config object exposes the URL actually used as an attribute (`config.api_url`, `config.base_url`, …).

## Config Options

### KbzPayConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `app_id` | `str` | Yes | `appid` issued by KBZ |
| `app_key` | `str` | Yes | Secret key used to sign requests |
| `merchant_code` | `str` | Yes | `merch_code` issued by KBZ |
| `timeout_seconds` | `int \| str` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `api_url` | `str` | No | Override the API base URL |
| `pwa_url` | `str` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### WaveMoneyConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | `str` | Yes | Merchant ID issued by Wave |
| `secret_key` | `str` | Yes | Hash secret key issued by Wave |
| `merchant_name` | `str` | Yes | Shown on Wave's payment page |
| `time_to_live_seconds` | `int \| str` | Yes | Seconds the customer has to pay. A missing one is reported as `time_to_live_in_seconds` |
| `timeout_seconds` | `int \| str` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `base_url` | `str` | No | Override the API base URL |
| `authenticate_url` | `str` | No | Override the host the customer is redirected to |

### AyaPayConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `app_key` | `str` | Yes | Public application key |
| `app_secret` | `str` | Yes | Secret used for checksums |
| `timeout_seconds` | `int \| str` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `base_url` | `str` | No | Override the gateway base URL |

### YomaMmqrConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | `str` | Yes | Merchant ID issued by Yoma |
| `client_id` | `str` | Yes | OAuth client ID |
| `client_secret` | `str` | Yes | OAuth client secret |
| `webhook_hash_key` | `str` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `api_version` | `str` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `timeout_seconds` | `int \| str` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `webhook_secret` | `str` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `base_url` | `str` | No | Override the API base URL |

### CyberSourceConfig

| Argument | Type | Required | Description |
|---|---|---|---|
| `profile_id` | `str` | Yes | Secure Acceptance profile ID |
| `access_key` | `str` | Yes | Profile access key |
| `secret_key` | `str` | Yes | Profile secret key used to sign fields |
| `base_url` | `str` | No | Override the Secure Acceptance base URL |

## Production Endpoints

| Gateway | URL |
|---|---|
| KBZ Pay API | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://payments.wavemoney.io` |
| Wave Money authenticate redirect | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://secureacceptance.cybersource.com` |

The URLs are class constants on the config classes: `KbzPayConfig.PRODUCTION_API_URL`, `KbzPayConfig.PRODUCTION_PWA_URL`, `WaveMoneyConfig.PRODUCTION_URL`, `WaveMoneyConfig.PRODUCTION_AUTHENTICATE_URL`, and `PRODUCTION_URL` on `AyaPayConfig`, `YomaMmqrConfig` and `CyberSourceConfig`.

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URL overrides to the gateway's UAT endpoints together with the UAT credentials:

| Gateway | Variable | Config argument | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `api_url` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `pwa_url` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `base_url` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_AUTHENTICATE_URL` | `authenticate_url` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `base_url` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `base_url` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `base_url` | `https://testsecureacceptance.cybersource.com` |

Wave serves its API on port `8107` and the page the customer is redirected to on the same host without the port. Remove the overrides, and switch to the production credentials, when you go live.

## From Environment Variables

Every config class and gateway has `from_env(env=None)`, which reads `os.environ` by default and takes any mapping instead, such as a `dict` in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```python
from python_myanmar_payments import KbzPay, KbzPayConfig

kbz = KbzPay.from_env()
# or
config = KbzPayConfig.from_env()
kbz = KbzPay(config)
```

Every variable is required unless it is marked optional. The values after `=` are examples:

```env
# Every gateway that calls an API
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30

# KBZ Pay
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional override

# Wave Money
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional override
WAVE_MONEY_AUTHENTICATE_URL=          # optional override

# AYA Payment Gateway (AYA_PGW_* names are read too)
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional override

# Yoma MMQR
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_API_VERSION=v1rc
YOMA_MMQR_WEBHOOK_SECRET=             # optional
YOMA_MMQR_BASE_URL=                   # optional override

# CyberSource
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional override
```

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `timeout_in_seconds` for KBZ Pay, Wave Money, AYA and Yoma MMQR. The package never reads files itself: load the `.env` file with your framework or with [`python-dotenv`](https://pypi.org/project/python-dotenv/) (`load_dotenv()` before `from_env()`, or pass `dotenv_values(".env")` as `env`).

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
        timeout_seconds=30,
    ),
    yoma_mmqr=YomaMmqrConfig(
        merchant_id="...",
        client_id="...",
        client_secret="...",
        webhook_hash_key="...",
        api_version="v1rc",
        timeout_seconds=30,
    ),
)

payments.kbz_pay()  # KbzPay, the same instance on every call
# raises ConfigurationError:
# The wave_money configuration is missing [merchant_id].
payments.wave_money()

# reads each gateway's variables on first use
from_env = MyanmarPayments.from_env()
```

The keyword arguments `kbz_pay`, `wave_money`, `aya_pay`, `yoma_mmqr` and `cyber_source` take the config objects or mappings of their keyword arguments, and the facade also takes the `http_client` and `token_cache` options below, shared by every gateway it builds. `payments.cyber_source()` returns the one `CyberSource` class.

`AsyncMyanmarPayments` is the async twin: same arguments, but `kbz_pay()` returns an `AsyncKbzPay`, `wave_money()` an `AsyncWaveMoney` and so on, and `http_client` takes an `httpx.AsyncClient`.

## HTTP Client

Gateways that call an API take keyword options after the config:

| Option | Type | Description |
|---|---|---|
| `http_client` | `httpx.Client` (async classes: `httpx.AsyncClient`) | Sends every request. Use it for proxies, tracing, retries or test transports. Without one, the gateway creates an `httpx` client with the config's `timeout_seconds` |

```python
import httpx
from python_myanmar_payments import KbzPay, KbzPayConfig

client = httpx.Client(timeout=10, proxy="http://proxy.internal:3128")
kbz = KbzPay(KbzPayConfig.from_env(), http_client=client)
```

`from_env()` takes the same option: `KbzPay.from_env(http_client=client)`.

A client you pass keeps its own timeout; `timeout_seconds` is still required.

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

A failed request (connection error, timeout, invalid URL) raises an `ApiError` whose `__cause__` is the original `httpx` error. An `httpx.AsyncClient` belongs to the event loop it first ran on, so create async gateways inside the running loop, e.g. in a FastAPI lifespan, rather than at import time in code that starts several loops.

`CyberSource` takes no options: it only signs fields and makes no HTTP calls.

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

The default is a thread-safe `MemoryTokenCache`, which lives as long as the process: create one `YomaMmqr` (or one `MyanmarPayments`) at startup and share it across requests. When you run several processes, implement the protocol on top of Redis:

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
