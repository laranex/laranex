---
title: Configuration
description: Configure Node Myanmar Payments with one config class per gateway or from environment variables. Sandbox is the default; inject your own fetch, HTTP client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`). Gateways accept the class or a plain options object, and a missing credential throws a `ConfigurationError` naming it:

```ts
import { ConfigurationError } from '@laranex/myanmar-payments';
import { KbzPay } from '@laranex/myanmar-payments/kbz-pay';

try {
  const kbz = new KbzPay({ appId: '...', appKey: '...', merchantCode: '...' });
} catch (error) {
  if (error instanceof ConfigurationError) {
    // e.g. kbz_pay "app_key"
    console.error(`missing ${error.gateway} setting "${error.key}"`);
  }
  throw error;
}
```

## Sandbox and Production

Every config has a `sandbox` option that defaults to `true`, so a forgotten setting never sends real payments. Set `sandbox: false` together with production credentials when you go live.

URL options are optional overrides; leave them unset to use the endpoint matching `sandbox`. Each config class exposes the URL actually used as a read-only property (`config.apiUrl`, `config.baseUrl`, …).

## Config Options

### KbzPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `sandbox` | `boolean` | No | `true` (default) uses UAT |
| `apiUrl` | `string` | No | Override the API base URL |
| `pwaUrl` | `string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### WaveMoneyConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant id issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page |
| `timeToLiveSeconds` | `number` | No | Seconds the customer has to pay. Unset or not a positive integer means 300 |
| `sandbox` | `boolean` | No | `true` (default) uses the test host |
| `baseUrl` | `string` | No | Override the API base URL |
| `authenticateUrl` | `string` | No | Override the host the customer is redirected to |

### AyaPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `sandbox` | `boolean` | No | `true` (default) uses UAT |
| `baseUrl` | `string` | No | Override the gateway base URL |

### YomaMmqrConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant id issued by Yoma |
| `clientId` | `string` | Yes | OAuth client id |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks |
| `webhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `sandbox` | `boolean` | No | `true` (default) uses UAT |
| `baseUrl` | `string` | No | Override the API base URL |
| `apiVersion` | `string` | No | The `{version}` path segment, default `v1rc` (`YomaMmqrConfig.DEFAULT_API_VERSION`) |

### CyberSourceConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile id |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `sandbox` | `boolean` | No | `true` (default) uses the test environment |
| `baseUrl` | `string` | No | Override the Secure Acceptance base URL |

## Default Endpoints

| Gateway | Sandbox | Production |
|---|---|---|
| KBZ Pay API | `http://api-uat.kbzpay.com/payment/gateway/uat` | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://static.kbzpay.com/pgw/uat/pwa/#/` | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://preprodpayments.wavemoney.io:8107` | `https://payments.wavemoney.io` |
| Wave Money authenticate redirect | `https://preprodpayments.wavemoney.io` | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://uat-pgw.ayainnovation.com` | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://devapi.yomabank.net` | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://testsecureacceptance.cybersource.com` | `https://secureacceptance.cybersource.com` |

The URLs are static constants on the config classes, e.g. `KbzPayConfig.SANDBOX_API_URL`, `KbzPayConfig.PRODUCTION_PWA_URL`, `WaveMoneyConfig.SANDBOX_AUTHENTICATE_URL`, `YomaMmqrConfig.PRODUCTION_URL`.

::: warning Wave sandbox host
Wave's sandbox API listens on port 8107 (`https://preprodpayments.wavemoney.io:8107`), but it serves the customer-facing authenticate page without the port, at `https://preprodpayments.wavemoney.io/authenticate`. The package uses both hosts for you. If Wave gives you different hosts, set `baseUrl` and `authenticateUrl` (or `WAVE_MONEY_BASE_URL` and `WAVE_MONEY_AUTHENTICATE_URL`).
:::

## From Environment Variables

Every config class and gateway has `fromEnv(env)`, which defaults to `process.env`. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```ts
const kbz = KbzPay.fromEnv(process.env);
// or
const config = KbzPayConfig.fromEnv(process.env);
```

