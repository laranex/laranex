---
title: Configuration
description: Configure NestJS Myanmar Payments with environment variables or module options. Every setting of the gateways you use is required except the HTTP timeout, which defaults to 30 seconds; URLs and time to live included.
---

# Configuration

## Environment Variables

Add the keys of the gateways you use. Every setting of those gateways is required and has no default, except the HTTP timeout (`MYANMAR_PAYMENTS_HTTP_TIMEOUT`, 30 seconds when unset or blank). That includes the URLs, the time to live (`KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` and `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS`) and Yoma's webhook secret. A gateway is configured the first time you call it, and a missing or blank setting throws a `ConfigurationError` naming it, e.g. `The kbz_pay configuration is missing [app_key].` The time settings must be whole numbers greater than 0 (KBZ Pay's time to live from 1 to 120); any other value throws the same error with the message `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

The variable names are the ones the [Node SDK](/node-myanmar-payments/configuration) reads and the same as the Laravel and Goravel packages, so one `.env` works for all of them. The module reads them from `process.env` unless you pass `env` (a record or `ConfigService`). Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#testing-against-uat). The values after `=` are examples:

```env
# Every gateway that calls an API (all but CyberSource)
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30      # optional, defaults to 30
# AYA Pay and CyberSource, while the form route is enabled
MYANMAR_PAYMENTS_FORM_TTL_MINUTES=30
# optional, encrypts form links, falls back to APP_KEY
MYANMAR_PAYMENTS_FORM_KEY=
# optional, scheme and host of form links
APP_URL=

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

# CyberSource Secure Acceptance
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=
```

## Settings

| Variable | Module option | Required | Description |
|---|---|---|---|
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `timeoutSeconds` of `kbzPay`, `waveMoney`, `ayaPay` and `yomaMmqr` | No | Seconds before a gateway call gives up. Read by every gateway except CyberSource; defaults to `30` when unset or blank, and an invalid one is reported as `timeout_in_seconds` |
| `MYANMAR_PAYMENTS_FORM_TTL_MINUTES` | `formLink.ttlMinutes` | Yes | Minutes an auto-submit form link stays valid. Needed by AYA Pay and CyberSource while the form route is enabled |
| `MYANMAR_PAYMENTS_FORM_KEY` | `formLink.secret` | No | Encrypts form links; falls back to `APP_KEY`. At least 32 bytes, e.g. `base64:` followed by 32 random bytes in base64 |
| `APP_URL` | `formLink.baseUrl` | No | The scheme and host form links start with |
| `KBZ_PAY_APP_ID` | `kbzPay.appId` | Yes | `appid` issued by KBZ |
| `KBZ_PAY_APP_KEY` | `kbzPay.appKey` | Yes | Secret key used to sign requests |
| `KBZ_PAY_MERCHANT_CODE` | `kbzPay.merchantCode` | Yes | `merch_code` issued by KBZ |
| `KBZ_PAY_BASE_URL` | `kbzPay.apiUrl` | Yes | The API base URL, e.g. `KbzPayConfig.PRODUCTION_API_URL` |
| `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbzPay.pwaUrl` | Yes | The PWA checkout URL, e.g. `KbzPayConfig.PRODUCTION_PWA_URL` |
| `KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` | `kbzPay.timeToLiveMinutes` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment can override it with `KbzPayPaymentData`'s `timeToLiveMinutes` |
| `WAVE_MONEY_MERCHANT_ID` | `waveMoney.merchantId` | Yes | Merchant ID issued by Wave |
| `WAVE_MONEY_SECRET_KEY` | `waveMoney.secretKey` | Yes | Hash secret key issued by Wave |
| `WAVE_MONEY_MERCHANT_NAME` | `waveMoney.merchantName` | Yes | Shown on Wave's payment page. A payment can override it with `WaveMoneyPaymentData`'s `merchantName` |
| `WAVE_MONEY_BASE_URL` | `waveMoney.baseUrl` | Yes | The API base URL, e.g. `WaveMoneyConfig.PRODUCTION_URL`. Payments are requested at its `/payment` |
| `WAVE_MONEY_BASE_REDIRECT_URL` | `waveMoney.baseRedirectUrl` | Yes | The host the customer is sent to, e.g. `WaveMoneyConfig.PRODUCTION_URL`. The customer approves the payment at its `/authenticate` |
| `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` | `waveMoney.timeToLiveSeconds` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WaveMoneyPaymentData`'s `timeToLiveSeconds` |
| `AYA_PAY_APP_KEY` | `ayaPay.appKey` | Yes | Public application key |
| `AYA_PAY_APP_SECRET` | `ayaPay.appSecret` | Yes | Secret used for checksums |
| `AYA_PAY_BASE_URL` | `ayaPay.baseUrl` | Yes | The gateway base URL, e.g. `AyaPayConfig.PRODUCTION_URL` |
| `YOMA_MMQR_MERCHANT_ID` | `yomaMmqr.merchantId` | Yes | Merchant ID issued by Yoma |
| `YOMA_MMQR_CLIENT_ID` | `yomaMmqr.clientId` | Yes | OAuth client ID |
| `YOMA_MMQR_CLIENT_SECRET` | `yomaMmqr.clientSecret` | Yes | OAuth client secret |
| `YOMA_MMQR_WEBHOOK_HASHKEY` | `yomaMmqr.webhookHashKey` | Yes | Hash key issued by Yoma for verifying callbacks |
| `YOMA_MMQR_API_VERSION` | `yomaMmqr.apiVersion` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `YOMA_MMQR_WEBHOOK_SECRET` | `yomaMmqr.webhookSecret` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `YOMA_MMQR_BASE_URL` | `yomaMmqr.baseUrl` | Yes | The API base URL, e.g. `YomaMmqrConfig.PRODUCTION_URL` |
| `CYBER_SOURCE_PROFILE_ID` | `cyberSource.profileId` | Yes | Secure Acceptance profile ID |
| `CYBER_SOURCE_ACCESS_KEY` | `cyberSource.accessKey` | Yes | Profile access key |
| `CYBER_SOURCE_SECRET_KEY` | `cyberSource.secretKey` | Yes | Profile secret key used to sign fields |
| `CYBER_SOURCE_BASE_URL` | `cyberSource.baseUrl` | Yes | The Secure Acceptance base URL, e.g. `CyberSourceConfig.PRODUCTION_URL` |

