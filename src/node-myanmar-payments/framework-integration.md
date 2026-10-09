---
title: Framework Integration
description: Use Node Myanmar Payments with Express, Fastify, Next.js route handlers and Hono. Create gateways once, build the CallbackRequest from the raw body, and send the acknowledgement.
---

# Framework Integration

The package needs only two things from your framework: the raw incoming request for callbacks and a way to write the acknowledgement. Create each gateway once at startup (or one `MyanmarPayments`) and share it across requests, so Yoma's token cache stays warm.

| Framework | Build the request | Acknowledge |
|---|---|---|
| `node:http`, Express | `await CallbackRequest.fromNodeRequest(req)` | `callback.acknowledgement.send(res)` |
| Fastify | `CallbackRequest.from({ body, headers, query })` | `reply.code(ack.status).headers(ack.headers).send(ack.body)` |
| Next.js, Hono, Bun, Deno | `await CallbackRequest.fromWebRequest(request)` | `return callback.acknowledgement.toResponse()` |

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your framework applies.

## Express

Create the facade once, e.g. in `payments.ts`, and register the callback routes with `express.raw()` (or before any global `express.json()`), so the package reads the exact body the gateway sent:

```ts
// payments.ts
import { MyanmarPayments } from '@laranex/myanmar-payments';

export const payments = MyanmarPayments.fromEnv(process.env);
```

```ts
// app.ts
import express from 'express';
import {
  Amount,
  ApiError,
  AyaPayMethod,
  CallbackRequest,
  InvalidPaymentDataError,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';

import { payments } from './payments.js';

const app = express();
const raw = express.raw({ type: '*/*' });

app.get('/checkout/:orderId', (req, res) => {
  const payment = payments.ayaPay().initiate({
    orderId: `ORDER_${req.params.orderId}`,
    amount: Amount.kyat(10000),
    channel: 'aya_pay',
    method: AyaPayMethod.Qr,
    returnUrl: 'https://shop.test/payments/aya/return',
  });
  res.type('html').send(payment.toHtml());
});

app.post('/payments/kbz/callback', raw, async (req, res) => {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = payments.kbzPay().handleCallback(request);
  // fulfill callback.orderId when callback.isSuccessful()
  // and the amount matches
  callback.acknowledgement.send(res);
});

app.get('/payments/aya/return', async (req, res) => {
  const request = await CallbackRequest.fromNodeRequest(req);
  const result = payments.ayaPay().verifyRedirect(request);
  res.send(
    result.isSuccessful()
      ? 'Thank you, your payment was received.'
      : `Payment ${result.status}.`,
  );
});

app.get('/payments/kbz/status/:orderId', async (req, res) => {
  const orderId = `ORDER_${req.params.orderId}`;
  const result = await payments.kbzPay().status(orderId);
  res.json({ status: result.status });
});

app.use((
  error: unknown,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (error instanceof InvalidPaymentDataError) {
    return res.status(422).json({ errors: error.errors });
  }
  if (error instanceof SignatureVerificationError) {
    return res.status(400).send('invalid signature');
  }
  if (error instanceof ApiError) {
    return res.status(502).json({
      code: error.gatewayCode,
      message: error.gatewayMessage,
    });
  }
  next(error);
});
```

Express 5 passes errors thrown in `async` handlers to the error handler; on Express 4, wrap each handler in `try`/`catch` and call `next(error)`.

`fromNodeRequest` reads the buffer `express.raw()` leaves in `req.body`. If a global `express.json()` or `express.urlencoded()` already parsed the body, it encodes `req.body` again as JSON or a form. That usually verifies, but a JSON number such as `1000.50` comes back as `1000.5` and breaks a signature over the exact text, so `express.raw()` on callback routes is the safer setup.

## Fastify

Fastify parses bodies before your handler runs, so `request.raw` has no body left for `fromNodeRequest`. Keep the raw text for callback routes with a content-type parser, then build the request from its parts:

