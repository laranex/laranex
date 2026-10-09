---
title: Installation
description: Install Node Myanmar Payments from npm. Requires Node.js 20+, ships ESM and CommonJS builds with TypeScript types, and has no runtime dependencies.
---

# Installation

## Via npm

> **Requires** Node.js 20+. No runtime dependencies: it sends the gateway requests with the global `fetch` and signs with `node:crypto`.

::: code-group

```bash [npm]
npm install @laranex/myanmar-payments
```

```bash [pnpm]
pnpm add @laranex/myanmar-payments
```

```bash [yarn]
yarn add @laranex/myanmar-payments
```

:::

The package is fully typed and ships ES modules and CommonJS, each with its own TypeScript declarations, so `import` and `require` both work and TypeScript resolves the types under `node16`, `nodenext` and `bundler` module resolution. Import everything from `@laranex/myanmar-payments`:

```ts
// ES modules / TypeScript
import { Amount, CallbackRequest, KbzPay } from '@laranex/myanmar-payments';
```

```js
// CommonJS
const {
  Amount,
  CallbackRequest,
  KbzPay,
} = require('@laranex/myanmar-payments');
```

The root entry exports every public name. Each gateway also has its own subpath, which exports only that gateway's classes:

| Import path | Contents |
|---|---|
| `@laranex/myanmar-payments` | Everything below, plus `Amount`, results, `PaymentCallback`, `PaymentStatus`, `CallbackRequest`, `Acknowledgement`, errors, `HttpClient`, `FetchHttpClient`, `TokenCache`, `MemoryTokenCache` and the `MyanmarPayments` facade |
| `@laranex/myanmar-payments/kbz-pay` | `KbzPay`, `KbzPayConfig`, `KbzPaySigner` |
| `@laranex/myanmar-payments/wave-money` | `WaveMoney`, `WaveMoneyConfig` |
| `@laranex/myanmar-payments/aya-pay` | `AyaPay`, `AyaPayConfig`, `AyaPayMethod`, `AyaPayService` |
| `@laranex/myanmar-payments/yoma-mmqr` | `YomaMmqr`, `YomaMmqrConfig` |
| `@laranex/myanmar-payments/cyber-source` | `CyberSource`, `CyberSourceConfig`, `CyberSourceTransactionType` |

Both paths name the same classes, so `KbzPay` from the subpath and from the root are the same class.

## Quick Start

A `node:http` app that starts a KBZ Pay PWA payment and verifies the callback:

```ts
import { createServer } from 'node:http';
import {
  Amount,
  CallbackRequest,
  KbzPay,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';

// Throws a ConfigurationError naming the missing setting
const kbz = KbzPay.fromEnv(process.env);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/checkout') {
    const payment = await kbz.pwa({
      orderId: 'ORDER_1',
      amount: Amount.kyat(10000),
      callbackUrl: 'https://shop.test/payments/kbz/callback',
    });
    res.writeHead(302, { Location: payment.url }).end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/payments/kbz/callback') {
    let callback;
    try {
      callback = kbz.handleCallback(
        await CallbackRequest.fromNodeRequest(req),
      );
    } catch (error) {
      if (!(error instanceof SignatureVerificationError)) throw error;
      res.writeHead(400).end('invalid callback');
      return;
    }

    if (callback.isSuccessful()) {
      // compare callback.amount with your order,
      // then fulfill callback.orderId
    }

    callback.acknowledgement.send(res); // KBZ Pay expects a plain "success"
    return;
  }

  res.writeHead(404).end();
}).listen(8080);
```

See [Framework Integration](/node-myanmar-payments/framework-integration) for Express, Fastify, Next.js and Hono.

## Using NestJS?

Install [`@laranex/nestjs-myanmar-payments`](/nestjs-myanmar-payments/introduction) instead. It wraps this package in a NestJS module with an injectable service, callback helpers for Express and Fastify and an auto-submit form route.