Only the gateways you call need their settings: an app that only uses KBZ Pay never reads the Wave Money keys. A gateway option object passed to the module wins over the environment for that gateway and needs every required setting.

## Endpoints

Every gateway URL is a required setting with no default. There is no switch between test and production: set production's URLs (see [Production Endpoints](#production-endpoints)) or the gateway's UAT ones (see [Testing Against UAT](#testing-against-uat)), or a proxy's.

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

The SDK's config classes name these URLs with constants, not used as defaults: `KbzPayConfig.PRODUCTION_API_URL`, `KbzPayConfig.PRODUCTION_PWA_URL`, `WaveMoneyConfig.PRODUCTION_URL` (both Wave URLs), and `PRODUCTION_URL` on `AyaPayConfig`, `YomaMmqrConfig` and `CyberSourceConfig`. Quote the KBZ PWA URL in `.env`, because of its `#`:

```env
# Production
KBZ_PAY_BASE_URL=https://api.kbzpay.com/payment/gateway
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://wap.kbzpay.com/pgw/pwa/#/"
WAVE_MONEY_BASE_URL=https://payments.wavemoney.io
WAVE_MONEY_BASE_REDIRECT_URL=https://payments.wavemoney.io
AYA_PAY_BASE_URL=https://pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://paymenthubapi.yomabank.com
CYBER_SOURCE_BASE_URL=https://secureacceptance.cybersource.com
```

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URLs to the gateway's UAT endpoints instead of production's, together with the UAT credentials:

| Gateway | Variable | Module option | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `kbzPay.apiUrl` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbzPay.pwaUrl` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `waveMoney.baseUrl` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_BASE_REDIRECT_URL` | `waveMoney.baseRedirectUrl` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `ayaPay.baseUrl` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `yomaMmqr.baseUrl` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `cyberSource.baseUrl` | `https://testsecureacceptance.cybersource.com` |

Wave Money's URLs are used as they are, port included: payments are requested at the base URL's `/payment` and the customer is sent to the base redirect URL's `/authenticate`. Switch to production's URLs and credentials when you go live. Quote the KBZ PWA URL in `.env`, because of its `#`:

```env
# UAT
KBZ_PAY_BASE_URL=http://api-uat.kbzpay.com/payment/gateway/uat
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://static.kbzpay.com/pgw/uat/pwa/#/"
WAVE_MONEY_BASE_URL=https://preprodpayments.wavemoney.io:8107
WAVE_MONEY_BASE_REDIRECT_URL=https://preprodpayments.wavemoney.io
AYA_PAY_BASE_URL=https://uat-pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://devapi.yomabank.net
CYBER_SOURCE_BASE_URL=https://testsecureacceptance.cybersource.com
```

## Module Options

### forRoot

```ts
import { KbzPayConfig } from '@laranex/myanmar-payments';
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';

MyanmarPaymentsModule.forRoot(); // process.env
MyanmarPaymentsModule.forRoot({
  env: {
    KBZ_PAY_APP_ID: '...',
    KBZ_PAY_APP_KEY: '...',
    KBZ_PAY_MERCHANT_CODE: '...',
    KBZ_PAY_BASE_URL: 'https://api.kbzpay.com/payment/gateway',
    KBZ_PAY_PWA_BASE_REDIRECT_URL: 'https://wap.kbzpay.com/pgw/pwa/#/',
    KBZ_PAY_TIME_TO_LIVE_IN_MINUTES: '15',
  },
});
MyanmarPaymentsModule.forRoot({
  isGlobal: true,
  kbzPay: {
    appId: '...',
    appKey: '...',
    merchantCode: '...',
    apiUrl: KbzPayConfig.PRODUCTION_API_URL,
    pwaUrl: KbzPayConfig.PRODUCTION_PWA_URL,
    timeToLiveMinutes: 15,
  },
});
```

### forRootAsync

With `@nestjs/config`, hand the `ConfigService` to `env`; the package reads each variable through `config.get()`, so values from `.env` files, `load` factories and validation all apply:

```ts
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';
import { ConfigModule, ConfigService } from '@nestjs/config';

MyanmarPaymentsModule.forRootAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ env: config }),
});
```

`useClass` and `useExisting` take a class implementing `MyanmarPaymentsOptionsFactory`:

```ts
import {
  MyanmarPaymentsModule,
  type MyanmarPaymentsModuleOptions,
  type MyanmarPaymentsOptionsFactory,
} from '@laranex/nestjs-myanmar-payments';
import { Injectable } from '@nestjs/common';

@Injectable()
class PaymentsConfig implements MyanmarPaymentsOptionsFactory {
  createMyanmarPaymentsOptions(): MyanmarPaymentsModuleOptions {
    return { env: process.env, formLink: { ttlMinutes: 15 } };
  }
}

MyanmarPaymentsModule.forRootAsync({ useClass: PaymentsConfig });
```

### Options

| Option | Meaning |
|---|---|
| `env` | Where variables are read: `process.env` (default), a record, or anything with `get(key)` such as `ConfigService` |
| `kbzPay`, `waveMoney`, `ayaPay`, `yomaMmqr`, `cyberSource` | A gateway's config, as options (`{ appId, appKey, ... }`) or an SDK config instance (`new KbzPayConfig(...)`). Wins over the environment for that gateway and needs every required setting (`timeoutSeconds` is optional, 30 seconds by default); see the SDK's [config options](/node-myanmar-payments/configuration) |
| `fetch` | The `fetch` gateways call, e.g. a fake one in tests |
| `httpClient` | An SDK `HttpClient`; takes precedence over `fetch` and keeps its own timeout (the config's `timeoutSeconds` only applies to the default client) |
| `tokenCache` | An SDK `TokenCache` for Yoma MMQR access tokens |
| `useCacheManager` | Use `@nestjs/cache-manager` for the tokens when it is available (default `true`) |
| `formLink` | `secret`, `ttlMinutes` and `baseUrl` of the auto-submit form links |

Extras, given to `forRoot()` and `forRootAsync()` directly (never through a factory):

| Extra | Meaning |
|---|---|
| `isGlobal` | Register the module globally (default `false`) |
| `formRoute` | `{ enabled, path, guards, nonce }` of the auto-submit form route (default `{ enabled: true, path: 'myanmar-payments/form' }`) |

The options object is available under the `MYANMAR_PAYMENTS_OPTIONS` token.

## HTTP Client

Gateway calls go through the SDK's `fetch` client with each gateway's `timeoutSeconds`, read from `MYANMAR_PAYMENTS_HTTP_TIMEOUT` (optional; unset or blank means 30 seconds, and an invalid value throws `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` when you first call KBZ Pay). Pass `fetch` to replace the function it calls, for example a fake one in tests, or `httpClient` to send requests yourself (proxies, tracing, retries); see [Testing](/nestjs-myanmar-payments/testing#faking-gateway-calls). When a gateway can't be reached, the call throws `ApiError` with `httpStatus` `0`.

## Auto-submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The module registers a `GET myanmar-payments/form` route that renders that form and submits it, and `MyanmarPaymentsService.autoSubmitUrl(form)` returns an encrypted link to it. Links expire after `formLink.ttlMinutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store` and `Referrer-Policy: strict-origin`, so the gateway only sees your origin, never the encrypted link.

| Setting | Meaning |
|---|---|
| `formRoute.enabled` | Register the route (default `true`). When `false`, `autoSubmitUrl()` throws |
| `formRoute.path` | The route path (default `myanmar-payments/form`). The app's global prefix applies |
| `formRoute.guards` | Guards for the route, classes or instances, e.g. a rate-limiting `ThrottlerGuard`. Don't add authentication: the customer may be redirected from a gateway or another device |
| `formRoute.nonce` | `(request, response) => string \| undefined` returning the Content Security Policy nonce for the page's inline script. Defaults to helmet's nonce: `res.locals.cspNonce` on Express, `reply.cspNonce.script` on Fastify (`@fastify/helmet`). Without a nonce the script has none |
| `formLink.secret` | Encrypts the links (AES-256-GCM, key derived with HKDF-SHA256). Defaults to `MYANMAR_PAYMENTS_FORM_KEY`, then `APP_KEY`; a `base64:` prefix is decoded first. Must be at least 32 bytes after decoding: a shorter one makes `autoSubmitUrl()` throw a `ConfigurationError` naming the setting it came from, e.g. `The myanmar_payments configuration [MYANMAR_PAYMENTS_FORM_KEY] must be at least 32 bytes, e.g. base64: followed by 32 random bytes in base64.` |
| `formLink.ttlMinutes` | Minutes a link stays valid. Defaults to `MYANMAR_PAYMENTS_FORM_TTL_MINUTES`; required, no default. Without it `autoSubmitUrl()` throws `The form_route configuration is missing [ttl_minutes].`, and the invalid-value message for a value that is not a whole number greater than 0 |
| `formLink.baseUrl` | The scheme and host links start with. Defaults to `APP_URL`; without it links are relative |

Links are encrypted with the form link secret and start with `formLink.baseUrl` or `APP_URL`. Set `formRoute.enabled` to `false` to drop the route and build the form yourself, see [Form Payments](/nestjs-myanmar-payments/payment-flows#form-payments).

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. When `@nestjs/cache-manager`'s `CacheModule` is registered globally, or passed in `forRootAsync`'s `imports`, they are kept in that cache (`CacheManagerTokenCache`); otherwise each process keeps its own token in memory. Use a shared store (Redis, for example) when you run more than one server. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseUrl|clientId)>`, the same key in every Laranex SDK, so services written in different languages can share one store.

```ts
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    MyanmarPaymentsModule.forRoot(),
  ],
})
export class AppModule {}
```

Pass `useCacheManager: false` to keep tokens in memory anyway, or `tokenCache` to use your own `TokenCache`.
