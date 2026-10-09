---
title: Installation
description: Install NestJS Myanmar Payments from npm and register MyanmarPaymentsModule. Node Myanmar Payments comes in as a dependency.
---

# Installation

> **Requires** Node.js 20+ and NestJS 10, 11 or 12 on the Express (`@nestjs/platform-express`) or Fastify (`@nestjs/platform-fastify`) adapter. The SDK, [Node Myanmar Payments](/node-myanmar-payments/introduction), comes in as a dependency.

```bash
npm install @laranex/nestjs-myanmar-payments@next
```

Until v4.0.0 is released the package ships `4.0.0-dev.*` pre-releases, so install the `next` tag.

## Register the module

```ts
import { Module } from '@nestjs/common';
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';

@Module({
  imports: [MyanmarPaymentsModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

Without options every gateway reads the SDK's environment variables when it is first used; see [Configuration](/nestjs-myanmar-payments/configuration) for `forRootAsync()` with `@nestjs/config`.

## Keep the raw body

Gateway signatures are computed over the exact bytes they send. Create the app with `rawBody: true` so the package can verify against them:

```ts
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const app = await NestFactory.create(AppModule, { rawBody: true });
```

```ts
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
  { rawBody: true },
);
```

Without it the package falls back to the unread request stream (Express) or encodes the parsed body again. That still verifies for every gateway's documented payloads, but re-encoded JSON can change how numbers are written, so `rawBody: true` is the safe setting.

## Module formats

The package ships ES modules and CommonJS with type declarations, like the SDK. NestJS 10 and 11 apps are usually CommonJS and load the `require` build; NestJS 12 is ESM-only and loads the `import` build. Both builds use the SDK build of the same format, so classes such as `PaymentCallback` are the ones your code imports.

## Optional integrations

| Package | Used for | Without it |
|---|---|---|
| `@nestjs/config` | `forRootAsync({ inject: [ConfigService], useFactory: (config) => ({ env: config }) })` | `process.env` or a plain record |
| `@nestjs/cache-manager` | Sharing Yoma MMQR access tokens through Nest's cache (Redis and so on) | An in-memory cache per process |

## What it exports

| Export | What it is |
|---|---|
| `MyanmarPaymentsModule` | `forRoot()`, `forRootAsync()` |
| `MyanmarPaymentsService` | `kbzPay()`, `waveMoney()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()`, `gateway(name)`, `handleCallback()`, `autoSubmitUrl()`, `resolveFormPayment()`, `tokenCache` |
| `@InjectKbzPay()`, `@InjectWaveMoney()`, `@InjectAyaPay()`, `@InjectYomaMmqr()`, `@InjectCyberSource()` | Inject one SDK gateway |
| `@VerifiedCallback()`, `@AcknowledgeCallback()`, `@RawCallback()` | Callback decorators; see [Callbacks](/nestjs-myanmar-payments/callbacks) |
| `VerifiedCallbackPipe`, `CallbackRequestPipe`, `AcknowledgementInterceptor` | The pipes and the interceptor behind those decorators, for use with `@UsePipes()` / `@UseInterceptors()` directly |
| `callbackRequestFrom()`, `acknowledge()` | Callback helpers for handlers that use `@Req()` and `@Res()` |
| `NestRequestLike`, `FastifyReplyLike` | The request and reply shapes those helpers accept (types) |
| `FormPaymentController` | The auto-submit form route's controller; the module mounts it at `formRoute.path` |
| `CacheManagerTokenCache`, `CacheManagerLike` | The Yoma token cache over `@nestjs/cache-manager`, and the cache shape it needs |
| `GATEWAY_NAMES`, `GatewayName` | `'kbz-pay'`, `'wave-money'`, `'aya-pay'`, `'yoma-mmqr'`, `'cyber-source'` |
| `MyanmarPaymentsGateway` | `KbzPay \| WaveMoney \| AyaPay \| YomaMmqr \| CyberSource`, what `gateway(name)` returns (type) |
| `MYANMAR_PAYMENTS_OPTIONS`, `KBZ_PAY`, `WAVE_MONEY`, `AYA_PAY`, `YOMA_MMQR`, `CYBER_SOURCE` | Injection tokens of the options and of each gateway |
| `DEFAULT_FORM_PATH`, `DEFAULT_FORM_TTL_MINUTES` | `'myanmar-payments/form'` and `30` |
| `MyanmarPaymentsModuleOptions`, `MyanmarPaymentsModuleExtras`, `MyanmarPaymentsModuleRootOptions`, `MyanmarPaymentsModuleAsyncOptions`, `MyanmarPaymentsOptionsFactory`, `FormLinkOptions`, `FormRouteOptions`, `ConfigReader` | Option types; see [Configuration](/nestjs-myanmar-payments/configuration) |

Everything about payments themselves (`Amount`, payment data, results, `PaymentCallback`, `PaymentStatus`, errors) is imported from `@laranex/myanmar-payments`.
