---
title: Configuration
description: Configure Node Myanmar Payments with one config class per gateway or from environment variables. Sandbox is the default; pass your own fetch, HTTP client, timeout and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes an options object. Gateways take the config object or the plain options, and a missing credential throws a `ConfigurationError` naming it:

```ts
import {
  ConfigurationError,
  KbzPay,
  KbzPayConfig,
} from '@laranex/myanmar-payments';

let config: KbzPayConfig;
try {
  config = new KbzPayConfig({ appId: '...', appKey: '', merchantCode: '...' });
} catch (error) {
  if (error instanceof ConfigurationError) {
    // e.g. kbz_pay "app_key"
    console.error(`missing ${error.gateway} setting "${error.key}"`);
  }
  throw error;
}

const kbz = new KbzPay(config);
```

`error.message` reads `The kbz_pay configuration is missing [app_key].`

## Sandbox and Production

Every config has a `sandbox` option that defaults to `true`, so a forgotten setting never sends real payments. Pass `sandbox: false` together with production credentials when you go live. A string is read like a `*_SANDBOX` variable (see [From Environment Variables](#from-environment-variables)), so `sandbox: 'false'` selects production too.

URL options are optional overrides; leave them unset to use the endpoint matching `sandbox`. Each config object exposes the URL actually used as a read-only property (`config.apiUrl`, `config.baseUrl`, …).

## Config Options

### KbzPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `sandbox` | `boolean \| string` | No | `true` (default) uses UAT |
| `apiUrl` | `string` | No | Override the API base URL |
| `pwaUrl` | `string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### WaveMoneyConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page |
| `timeToLiveSeconds` | `number` | No | Seconds the customer has to pay. Unset or not a positive integer means 300 |
| `sandbox` | `boolean \| string` | No | `true` (default) uses the test host |
| `baseUrl` | `string` | No | Override the API base URL |
| `authenticateUrl` | `string` | No | Override the host the customer is redirected to |

### AyaPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `sandbox` | `boolean \| string` | No | `true` (default) uses UAT |
| `baseUrl` | `string` | No | Override the gateway base URL |

### YomaMmqrConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Yoma |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `webhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `sandbox` | `boolean \| string` | No | `true` (default) uses UAT |
| `baseUrl` | `string` | No | Override the API base URL |
| `apiVersion` | `string` | No | The `{version}` path segment, default `v1rc` (`YomaMmqrConfig.DEFAULT_API_VERSION`) |

### CyberSourceConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `sandbox` | `boolean \| string` | No | `true` (default) uses the test environment |
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

## From Environment Variables

Every config class and gateway has `fromEnv(env)`, which reads `process.env` by default and takes any object of strings instead, such as a plain object in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```ts
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env);
// or
const config = KbzPayConfig.fromEnv(process.env);
const kbzFromConfig = new KbzPay(config);
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

`*_SANDBOX=false` (or `0`, `f`, `no`, `off`, in any case) selects production. Unset or unrecognized values mean sandbox. The package never reads files itself: load the `.env` file with your framework or with `node --env-file=.env` before `fromEnv()`.

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from its config, on first use, and reuses it. Only the gateways you call need to be configured:

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

payments.kbzPay(); // KbzPay, the same instance on every call
// throws ConfigurationError:
// The wave_money configuration is missing [merchant_id].
payments.waveMoney();

// reads each gateway's variables on first use
const fromEnv = MyanmarPayments.fromEnv(process.env);
```

The keys `kbzPay`, `waveMoney`, `ayaPay`, `yomaMmqr` and `cyberSource` take the config objects or plain options, and the second argument takes the `fetch`, `timeoutMs`, `httpClient` and `tokenCache` options below, shared by every gateway it builds. `payments.cyberSource()` returns the one `CyberSource` class.

## HTTP Client

Gateways that call an API take an options object after the config:

| Option | Type | Description |
|---|---|---|
| `fetch` | `(input, init) => Promise<Response>` | The `fetch` to call. Defaults to the global `fetch` |
| `timeoutMs` | `number` | Milliseconds before a request is aborted. Default `30000` (`DEFAULT_TIMEOUT_MS`); `0` disables it |
| `httpClient` | `HttpClient` | Sends every request. Use it for proxies, tracing, retries or test doubles; takes precedence over `fetch` and `timeoutMs` |

```ts
import { KbzPay } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env, { timeoutMs: 10_000 });
```

`HttpClient` is a one-method interface. Throw on network failures; any status code is a normal response:

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

A failed request (network error, timeout, aborted signal) throws an `ApiError` whose `cause` is the original error.

`CyberSource` takes no options: it only signs fields and makes no HTTP calls.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `YomaMmqr` keeps it in a `TokenCache`, an interface with three methods:

```ts
interface TokenCache {
  get(
    key: string,
  ): string | undefined | null | Promise<string | undefined | null>;
  // ttlSeconds of 0 or less never expires
  set(
    key: string,
    value: string,
    ttlSeconds: number,
  ): unknown | Promise<unknown>;
  delete(key: string): unknown | Promise<unknown>;
}
```

Every method may be async. The default is a `MemoryTokenCache`, which lives as long as the process: create one `YomaMmqr` (or one `MyanmarPayments`) at startup and share it across requests. When you run several processes, implement the interface on top of Redis:

```ts
import { createClient } from 'redis';
import { YomaMmqr, type TokenCache } from '@laranex/myanmar-payments';

const redis = await createClient().connect();

const tokenCache: TokenCache = {
  get: (key) => redis.get(key),
  set: (key, value, ttlSeconds) =>
    ttlSeconds > 0
      ? redis.set(key, value, { EX: ttlSeconds })
      : redis.set(key, value),
  delete: (key) => redis.del(key),
};

const yoma = YomaMmqr.fromEnv(process.env, { tokenCache });
```

Pass `tokenCache` to `MyanmarPayments` to share one cache with the Yoma gateway it builds. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256 of baseUrl|clientId>`, the same key in every Laranex SDK, so services written in different languages can share one cache.
