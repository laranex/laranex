---
title: Configuration
description: Configure NestJS Myanmar Payments with forRoot or forRootAsync, the SDK's environment variables or ConfigService, per-gateway options, the HTTP client, the Yoma token cache and the auto-submit form route.
---

# Configuration

## Environment Variables

Every gateway left out of the module options is read with the SDK's `fromEnv` the first time it is used. The names are the ones the [Node SDK](/node-myanmar-payments/configuration#from-environment-variables) reads and the same as the Laravel, Goravel, PHP and Go packages, so one `.env` works for all of them.

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

`*_SANDBOX` defaults to `true` (UAT endpoints); set it to `false` together with production credentials when you go live. Only the gateways you call need credentials: a gateway with a missing credential throws the SDK's `ConfigurationError` (with `gateway` and `key`) when you first use it, never at startup.

Each gateway's credentials, endpoints and limits are described in the SDK's driver pages: [KBZ Pay](/node-myanmar-payments/drivers/kbz-pay), [Wave Money](/node-myanmar-payments/drivers/wave-money), [AYA Pay](/node-myanmar-payments/drivers/aya-pay), [Yoma MMQR](/node-myanmar-payments/drivers/yoma-mmqr) and [CyberSource](/node-myanmar-payments/drivers/cyber-source).

## forRoot

```ts
MyanmarPaymentsModule.forRoot(); // process.env
MyanmarPaymentsModule.forRoot({ env: { KBZ_PAY_APP_ID: '...', KBZ_PAY_APP_KEY: '...' } });
MyanmarPaymentsModule.forRoot({
  isGlobal: true,
  kbzPay: { appId: '...', appKey: '...', merchantCode: '...', sandbox: false },
});
```

## forRootAsync

With `@nestjs/config`, hand the `ConfigService` to `env`; the package reads each variable through `config.get()`, so values from `.env` files, `load` factories and validation all apply:

```ts
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
@Injectable()
class PaymentsConfig implements MyanmarPaymentsOptionsFactory {
  createMyanmarPaymentsOptions(): MyanmarPaymentsModuleOptions {
    return { env: process.env, timeoutMs: 10_000 };
  }
}

MyanmarPaymentsModule.forRootAsync({ useClass: PaymentsConfig });
```

## Options

| Option | Meaning |
|---|---|
| `env` | Where variables are read: `process.env` (default), a record, or anything with `get(key)` such as `ConfigService` |
| `kbzPay`, `waveMoney`, `ayaPay`, `yomaMmqr`, `cyberSource` | A gateway's config, as options (`{ appId, appKey, ... }`) or an SDK config instance (`new KbzPayConfig(...)`). Wins over the environment for that gateway; see the SDK's [config options](/node-myanmar-payments/configuration#config-options) |
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
| `formRoute` | `{ enabled, path }` of the auto-submit form route (default `{ enabled: true, path: 'myanmar-payments/form' }`) |

The options object is available under the `MYANMAR_PAYMENTS_OPTIONS` token.

## Token Cache

Yoma MMQR uses OAuth access tokens. When `@nestjs/cache-manager`'s `CacheModule` is registered globally, or passed in `forRootAsync`'s `imports`, tokens are kept in that cache (`CacheManagerTokenCache`), so every instance that shares the store (Redis, for example) also shares the token. Otherwise each process keeps its own token in memory.

```ts
@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    MyanmarPaymentsModule.forRoot(),
  ],
})
export class AppModule {}
```

Pass `useCacheManager: false` to keep tokens in memory anyway, or `tokenCache` to use your own `TokenCache`.

## Auto-Submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The module registers `GET /myanmar-payments/form`, which renders such a form and submits it, and `MyanmarPaymentsService.autoSubmitUrl(form)` builds links to it; see [Form payments](/nestjs-myanmar-payments/usage#form-payments-aya-pay-and-cybersource).

| Setting | Meaning |
|---|---|
| `formRoute.enabled` | Register the route. When `false`, `autoSubmitUrl()` throws |
| `formRoute.path` | The route path. The app's global prefix applies |
| `formLink.secret` | Encrypts the links (AES-256-GCM, key derived with HKDF-SHA256). Defaults to `MYANMAR_PAYMENTS_FORM_KEY`, then `APP_KEY`; a `base64:` prefix is decoded first |
| `formLink.ttlMinutes` | How long a link stays valid (default 30) |
| `formLink.baseUrl` | The scheme and host links start with. Defaults to `APP_URL`; without it links are relative |

Don't put authentication guards on the form route: the customer may arrive from a gateway or another device.