```env
# KBZ Pay
KBZ_PAY_SANDBOX=true
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional override

# Wave Money
WAVE_MONEY_SANDBOX=true
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=             # falls back to APP_NAME
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional override
WAVE_MONEY_AUTHENTICATE_URL=          # optional override

# AYA Payment Gateway (AYA_PGW_* names are read too)
AYA_PAY_SANDBOX=true
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional override

# Yoma MMQR
YOMA_MMQR_SANDBOX=true
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_WEBHOOK_SECRET=             # optional
YOMA_MMQR_BASE_URL=                   # optional override
YOMA_MMQR_API_VERSION=v1rc

# CyberSource
CYBER_SOURCE_SANDBOX=true
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional override
```

`*_SANDBOX=false` (or `0`, `f`, `no`, `off`, in any case) selects production. Unset or unrecognized values mean sandbox. Load the `.env` file with `node --env-file=.env` or your framework; the package never reads files itself.

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from one config object, on first use, and reuses it. Only the gateways you call need to be configured:

```ts
import { MyanmarPayments } from '@laranex/myanmar-payments';

const payments = new MyanmarPayments({
  kbzPay: { appId: '...', appKey: '...', merchantCode: '...' },
  yomaMmqr: {
    merchantId: '...',
    clientId: '...',
    clientSecret: '...',
    webhookHashKey: '...',
  },
});

payments.kbzPay();   // KbzPay, the same instance on every call
// throws ConfigurationError:
// The wave_money configuration is missing [merchant_id].
payments.waveMoney();

// reads each gateway's variables on first use
const fromEnv = MyanmarPayments.fromEnv(process.env);
```

The second argument takes the HTTP and cache options below, shared by every gateway it builds.

## HTTP Client

Gateways that call an API take an options object as their second argument:

| Option | Type | Description |
|---|---|---|
| `fetch` | `(input, init) => Promise<Response>` | The `fetch` to call. Defaults to the global `fetch` |
| `timeoutMs` | `number` | Milliseconds before a request is aborted. Default `30000`; `0` disables it |
| `httpClient` | `HttpClient` | Sends every request yourself; takes precedence over `fetch` and `timeoutMs` |

```ts
const kbz = new KbzPay(config, { timeoutMs: 10_000 });
```

`HttpClient` is a one-method interface, handy for proxies, tracing or test doubles. Throw on network failures; any status code is a normal response:

```ts
interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}
// HttpRequest:  { method: 'POST'; url: string;
//                 headers: Record<string, string>; body: string;
//                 signal?: AbortSignal }
// HttpResponse: { status: number; body: string }
```

The default is `FetchHttpClient`, which you can also build yourself: `new FetchHttpClient({ fetch, timeoutMs })`.

Every network method takes an optional last argument `{ signal }`, so request deadlines and cancellation apply to gateway calls:

```ts
const result = await kbz.status('ORDER_1', {
  signal: AbortSignal.timeout(5000),
});
```

An aborted or failed request throws an `ApiError` whose `cause` is the original error.

`CyberSource` takes no options: it only signs fields and makes no HTTP calls.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `YomaMmqr` keeps it in a `TokenCache`:

```ts
interface TokenCache {
  get(
    key: string,
  ): string | undefined | null | Promise<string | undefined | null>;
  set(
    key: string,
    value: string,
    ttlSeconds: number,
  ): unknown | Promise<unknown>;
  delete(key: string): unknown | Promise<unknown>;
}
```

Every method may be async. The default is a `MemoryTokenCache`, which lives as long as the process: create one `YomaMmqr` (or one `MyanmarPayments`) at startup and share it across requests. When you run several processes, implement `TokenCache` on top of Redis:

```ts
import { createClient } from 'redis';
import type { TokenCache } from '@laranex/myanmar-payments';
import { YomaMmqr } from '@laranex/myanmar-payments/yoma-mmqr';

const redis = await createClient().connect();

const tokenCache: TokenCache = {
  get: (key) => redis.get(key),
  set: (key, value, ttlSeconds) => redis.set(key, value, { EX: ttlSeconds }),
  delete: (key) => redis.del(key),
};

const yoma = YomaMmqr.fromEnv(process.env, { tokenCache });
```
