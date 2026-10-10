---
title: Configuration
description: Configure Node Myanmar Payments with one config class per gateway or from environment variables. Every setting is required; endpoints default to production. Pass your own fetch, HTTP client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes an options object. Gateways take the config object or the plain options. Every setting is required except the URL overrides and Yoma's webhook secret: there are no defaults, and a missing or blank setting throws a `ConfigurationError` naming it:

```ts
import {
  ConfigurationError,
  KbzPay,
  KbzPayConfig,
} from '@laranex/myanmar-payments';

let config: KbzPayConfig;
try {
  config = new KbzPayConfig({
    appId: '...',
    appKey: '',
    merchantCode: '...',
    timeoutSeconds: 30,
  });
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

The time settings (`timeoutSeconds`, and Wave Money's `timeToLiveSeconds`) must be whole numbers greater than 0. Any other value throws the same error with the message `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

## Endpoints

Every gateway uses its production endpoints. There is no switch between test and production: to test against a gateway's UAT environment, or to go through a proxy, set the URL overrides (see [Testing Against UAT](#testing-against-uat)). A blank override means unset. Each config object exposes the URL actually used as a read-only property (`config.apiUrl`, `config.baseUrl`, …).

## Config Options

### KbzPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `timeoutSeconds` | `number \| string` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `apiUrl` | `string` | No | Override the API base URL |
| `pwaUrl` | `string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### WaveMoneyConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page |
| `timeToLiveSeconds` | `number \| string` | Yes | Seconds the customer has to pay. A missing one is reported as `time_to_live_in_seconds` |
| `timeoutSeconds` | `number \| string` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `baseUrl` | `string` | No | Override the API base URL |
| `authenticateUrl` | `string` | No | Override the host the customer is redirected to |

### AyaPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `timeoutSeconds` | `number \| string` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `baseUrl` | `string` | No | Override the gateway base URL |

### YomaMmqrConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Yoma |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `apiVersion` | `string` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `timeoutSeconds` | `number \| string` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `webhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `baseUrl` | `string` | No | Override the API base URL |

### CyberSourceConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `baseUrl` | `string` | No | Override the Secure Acceptance base URL |

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

The URLs are static constants on the config classes: `KbzPayConfig.PRODUCTION_API_URL`, `KbzPayConfig.PRODUCTION_PWA_URL`, `WaveMoneyConfig.PRODUCTION_URL`, `WaveMoneyConfig.PRODUCTION_AUTHENTICATE_URL`, and `PRODUCTION_URL` on `AyaPayConfig`, `YomaMmqrConfig` and `CyberSourceConfig`.

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URL overrides to the gateway's UAT endpoints together with the UAT credentials:

| Gateway | Variable | Config option | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `apiUrl` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `pwaUrl` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `baseUrl` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_AUTHENTICATE_URL` | `authenticateUrl` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `baseUrl` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `baseUrl` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `baseUrl` | `https://testsecureacceptance.cybersource.com` |

Wave serves its API on port `8107` and the page the customer is redirected to on the same host without the port. Remove the overrides, and switch to the production credentials, when you go live.

## From Environment Variables

Every config class and gateway has `fromEnv(env)`, which reads `process.env` by default and takes any object of strings instead, such as a plain object in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```ts
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env);
// or
const config = KbzPayConfig.fromEnv(process.env);
const kbzFromConfig = new KbzPay(config);
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

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `timeout_in_seconds` for KBZ Pay, Wave Money, AYA and Yoma MMQR. The package never reads files itself: load the `.env` file with your framework or with `node --env-file=.env` before `fromEnv()`.

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from its config, on first use, and reuses it. Only the gateways you call need to be configured:

```ts
import { MyanmarPayments } from '@laranex/myanmar-payments';

const payments = new MyanmarPayments({
  kbzPay: {
    appId: '...',
    appKey: '...',
    merchantCode: '...',
    timeoutSeconds: 30,
  },
  yomaMmqr: {
    merchantId: '...',
    clientId: '...',
    clientSecret: '...',
    webhookHashKey: '...',
    apiVersion: 'v1rc',
    timeoutSeconds: 30,
  },
});

payments.kbzPay(); // KbzPay, the same instance on every call
// throws ConfigurationError:
// The wave_money configuration is missing [merchant_id].
payments.waveMoney();

// reads each gateway's variables on first use
const fromEnv = MyanmarPayments.fromEnv(process.env);
```

The keys `kbzPay`, `waveMoney`, `ayaPay`, `yomaMmqr` and `cyberSource` take the config objects or plain options, and the second argument takes the `fetch`, `httpClient` and `tokenCache` options below, shared by every gateway it builds. `payments.cyberSource()` returns the one `CyberSource` class.

## HTTP Client

Gateways that call an API take an options object after the config:

| Option | Type | Description |
|---|---|---|
| `fetch` | `(input, init) => Promise<Response>` | The `fetch` the default client calls. Defaults to the global `fetch` |
| `httpClient` | `HttpClient` | Sends every request. Use it for proxies, tracing, retries or test doubles; takes precedence over `fetch`. Without one, the gateway uses `FetchHttpClient` with the config's `timeoutSeconds` |

```ts
import { KbzPay } from '@laranex/myanmar-payments';
import { fetch, ProxyAgent } from 'undici';

const dispatcher = new ProxyAgent('http://proxy.internal:3128');

const kbz = KbzPay.fromEnv(process.env, {
  fetch: (input, init) => fetch(input, { ...init, dispatcher }),
});
```

A client you pass keeps its own timeout; `timeoutSeconds` is still required.

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

You can also build the default client yourself: `new FetchHttpClient({ fetch, timeoutMs })`, where `timeoutMs` is required and `0` disables the timeout.

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
