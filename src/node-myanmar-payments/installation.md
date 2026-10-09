---
title: Installation
description: Install Node Myanmar Payments from npm. Requires Node.js 20+, ships ESM and CommonJS builds with TypeScript types, and has no runtime dependencies.
---

# Installation

## Via npm

> **Requires** Node.js 20+. No runtime dependencies: it uses the global `fetch` and `node:crypto`.

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

The package ships ES modules and CommonJS, each with its own TypeScript declarations, so `import` and `require` both work and TypeScript resolves the types under `node16`, `nodenext` and `bundler` module resolution.

```ts
// ES modules / TypeScript
import { Amount, CallbackRequest } from '@laranex/myanmar-payments';
import { KbzPay } from '@laranex/myanmar-payments/kbz-pay';
```

```js
// CommonJS
const { Amount, CallbackRequest } = require('@laranex/myanmar-payments');
const { KbzPay } = require('@laranex/myanmar-payments/kbz-pay');
```

The root entry exports everything. Each gateway also has its own subpath, which exports only that gateway's classes:

| Import path | Contents |
|---|---|
| `@laranex/myanmar-payments` | Everything below, plus `Amount`, results, `PaymentCallback`, `PaymentStatus`, `CallbackRequest`, `Acknowledgement`, errors, `HttpClient`, `FetchHttpClient`, `TokenCache`, `MemoryTokenCache` and the `MyanmarPayments` facade |
| `@laranex/myanmar-payments/kbz-pay` | `KbzPay`, `KbzPayConfig`, `KbzPaySigner` |
| `@laranex/myanmar-payments/wave-money` | `WaveMoney`, `WaveMoneyConfig` |
| `@laranex/myanmar-payments/aya-pay` | `AyaPay`, `AyaPayConfig`, `AyaPayMethod`, `AyaPayService` |
| `@laranex/myanmar-payments/yoma-mmqr` | `YomaMmqr`, `YomaMmqrConfig` |
| `@laranex/myanmar-payments/cyber-source` | `CyberSource`, `CyberSourceConfig`, `CyberSourceTransactionType` |

Both entries share the same modules, so `KbzPay` from the subpath and from the root are the same class.

## Quick Start

```ts
import { createServer } from 'node:http';
import {
  Amount,
  CallbackRequest,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';
import { KbzPay } from '@laranex/myanmar-payments/kbz-pay';

// Throws a ConfigurationError naming the missing setting
const kbz = KbzPay.fromEnv(process.env);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/checkout') {
    const payment = await kbz.pwa({
      orderId: 'ORDER_1',
      amount: Amount.kyat(1000),
      callbackUrl: 'https://shop.test/payments/kbz/callback',
    });
    res.writeHead(302, { Location: payment.url }).end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/payments/kbz/callback') {
    try {
      const request = await CallbackRequest.fromNodeRequest(req);
      const callback = kbz.handleCallback(request);
      if (callback.isSuccessful()) {
        // compare callback.amount with your order,
        // then fulfill callback.orderId
      }
      callback.acknowledgement.send(res); // KBZ Pay expects a plain "success"
    } catch (error) {
      const invalid = error instanceof SignatureVerificationError;
      res.writeHead(invalid ? 400 : 500).end();
    }
    return;
  }

  res.writeHead(404).end();
}).listen(8080);
```

See [Framework Integration](/node-myanmar-payments/framework-integration) for Express, Fastify, Next.js and Hono.
