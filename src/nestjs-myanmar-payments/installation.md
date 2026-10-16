---
title: Installation
description: Install NestJS Myanmar Payments from npm and register MyanmarPaymentsModule. Requires Node.js 20+ and NestJS 10 to 12 on Express or Fastify. Node Myanmar Payments comes in as a dependency.
---

# Installation

## Install the Package

> **Requires** Node.js 20+ and NestJS 10 to 12, on the Express (`@nestjs/platform-express`) or Fastify (`@nestjs/platform-fastify`) adapter.

```bash
npm install @laranex/nestjs-myanmar-payments@next
```

Until v4.0.0 is released the package ships `4.0.0-dev.*` pre-releases, so install the `next` tag.

The package is a thin NestJS layer over [`@laranex/myanmar-payments`](https://github.com/laranex/node-myanmar-payments), which npm installs alongside it.

## Register the Module

```ts
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';
import { Module } from '@nestjs/common';

@Module({
  imports: [MyanmarPaymentsModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

Registering the module provides `MyanmarPaymentsService`, which you inject into your own controllers and services. Options are optional: without them every value is read from environment variables. See [Configuration](/nestjs-myanmar-payments/configuration) for `forRootAsync()` with `@nestjs/config`.

## Keep the Raw Body

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

## What It Provides

| Export | What it is |
|---|---|
| `MyanmarPaymentsModule` | `forRoot()`, `forRootAsync()` |
| `MyanmarPaymentsService` | `kbzPay()`, `wavePay()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()`, `gateway(name)`, `handleCallback()`, `autoSubmitUrl()`, `resolveFormPayment()`, `tokenCache` |
| `@InjectKbzPay()`, `@InjectWavePay()`, `@InjectAyaPay()`, `@InjectYomaMmqr()`, `@InjectCyberSource()` | Inject one SDK gateway |
| `@VerifiedCallback()`, `@AcknowledgeCallback()`, `@RawCallback()` | Callback decorators; see [Callbacks & Status](/nestjs-myanmar-payments/callbacks#callback-helpers) |
| `VerifiedCallbackPipe`, `CallbackRequestPipe`, `AcknowledgementInterceptor` | The pipes and the interceptor behind those decorators; `AcknowledgementInterceptor` also works with `@UseInterceptors()` |
| `callbackRequestFrom()`, `acknowledge()` | Callback helpers for handlers that use `@Req()` and `@Res()` |
| `NestRequestLike`, `FastifyReplyLike` | The request and reply shapes those helpers accept (types) |
| `FormPaymentController` | The auto-submit form route's controller; the module mounts it at `formRoute.path` |
| `CacheManagerTokenCache`, `CacheManagerLike` | The Yoma token cache over `@nestjs/cache-manager`, and the cache shape it needs |
| `GATEWAY_NAMES`, `GatewayName` | `'kbz-pay'`, `'wave-pay'`, `'aya-pay'`, `'yoma-mmqr'`, `'cyber-source'` |
| `MyanmarPaymentsGateway` | `KbzPay \| WavePay \| AyaPay \| YomaMmqr \| CyberSource`, what `gateway(name)` returns (type) |
| `MYANMAR_PAYMENTS_OPTIONS`, `KBZ_PAY`, `WAVE_PAY`, `AYA_PAY`, `YOMA_MMQR`, `CYBER_SOURCE` | Injection tokens of the options and of each gateway |
| `DEFAULT_FORM_PATH` | `'myanmar-payments/form'` |
| `MyanmarPaymentsModuleOptions`, `MyanmarPaymentsModuleExtras`, `MyanmarPaymentsModuleRootOptions`, `MyanmarPaymentsModuleAsyncOptions`, `MyanmarPaymentsOptionsFactory`, `FormLinkOptions`, `FormRouteOptions`, `ConfigReader` | Option types; see [Configuration](/nestjs-myanmar-payments/configuration) |

Everything about payments themselves (`Amount`, payment data, results, `PaymentCallback`, `PaymentStatus`, errors) is imported from `@laranex/myanmar-payments`.

## Module Formats

The package ships ES modules and CommonJS with type declarations, like the SDK. NestJS 10 and 11 apps are usually CommonJS and load the `require` build; NestJS 12 is ESM-only and loads the `import` build. Both builds use the SDK build of the same format, so classes such as `PaymentCallback` are the ones your code imports.

## Without NestJS

Use the SDK directly: see [Node Myanmar Payments](/node-myanmar-payments/introduction).
