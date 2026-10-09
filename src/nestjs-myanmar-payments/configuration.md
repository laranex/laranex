---
title: Configuration
description: Configure NestJS Myanmar Payments with environment variables or module options. Each gateway has a sandbox switch that selects its UAT endpoints; only the gateways you use need credentials.
---

# Configuration

## Environment Variables

Add only the keys of the gateways you use. A gateway is configured the first time you call it, and a missing credential throws a `ConfigurationError` naming the key.

Every gateway has a `*_SANDBOX` switch (default `true`) that selects its UAT endpoints. It accepts `true`, `1`, `t`, `yes`, `on` or `false`, `0`, `f`, `no`, `off` in any case; anything else keeps the sandbox. A `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` of zero or less falls back to `300`. Set it to `false` together with production credentials when you go live. The `*_BASE_URL` style variables are optional overrides.

```env
# KBZ Pay
KBZ_PAY_SANDBOX=true
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional API URL override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional PWA URL override

# Wave Money
WAVE_MONEY_SANDBOX=true
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=             # defaults to APP_NAME
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional
WAVE_MONEY_AUTHENTICATE_URL=          # optional customer redirect host override

# AYA Payment Gateway (AYA_PGW_* names are accepted as fallbacks)
AYA_PAY_SANDBOX=true
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional

# Yoma MMQR
YOMA_MMQR_SANDBOX=true
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
# optional, checks the X-Webhook-Secret header
YOMA_MMQR_WEBHOOK_SECRET=
YOMA_MMQR_BASE_URL=                   # optional override
YOMA_MMQR_API_VERSION=v1rc

# CyberSource Secure Acceptance
CYBER_SOURCE_SANDBOX=true
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional

# Package
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30
# encrypts auto-submit form links, falls back to APP_KEY
MYANMAR_PAYMENTS_FORM_KEY=
# scheme and host of auto-submit form links
APP_URL=
```

The names are the ones the [Node SDK](/node-myanmar-payments/configuration) reads and the same as the Laravel and Goravel packages, so one `.env` works for all of them. The module reads them from `process.env` unless you pass `env` (a record or `ConfigService`).

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

Overriding a base URL (e.g. to go through a proxy) does not switch the environment: keep `*_SANDBOX` in line with the credentials and host you use, so the other endpoints of that gateway (such as Wave's authenticate redirect or KBZ's PWA page) match.

## Module Options

### forRoot

```ts
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';

MyanmarPaymentsModule.forRoot(); // process.env
MyanmarPaymentsModule.forRoot({
  env: { KBZ_PAY_APP_ID: '...', KBZ_PAY_APP_KEY: '...' },
});
MyanmarPaymentsModule.forRoot({
  isGlobal: true,
  kbzPay: {
    appId: '...',
    appKey: '...',
    merchantCode: '...',
    sandbox: false,
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
    return { env: process.env, timeoutMs: 10_000 };
  }
}

MyanmarPaymentsModule.forRootAsync({ useClass: PaymentsConfig });
```

### Options

| Option | Meaning |
|---|---|
| `env` | Where variables are read: `process.env` (default), a record, or anything with `get(key)` such as `ConfigService` |
| `kbzPay`, `waveMoney`, `ayaPay`, `yomaMmqr`, `cyberSource` | A gateway's config, as options (`{ appId, appKey, ... }`) or an SDK config instance (`new KbzPayConfig(...)`). Wins over the environment for that gateway; see the SDK's [config options](/node-myanmar-payments/configuration) |
| `fetch` | The `fetch` gateways call, e.g. a fake one in tests |
| `httpClient` | An SDK `HttpClient`; takes precedence over `fetch` and `timeoutMs` |
| `timeoutMs` | Milliseconds before a gateway call is aborted. Defaults to `MYANMAR_PAYMENTS_HTTP_TIMEOUT` (seconds), then 30 seconds |
| `tokenCache` | An SDK `TokenCache` for Yoma MMQR access tokens |
| `useCacheManager` | Use `@nestjs/cache-manager` for the tokens when it is available (default `true`) |
| `formLink` | `secret`, `ttlMinutes` and `baseUrl` of the auto-submit form links |

Extras, given to `forRoot()` and `forRootAsync()` directly (never through a factory):

| Extra | Meaning |
|---|---|
| `isGlobal` | Register the module globally (default `false`) |
| `formRoute` | `{ enabled, path, guards }` of the auto-submit form route (default `{ enabled: true, path: 'myanmar-payments/form' }`) |

The options object is available under the `MYANMAR_PAYMENTS_OPTIONS` token.

## HTTP Client

Gateway calls go through the SDK's `fetch` client with `timeoutMs` (default `MYANMAR_PAYMENTS_HTTP_TIMEOUT` seconds, then 30 seconds). Pass `fetch` to replace the function it calls, for example a fake one in tests, or `httpClient` to send requests yourself (proxies, tracing, retries); see [Testing](/nestjs-myanmar-payments/testing#faking-gateway-calls). When a gateway can't be reached, the call throws `ApiError` with `httpStatus` `0`.

## Auto-submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The module registers a `GET myanmar-payments/form` route that renders that form and submits it, and `MyanmarPaymentsService.autoSubmitUrl(form)` returns an encrypted link to it. Links expire after `formLink.ttlMinutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store`.

| Setting | Meaning |
|---|---|
| `formRoute.enabled` | Register the route (default `true`). When `false`, `autoSubmitUrl()` throws |
| `formRoute.path` | The route path (default `myanmar-payments/form`). The app's global prefix applies |
| `formRoute.guards` | Guards for the route, classes or instances, e.g. a rate-limiting `ThrottlerGuard`. Don't add authentication: the customer may be redirected from a gateway or another device |
| `formLink.secret` | Encrypts the links (AES-256-GCM, key derived with HKDF-SHA256). Defaults to `MYANMAR_PAYMENTS_FORM_KEY`, then `APP_KEY`; a `base64:` prefix is decoded first |
| `formLink.ttlMinutes` | How long a link stays valid (default 30). Must be a positive number; otherwise `autoSubmitUrl()` throws a `RangeError` |
| `formLink.baseUrl` | The scheme and host links start with. Defaults to `APP_URL`; without it links are relative |

Links are encrypted with the form link secret and start with `formLink.baseUrl` or `APP_URL`. Set `formRoute.enabled` to `false` to drop the route and build the form yourself, see [Form Payments](/nestjs-myanmar-payments/payment-flows#form-payments).

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. When `@nestjs/cache-manager`'s `CacheModule` is registered globally, or passed in `forRootAsync`'s `imports`, they are kept in that cache (`CacheManagerTokenCache`); otherwise each process keeps its own token in memory. Use a shared store (Redis, for example) when you run more than one server.

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
