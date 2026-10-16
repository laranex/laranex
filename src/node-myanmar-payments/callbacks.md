---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback, read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`. It is synchronous, never awaited: verifying needs no network call.

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
import {
  Amount,
  CallbackRequest,
  SignatureVerificationError,
  type PaymentCallback,
} from '@laranex/myanmar-payments';

import { orders } from './orders.js';

async function kbzCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const request = await CallbackRequest.fromNodeRequest(req);
  let callback: PaymentCallback;
  try {
    callback = kbz.handleCallback(request);
  } catch (error) {
    if (!(error instanceof SignatureVerificationError)) throw error;
    console.warn(`rejected KBZ callback: ${error.message}`);
    res.writeHead(400).end('invalid callback');
    return;
  }

  await orders.transaction(async (tx) => {
    const order = await tx.findForUpdate(callback.orderId);
    const paid = Amount.parse(order.amount).equals(callback.amount);
    if (callback.isSuccessful() && order.paidAt === null && paid) {
      await tx.markPaid(order, callback.gatewayReference);
    }
  });

  // KBZ Pay: HTTP 200 with plain-text "success"
  callback.acknowledgement.send(res);
}
```

## Building a CallbackRequest

Signatures are checked against what the gateway actually sent, so build the request from the real incoming request: the raw body, the headers and the query string. Never rebuild it from parsed input such as Express's `req.body` after `express.json()`: a JSON number such as `1000.50` would come back as `1000.5` and break a signature over the exact text.

| Factory | Use when |
|---|---|
| `await CallbackRequest.fromNodeRequest(req)` | `node:http`, Express (`req`), Koa (`ctx.req`, without a body parser). Reads the raw body from the stream, or from `req.rawBody` / `req.body` when middleware captured it as text or bytes |
| `await CallbackRequest.fromWebRequest(request)` | A Fetch API `Request`: Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers. Reads a clone, so the request stays readable |
| `CallbackRequest.from({ body, headers, query })` | Every other server: pass the raw body (`string`, `Buffer`, `Uint8Array` or `ArrayBuffer`), the headers (a `Headers`, an object or `[name, value]` pairs) and the query string (`string`, `URLSearchParams` or an object). All three are optional |
| `CallbackRequest.fromJson(payload, headers?)` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table |

| Framework | `body` | `headers` | `query` |
|---|---|---|---|
| `node:http`, Express | `fromNodeRequest(req)` reads all three | | |
| Fastify | `request.body` (kept as a string, see [Fastify](/node-myanmar-payments/framework-integration#fastify)) | `request.headers` | `request.query` |
| Next.js, Hono, Bun, Deno | `fromWebRequest(request)` reads all three | | |

If a body parser already consumed the stream, `fromNodeRequest` re-encodes `req.body`; prefer [`express.raw()`](/node-myanmar-payments/framework-integration#express). See [CallbackRequest](/node-myanmar-payments/references/payment-callback#callbackrequest) for every member.

### Body Size Limit

`fromNodeRequest` and `fromWebRequest` read at most `MAX_CALLBACK_BODY_BYTES` (64 KiB), far above any gateway callback. A larger body throws a `PaymentError` (`The callback request body is larger than 65536 bytes.`) without reading the rest of the stream; a declared `Content-Length` over the limit fails before anything is read. Answer it with `413`. Change the limit with `CallbackReadOptions`, the second argument:

```ts
import { CallbackRequest, MAX_CALLBACK_BODY_BYTES } from '@laranex/myanmar-payments';

const request = await CallbackRequest.fromNodeRequest(req, { maxBodyBytes: 16 * 1024 });
const fromFetch = await CallbackRequest.fromWebRequest(webRequest, { maxBodyBytes: MAX_CALLBACK_BODY_BYTES });
```

`maxBodyBytes` must be a whole number greater than 0 (otherwise a `RangeError`). `CallbackRequest.from()` takes a body you already read, so cap it in your server or body parser.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationError`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `callback.amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount.equals`. Yoma MMQR callbacks carry no amount: confirm those with [`status()`](/node-myanmar-payments/drivers/yoma-mmqr#status-checks).
- **Signed is not enough on its own.** Where a gateway joins the signed values with a separator (AYA Pay `:`, CyberSource `,` and `=`) or with none (Wave Money), the package also rejects values that could be re-split into other fields. See each driver's Handling Callbacks section.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `callback.acknowledgement` holds the response the gateway expects (`status`, `body`, `headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`callback.acknowledgement` is an `Acknowledgement` with `status`, `body` and `headers`. Write them with your framework's response API:

| Framework | Response |
|---|---|
| `node:http`, Express | `ack.send(res)`: sets the status and headers and ends the response |
| Fastify | `reply.code(ack.status).headers(ack.headers).send(ack.body)` |
| Next.js, Hono, Bun, Deno | `return ack.toResponse()`, a Fetch API `Response` |

`Acknowledgement.default()` is the empty `200 text/plain` response most gateways expect.

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your framework applies.

## PaymentStatus

Every gateway's status maps onto `PaymentStatus`, and the original value stays in `callback.gatewayStatus`; see [PaymentStatus](/node-myanmar-payments/references/payment-callback#paymentstatus) and each gateway's Statuses table.

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
| KBZ Pay | `kbz.status(orderId)` |
| AYA Payment Gateway | `aya.status(orderId)` |
| Yoma MMQR | `yoma.status(payment.reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

Every status call is async: `await` it.

```ts
import { ApiError } from '@laranex/myanmar-payments';

let result;
try {
  result = await kbz.status('ORDER_1');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`KBZ ${error.gatewayCode}: ${error.gatewayMessage}`);
  }
  throw error;
}

if (result.isSuccessful()) {
  // ...
}
```

See [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for every field.
