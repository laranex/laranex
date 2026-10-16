---
title: Configuration
description: Configure Node Myanmar Payments with one config class per gateway or from environment variables. Every setting is required except the HTTP timeout, which defaults to 30 seconds; URLs and time to live included. Pass your own fetch, HTTP client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WavePayConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes an options object. Gateways take the config object or the plain options. Every setting of a gateway you use is required and has no default, except the HTTP timeout (`timeoutSeconds`, 30 seconds by default): that includes the URLs, the time to live (KBZ Pay's `timeToLiveMinutes` and Wave Pay's `timeToLiveSeconds`) and Yoma's webhook secret, and a missing or blank setting throws a `ConfigurationError` naming it:

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
    apiUrl: KbzPayConfig.PRODUCTION_API_URL,
    pwaUrl: KbzPayConfig.PRODUCTION_PWA_URL,
    timeToLiveMinutes: 15,
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

`timeoutSeconds` defaults to 30 seconds (`DEFAULT_TIMEOUT_SECONDS`) when unset, `null` or blank. Time settings take a whole number or its text. `timeoutSeconds` and Wave's `timeToLiveSeconds` must be greater than 0, and KBZ's `timeToLiveMinutes` must be 1 to 120. An invalid value throws `ConfigurationError`, e.g. `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

## Config Options

### KbzPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `apiUrl` | `string` | Yes | The API base URL, e.g. `KbzPayConfig.PRODUCTION_API_URL` |
| `pwaUrl` | `string` | Yes | The PWA checkout URL, e.g. `KbzPayConfig.PRODUCTION_PWA_URL`. Normalized to end with `/`, e.g. `…/pwa/#/` |
| `timeToLiveMinutes` | `number \| string` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment's own `timeToLiveMinutes` overrides it. Anything else throws `The kbz_pay configuration [time_to_live_in_minutes] must be a whole number from 1 to 120.` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Default `30` |

### WavePayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page. A payment can override it with `WavePayPaymentData`'s `merchantName` |
| `baseUrl` | `string` | Yes | The API base URL, e.g. `WavePayConfig.PRODUCTION_URL`. Payments are requested at its `/payment` |
| `baseRedirectUrl` | `string` | Yes | The host the customer is sent to, e.g. `WavePayConfig.PRODUCTION_URL`. The customer approves the payment at its `/authenticate` |
| `timeToLiveSeconds` | `number \| string` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WavePayPaymentData`'s `timeToLiveSeconds` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Default `30` |

### AyaPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `baseUrl` | `string` | Yes | The gateway base URL, e.g. `AyaPayConfig.PRODUCTION_URL` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Default `30` |

### YomaMmqrConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Yoma |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `apiVersion` | `string` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `webhookSecret` | `string` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `baseUrl` | `string` | Yes | The API base URL, e.g. `YomaMmqrConfig.PRODUCTION_URL` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Default `30` |

### CyberSourceConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `baseUrl` | `string` | Yes | The Secure Acceptance base URL, e.g. `CyberSourceConfig.PRODUCTION_URL` |

## Production Endpoints

URLs are required; set production's, the [UAT ones](#uat-endpoints) or a proxy's. `PRODUCTION_*` constants on the config classes name production's. Each config object exposes its URLs as read-only properties (`config.apiUrl`, `config.baseUrl`, …), trailing `/` removed (KBZ's `pwaUrl` always ends with `/`).

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

Every config class and gateway has `fromEnv(env)`, which reads `process.env` by default and takes any object of strings instead, such as a plain object in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```ts
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env);
// or
const config = KbzPayConfig.fromEnv(process.env);
const kbzFromConfig = new KbzPay(config);
```

Every variable is required unless it is marked optional. Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#uat-endpoints). The values after `=` are examples:

```env
# Every gateway that calls an API
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30      # optional, defaults to 30

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

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `timeout_in_seconds` for KBZ Pay, Wave Pay, AYA and Yoma MMQR. The package never reads files itself: load the `.env` file with your framework or with `node --env-file=.env` before `fromEnv()`.

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from its config, on first use, and reuses it. Only the gateways you call need to be configured:

```ts
import {
  KbzPayConfig,
  MyanmarPayments,
  YomaMmqrConfig,
} from '@laranex/myanmar-payments';

const payments = new MyanmarPayments({
  kbzPay: {
    appId: '...',
    appKey: '...',
    merchantCode: '...',
    apiUrl: KbzPayConfig.PRODUCTION_API_URL,
    pwaUrl: KbzPayConfig.PRODUCTION_PWA_URL,
    timeToLiveMinutes: 15,
  },
  yomaMmqr: {
    merchantId: '...',
    clientId: '...',
    clientSecret: '...',
    webhookHashKey: '...',
    apiVersion: 'v1rc',
    webhookSecret: '...',
    baseUrl: YomaMmqrConfig.PRODUCTION_URL,
  },
});

payments.kbzPay(); // KbzPay, the same instance on every call
// throws ConfigurationError:
// The wave_pay configuration is missing [merchant_id].
payments.wavePay();

// reads each gateway's variables on first use
const fromEnv = MyanmarPayments.fromEnv(process.env);
```

The keys `kbzPay`, `wavePay`, `ayaPay`, `yomaMmqr` and `cyberSource` take the config objects or plain options, and the second argument takes the `fetch`, `httpClient` and `tokenCache` options below, shared by every gateway it builds. Each gateway exposes its config as `gateway.config`.

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

Every method may be async. The default is a `MemoryTokenCache`, which lives as long as the process: create one `YomaMmqr` (or one `MyanmarPayments`) at startup and share it across requests; `clear()` empties it. When you run several processes, implement the interface on top of Redis:

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
