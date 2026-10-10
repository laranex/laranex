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

The package is a thin NestJS layer over [`@laranex/myanmar-payments`](https://github.com/laranex/node-myanmar-payments), which npm installs alongside it. The SDK talks to gateways through `fetch`; the module passes your HTTP settings to every gateway, so a fake `fetch` works in your tests and no extra client is needed.

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

## Framework Services

The module works with whatever is registered:

| Service | Used for | Without it |
|---|---|---|
| `fetch` (global, or the `fetch` / `httpClient` option) | Gateway calls, so a fake `fetch` works in tests | Always available on Node.js 20+ |
| `@nestjs/cache-manager` | Sharing Yoma MMQR access tokens (Redis and so on) | An in-memory cache per process |
| `@nestjs/config` | `forRootAsync({ inject: [ConfigService], useFactory: (config) => ({ env: config }) })` | `process.env` or a plain record |
| `formLink.secret`, `MYANMAR_PAYMENTS_FORM_KEY` or `APP_KEY` | Encrypting auto-submit form links | `autoSubmitUrl()` throws a `ConfigurationError` |
| Nest's router | The auto-submit form route | Set `formRoute.enabled` to `false` and serve `toHtml()` yourself |

## What It Provides

| Export | What it is |
|---|---|
| `MyanmarPaymentsModule` | `forRoot()`, `forRootAsync()` |
| `MyanmarPaymentsService` | `kbzPay()`, `waveMoney()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()`, `gateway(name)`, `handleCallback()`, `autoSubmitUrl()`, `resolveFormPayment()`, `tokenCache` |
| `@InjectKbzPay()`, `@InjectWaveMoney()`, `@InjectAyaPay()`, `@InjectYomaMmqr()`, `@InjectCyberSource()` | Inject one SDK gateway |
| `@VerifiedCallback()`, `@AcknowledgeCallback()`, `@RawCallback()` | Callback decorators; see [Callbacks & Status](/nestjs-myanmar-payments/callbacks#callback-helpers) |
| `VerifiedCallbackPipe`, `CallbackRequestPipe`, `AcknowledgementInterceptor` | The pipes and the interceptor behind those decorators, for use with `@UsePipes()` / `@UseInterceptors()` directly |
| `callbackRequestFrom()`, `acknowledge()` | Callback helpers for handlers that use `@Req()` and `@Res()` |
| `NestRequestLike`, `FastifyReplyLike` | The request and reply shapes those helpers accept (types) |
| `FormPaymentController` | The auto-submit form route's controller; the module mounts it at `formRoute.path` |
| `CacheManagerTokenCache`, `CacheManagerLike` | The Yoma token cache over `@nestjs/cache-manager`, and the cache shape it needs |
| `GATEWAY_NAMES`, `GatewayName` | `'kbz-pay'`, `'wave-money'`, `'aya-pay'`, `'yoma-mmqr'`, `'cyber-source'` |
| `MyanmarPaymentsGateway` | `KbzPay \| WaveMoney \| AyaPay \| YomaMmqr \| CyberSource`, what `gateway(name)` returns (type) |
| `MYANMAR_PAYMENTS_OPTIONS`, `KBZ_PAY`, `WAVE_MONEY`, `AYA_PAY`, `YOMA_MMQR`, `CYBER_SOURCE` | Injection tokens of the options and of each gateway |
| `DEFAULT_FORM_PATH` | `'myanmar-payments/form'` |
| `MyanmarPaymentsModuleOptions`, `MyanmarPaymentsModuleExtras`, `MyanmarPaymentsModuleRootOptions`, `MyanmarPaymentsModuleAsyncOptions`, `MyanmarPaymentsOptionsFactory`, `FormLinkOptions`, `FormRouteOptions`, `ConfigReader` | Option types; see [Configuration](/nestjs-myanmar-payments/configuration) |

Everything about payments themselves (`Amount`, payment data, results, `PaymentCallback`, `PaymentStatus`, errors) is imported from `@laranex/myanmar-payments`.

## Module Formats

The package ships ES modules and CommonJS with type declarations, like the SDK. NestJS 10 and 11 apps are usually CommonJS and load the `require` build; NestJS 12 is ESM-only and loads the `import` build. Both builds use the SDK build of the same format, so classes such as `PaymentCallback` are the ones your code imports.

## Without NestJS

Plain Node.js projects can install the SDK directly and use the same gateways, payment data and results. See the [Node Myanmar Payments docs](/node-myanmar-payments/introduction) for the full guide.

```bash
npm install @laranex/myanmar-payments@next
```

```ts
import { CallbackRequest, KbzPay } from '@laranex/myanmar-payments';

const kbzPay = new KbzPay({
  appId: '...',
  appKey: '...',
  merchantCode: '...',
  timeoutSeconds: 30,
});

const payment = await kbzPay.pwa({
  orderId: `ORDER_${order.id}`,
  amount: 10000,
  callbackUrl: 'https://shop.test/payments/kbz/callback',
});

// In the callback endpoint (req and res are Node's request and response)
const request = await CallbackRequest.fromNodeRequest(req);
const callback = kbzPay.handleCallback(request);
callback.acknowledgement.send(res);
```

To build every gateway from one object, as this package's service does, use the SDK's `MyanmarPayments`; see [One Object for Every Gateway](/node-myanmar-payments/configuration#one-object-for-every-gateway).
