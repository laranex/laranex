---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`. It is synchronous: verifying needs no network call.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/node-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'kbz.handleCallback(request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationError', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by callback.orderId' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: 'callback.acknowledgement.send(res)', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CallbackRequest, SignatureVerificationError } from '@laranex/myanmar-payments';

async function kbzCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let callback;
  try {
    callback = kbz.handleCallback(await CallbackRequest.fromNodeRequest(req));
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      console.warn(`rejected KBZ callback: ${error.message}`);
    }
    res.writeHead(400).end('invalid callback');
    return;
  }

  const order = await orders.find(callback.orderId);
  if (callback.isSuccessful() && !order.paid && order.amount.equals(callback.amount)) {
    await orders.markPaid(order, callback.gatewayReference);
  }

  callback.acknowledgement.send(res); // KBZ Pay: HTTP 200 with plain-text "success"
}
```

## Building a CallbackRequest

Signatures are checked against what the gateway actually sent, so build the request from the real incoming request.

| Factory | Use when |
|---|---|
| `await CallbackRequest.fromNodeRequest(req)` | `node:http`, Express (`req`), Koa (`ctx.req`, without a body parser). Reads the raw body from the stream, or from `req.rawBody` / `req.body` when middleware captured it as text or bytes |
| `await CallbackRequest.fromWebRequest(request)` | A Fetch API `Request`: Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers. Reads a clone, so the request stays readable |
| `CallbackRequest.fromJson(payload, headers?)` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table |
| `CallbackRequest.from({ body, headers, query })` | Fastify and any other server: pass the raw body (string or bytes), headers and query (string, `URLSearchParams` or object) |

When a body parser such as `express.json()` already consumed the stream, `fromNodeRequest` encodes the parsed `req.body` again as JSON or a form. That usually verifies, but a JSON number such as `1000.50` comes back as `1000.5` and breaks a signature over the exact text, so prefer [`express.raw()` on callback routes](/node-myanmar-payments/framework-integration#express).

| Member | Description |
|---|---|
| `body` | The raw body, decoded as UTF-8 |
| `headers` | Headers with lowercase names |
| `query` | Query string values (the first of each) |
| `header(name)` | One header, case-insensitively, or `undefined` |
| `parsedBody()` | The body decoded as JSON or a urlencoded form |
| `input()` | The parsed body merged over the query string |
| `queryInput()` | The query string merged over the parsed body |

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationError`. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount.equals`.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `callback.acknowledgement` holds the response the gateway expects (`status`, `body`, `headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

| Method | Use with |
|---|---|
| `acknowledgement.send(res)` | A `node:http` `ServerResponse` or Express `res`: sets the status and headers and ends the response |
| `acknowledgement.toResponse()` | Fetch servers: returns a `Response` to return from a Next.js route handler, Hono or Bun |

For other frameworks, write `status`, `headers` and `body` yourself, e.g. with Fastify: `reply.code(ack.status).headers(ack.headers).send(ack.body)`.

`Acknowledgement.default()` is the empty `200 text/plain` response most gateways expect.

## PaymentStatus

Every gateway's own status values are mapped onto one string union. The original value stays in `callback.gatewayStatus`.

| Constant | Value | Meaning |
|---|---|---|
| `PaymentStatus.Successful` | `successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus.Pending` | `pending` | Still in progress or waiting on the customer. |
| `PaymentStatus.Failed` | `failed` | Attempted and failed or rejected. |
| `PaymentStatus.Canceled` | `canceled` | Canceled or closed before completing. |
| `PaymentStatus.Expired` | `expired` | The payment window ran out. |
| `PaymentStatus.Unknown` | `unknown` | A status this package does not recognize yet. Inspect `gatewayStatus`. |

`PaymentStatus.isFinal(status)` is `false` for `pending` and `unknown`. Unknown statuses never throw.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: 'await kbz.status(orderId)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: 'PaymentStatus.isFinal(result.status)' },
  ]"
/>

Status checks return a `PaymentStatusResult` with the same `status`, `gatewayStatus`, `gatewayReference` and `amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `await kbz.status(orderId)` |
| AYA Payment Gateway | `await aya.status(orderId)` |
| Yoma MMQR | `await yoma.status(payment.reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```ts
import { ApiError } from '@laranex/myanmar-payments';

try {
  const result = await kbz.status('ORDER_1');
  if (result.isSuccessful()) {
    // ...
  }
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`KBZ ${error.gatewayCode}: ${error.gatewayMessage}`);
  }
  throw error;
}
```

See [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for every field.