```ts
import Fastify from 'fastify';
import {
  CallbackRequest,
  MyanmarPayments,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';

const payments = MyanmarPayments.fromEnv(process.env);
const app = Fastify();

// Keep JSON and form bodies as strings;
// parse them yourself elsewhere if you need to.
app.addContentTypeParser(
  ['application/json', 'application/x-www-form-urlencoded'],
  { parseAs: 'string' },
  (request, body, done) => done(null, body),
);

app.post('/payments/wave/callback', async (request, reply) => {
  const callbackRequest = CallbackRequest.from({
    body: request.body as string,
    headers: request.headers,
    query: request.query as Record<string, string>,
  });

  try {
    const callback = payments.waveMoney().handleCallback(callbackRequest);
    // fulfill callback.orderId when callback.isSuccessful()
    // and the amount matches
    const ack = callback.acknowledgement;
    return reply.code(ack.status).headers(ack.headers).send(ack.body);
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      return reply.code(400).send('invalid signature');
    }
    throw error;
  }
});
```

Register the parser inside a plugin scoped to the callback routes when the rest of your app needs Fastify's default JSON parsing.

## Next.js

In an App Router route handler, read the Fetch `Request` and return the acknowledgement as a `Response`:

```ts
// app/payments/kbz/callback/route.ts
import {
  CallbackRequest,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';
// one MyanmarPayments instance for the app
import { payments } from '@/lib/payments';

export async function POST(request: Request): Promise<Response> {
  const callbackRequest = await CallbackRequest.fromWebRequest(request);
  try {
    const callback = payments.kbzPay().handleCallback(callbackRequest);
    // fulfill callback.orderId when callback.isSuccessful()
    // and the amount matches
    return callback.acknowledgement.toResponse();
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      return new Response('invalid signature', { status: 400 });
    }
    throw error;
  }
}
```

```ts
// app/checkout/route.ts
import { Amount } from '@laranex/myanmar-payments';
import { payments } from '@/lib/payments';

export async function GET(): Promise<Response> {
  const payment = await payments.kbzPay().pwa({
    orderId: 'ORDER_1',
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/kbz/callback',
  });
  return Response.redirect(payment.url, 302);
}
```

Route handlers run on the Node.js runtime by default, which the package needs for `node:crypto`; don't set `export const runtime = 'edge'` on these routes.

## Hono

Hono exposes the Fetch `Request` as `c.req.raw`:

```ts
import { Hono } from 'hono';
import {
  CallbackRequest,
  MyanmarPayments,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';

const payments = MyanmarPayments.fromEnv(process.env);
const app = new Hono();

app.post('/payments/yoma/callback', async (c) => {
  const request = await CallbackRequest.fromWebRequest(c.req.raw);
  try {
    const callback = payments.yomaMmqr().handleCallback(request);
    return callback.acknowledgement.toResponse();
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      return c.text('invalid signature', 400);
    }
    throw error;
  }
});

app.get('/payments/yoma/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  const payment = await payments.yomaMmqr().initiate({
    orderId: `ORDER_${orderId}`,
    amount: 10000,
    description: `Order #${orderId}`,
  });
  return c.html(`<img src="${payment.qrImageDataUri()}" alt="Scan to pay">`);
});
```

`fromWebRequest` reads a clone of the request, so the body stays readable for later middleware.

## Other Frameworks

For any other framework, build the request from its parts with `CallbackRequest.from({ body, headers, query })` (the raw body as a `string`, `Buffer` or `Uint8Array`, the headers as an object or `[name, value]` pairs, the query string as a `string`, `URLSearchParams` or an object), then write `ack.status`, `ack.headers` and `ack.body` with your framework's response API.

## Testing Your App

See [Testing](/node-myanmar-payments/testing) to replace the gateways' HTTP calls with a fake `fetch` or undici's `MockAgent`, replay signed callbacks and build `PaymentCallback` objects for your own code.
