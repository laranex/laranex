---
title: Configuration
description: Configure Node Myanmar Payments with one config class per gateway or from environment variables. Every setting is required except the HTTP timeout, which defaults to 30 seconds; URLs and time to live included. Pass your own fetch, HTTP client and token cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes an options object. Gateways take the config object or the plain options. Every setting of a gateway you use is required and has no default, except the HTTP timeout (`timeoutSeconds`, 30 seconds by default): that includes the URLs, the time to live (KBZ Pay's `timeToLiveMinutes` and Wave Money's `timeToLiveSeconds`) and Yoma's webhook secret, and a missing or blank setting throws a `ConfigurationError` naming it:

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

`timeoutSeconds` is optional: when it is unset, `null` or blank, the default HTTP client gives up after 30 seconds (exported as `DEFAULT_TIMEOUT_SECONDS`). The time settings (`timeoutSeconds` when set, and Wave Money's `timeToLiveSeconds`) must be whole numbers greater than 0, and KBZ Pay's `timeToLiveMinutes` a whole number from 1 to 120. Any other value throws the same error with the message `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

## Endpoints

Every gateway URL is a required setting with no default. There is no switch between test and production: set production's URLs (see [Production Endpoints](#production-endpoints)) or the gateway's UAT ones (see [Testing Against UAT](#testing-against-uat)), or a proxy's. Each config object exposes the URL as a read-only property (`config.apiUrl`, `config.baseUrl`, …), without a trailing `/`.

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
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Defaults to `30` when unset or blank; an invalid one is reported as `timeout_in_seconds` |

### WaveMoneyConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page. A payment can override it with `WaveMoneyPaymentData`'s `merchantName` |
| `baseUrl` | `string` | Yes | The API base URL, e.g. `WaveMoneyConfig.PRODUCTION_URL`. Payments are requested at its `/payment` |
| `baseRedirectUrl` | `string` | Yes | The host the customer is sent to, e.g. `WaveMoneyConfig.PRODUCTION_URL`. The customer approves the payment at its `/authenticate` |
| `timeToLiveSeconds` | `number \| string` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WaveMoneyPaymentData`'s `timeToLiveSeconds` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Defaults to `30` when unset or blank; an invalid one is reported as `timeout_in_seconds` |

### AyaPayConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `baseUrl` | `string` | Yes | The gateway base URL, e.g. `AyaPayConfig.PRODUCTION_URL` |
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Defaults to `30` when unset or blank; an invalid one is reported as `timeout_in_seconds` |

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
| `timeoutSeconds` | `number \| string` | No | Seconds before the default HTTP client gives up. Defaults to `30` when unset or blank; an invalid one is reported as `timeout_in_seconds` |

### CyberSourceConfig

| Option | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `baseUrl` | `string` | Yes | The Secure Acceptance base URL, e.g. `CyberSourceConfig.PRODUCTION_URL` |

## Production Endpoints

| Gateway | URL |
|---|---|
| KBZ Pay API | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://payments.wavemoney.io` |
| Wave Money redirect | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://secureacceptance.cybersource.com` |

The URLs are named by static constants on the config classes, not used as defaults: `KbzPayConfig.PRODUCTION_API_URL`, `KbzPayConfig.PRODUCTION_PWA_URL`, `WaveMoneyConfig.PRODUCTION_URL` (both Wave URLs), and `PRODUCTION_URL` on `AyaPayConfig`, `YomaMmqrConfig` and `CyberSourceConfig`.

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URLs to the gateway's UAT endpoints instead of production's, together with the UAT credentials:

| Gateway | Variable | Config option | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `apiUrl` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `pwaUrl` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `baseUrl` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_BASE_REDIRECT_URL` | `baseRedirectUrl` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `baseUrl` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `baseUrl` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `baseUrl` | `https://testsecureacceptance.cybersource.com` |

## From Environment Variables

Every config class and gateway has `fromEnv(env)`, which reads `process.env` by default and takes any object of strings instead, such as a plain object in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```ts
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env);
// or
const config = KbzPayConfig.fromEnv(process.env);
const kbzFromConfig = new KbzPay(config);
```

Every variable is required unless it is marked optional. Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#testing-against-uat). The values after `=` are examples:

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

# Wave Money
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=
WAVE_MONEY_BASE_URL=                  # payments are requested at its /payment
WAVE_MONEY_BASE_REDIRECT_URL=         # the customer is sent to its /authenticate
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=900   # greater than 0

# AYA Payment Gateway (AYA_PGW_* names are read too)
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

`KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` and `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` are required too; a payment's own `timeToLiveMinutes` or `timeToLiveSeconds` overrides them.

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `timeout_in_seconds` for KBZ Pay, Wave Money, AYA and Yoma MMQR; unset or blank, it is 30 seconds. The package never reads files itself: load the `.env` file with your framework or with `node --env-file=.env` before `fromEnv()`.

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

A client you pass keeps its own timeout; the config's `timeoutSeconds` (30 seconds by default) only applies to the default client.

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
