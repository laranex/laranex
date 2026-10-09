---
title: Framework Integration
description: Use Node Myanmar Payments with Express, Fastify, Next.js route handlers and Hono. Create gateways once, read the raw callback body, and send the acknowledgement.
---

# Framework Integration

The package needs only two things from your framework: the incoming request for callbacks and a way to write the acknowledgement. Create each gateway once at startup (or one `MyanmarPayments`) and share it across requests, so Yoma's token cache stays warm.

| Framework | Build the request | Acknowledge |
|---|---|---|
| `node:http` | `CallbackRequest.fromNodeRequest(req)` | `callback.acknowledgement.send(res)` |
| Express | `CallbackRequest.fromNodeRequest(req)` | `callback.acknowledgement.send(res)` |
| Fastify | `CallbackRequest.from({ body, headers, query })` | `reply.code(ack.status).headers(ack.headers).send(ack.body)` |
| Next.js, Hono, Bun, Deno | `CallbackRequest.fromWebRequest(request)` | `return callback.acknowledgement.toResponse()` |

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your middleware applies.

## Express

Register the callback routes with `express.raw()` (or before any global `express.json()`), so the package reads the exact body the gateway sent:

```ts
import express from 'express';
import {
  ApiError,
  Amount,
  CallbackRequest,
  InvalidPaymentDataError,
  MyanmarPayments,
  SignatureVerificationError,
} from '@laranex/myanmar-payments';

const payments = MyanmarPayments.fromEnv(process.env);
const app = express();

app.get('/checkout/:orderId', async (req, res, next) => {
  try {
    const payment = payments.ayaPay().initiate({
      orderId: `ORDER${req.params.orderId}`,
      amount: Amount.kyat(8000),
      channel: 'aya_pay',
      method: 'QR',
      returnUrl: 'https://shop.test/payments/aya/return',
    });
    res.type('html').send(payment.toHtml());
  } catch (error) {
    next(error);
  }
});

app.post('/payments/callback/kbz', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    const callback = payments.kbzPay().handleCallback(await CallbackRequest.fromNodeRequest(req));
    // fulfill callback.orderId when callback.isSuccessful() and the amount matches
    callback.acknowledgement.send(res);
  } catch (error) {
    next(error);
  }
});

app.get('/payments/aya/return', async (req, res, next) => {
  try {
    const result = payments.ayaPay().verifyRedirect(await CallbackRequest.fromNodeRequest(req));
    res.send(result.isSuccessful() ? 'Thank you, your payment was received.' : `Payment ${result.status}.`);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof InvalidPaymentDataError) return res.status(422).json({ errors: error.errors });
  if (error instanceof SignatureVerificationError) return res.status(400).send('invalid signature');
  if (error instanceof ApiError) return res.status(502).json({ code: error.gatewayCode, message: error.gatewayMessage });
  next(error);
});
```

`fromNodeRequest` reads the buffer `express.raw()` leaves in `req.body`. If a global `express.json()` or `express.urlencoded()` already parsed the body, it encodes `req.body` again as JSON or a form. That usually verifies, but a JSON number such as `1000.50` comes back as `1000.5` and breaks a signature over the exact text, so `express.raw()` on callback routes is the safer setup.

## Fastify

Fastify parses bodies before your handler runs, so `request.raw` has no body left for `fromNodeRequest`. Keep the raw text for callback routes with a content-type parser, then build the request from its parts:

```ts
import Fastify from 'fastify';
import { CallbackRequest, MyanmarPayments, SignatureVerificationError } from '@laranex/myanmar-payments';

const payments = MyanmarPayments.fromEnv(process.env);
const app = Fastify();

// Keep JSON and form bodies as strings; parse them yourself elsewhere if you need to.
app.addContentTypeParser(
  ['application/json', 'application/x-www-form-urlencoded'],
  { parseAs: 'string' },
  (request, body, done) => done(null, body),
);

app.post('/payments/callback/:gateway', async (request, reply) => {
  const callbackRequest = CallbackRequest.from({
    body: request.body as string,
    headers: request.headers,
    query: request.query as Record<string, string>,
  });

  try {
    const callback = payments.waveMoney().handleCallback(callbackRequest);
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
// app/payments/callback/kbz/route.ts
import { CallbackRequest, SignatureVerificationError } from '@laranex/myanmar-payments';
import { payments } from '@/lib/payments'; // one MyanmarPayments instance for the app

export async function POST(request: Request): Promise<Response> {
  try {
    const callback = payments.kbzPay().handleCallback(await CallbackRequest.fromWebRequest(request));
    if (callback.isSuccessful()) {
      // compare callback.amount with the order, then fulfill callback.orderId once
    }
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
    amount: Amount.kyat(1000),
    callbackUrl: 'https://shop.test/payments/callback/kbz',
  });
  return Response.redirect(payment.url, 302);
}
```

Route handlers run on the Node.js runtime by default, which the package needs for `node:crypto`; don't set `export const runtime = 'edge'` on these routes.

## Hono

Hono exposes the Fetch `Request` as `c.req.raw`:

```ts
import { Hono } from 'hono';
import { CallbackRequest, MyanmarPayments, SignatureVerificationError } from '@laranex/myanmar-payments';

const payments = MyanmarPayments.fromEnv(process.env);
const app = new Hono();

app.post('/payments/callback/yoma', async (c) => {
  try {
    const callback = payments.yomaMmqr().handleCallback(await CallbackRequest.fromWebRequest(c.req.raw));
    return callback.acknowledgement.toResponse();
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      return c.text('invalid signature', 400);
    }
    throw error;
  }
});

app.get('/payments/yoma/:orderId', async (c) => {
  const payment = await payments.yomaMmqr().initiate({
    orderId: c.req.param('orderId'),
    amount: 1000,
    description: 'Order',
  });
  return c.html(`<img src="${payment.qrImageDataUri()}" alt="Scan to pay">`);
});
```

`fromWebRequest` reads a clone of the request, so the body stays readable for later middleware.

## Other Servers

For any other server, build the request from its parts with `CallbackRequest.from({ body, headers, query })` (the body as a string, `Buffer` or `Uint8Array`), then write `acknowledgement.status`, `headers` and `body` with your server's response API.

## Testing Your App

Pass a fake `fetch` to any gateway to answer with canned responses, without network access:

```ts
const fetch = async (url: string, init: RequestInit): Promise<Response> =>
  Response.json({ Response: { result: 'SUCCESS', code: '0', prepay_id: 'PREPAY_1', qrCode: 'qr' } });

const kbz = new KbzPay({ appId: 'kp1', appKey: 'key', merchantCode: '100001' }, { fetch });
```

To test your own fulfillment code, build a `PaymentCallback` yourself instead of going through a gateway:

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';

const callback = new PaymentCallback({ orderId: 'ORDER_1', status: 'successful', gatewayStatus: 'PAY_SUCCESS', amount: '1000' });
```
