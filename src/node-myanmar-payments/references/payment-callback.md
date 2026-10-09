---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult, Acknowledgement, CallbackRequest and the PaymentStatus type.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handleCallback()` (and AYA's `verifyRedirect()`) once the signature is verified.

| Field / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gatewayStatus` | `string` | The gateway's own status value, unmapped |
| `gatewayReference` | `string \| undefined` | The gateway's ID for the payment |
| `amount` | `string \| undefined` | The amount the gateway reports, exactly as it sent it |
| `raw` | `Record<string, unknown>` | The verified payload, as plain JavaScript values; JSON numbers are their exact text as `string`s |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `isSuccessful()` | `boolean` | `status === 'successful'` |

Build one yourself to test your own fulfillment code, with an object: `new PaymentCallback({ orderId, status, gatewayStatus, gatewayReference?, amount?, raw?, acknowledgement? })`. `status` takes a `PaymentStatus` value, and `acknowledgement` defaults to `Acknowledgement.default()`.

## Acknowledgement

A class with read-only fields; `new Acknowledgement({ status?, body?, headers? })` builds one.

| Field / Method | Type | Description |
|---|---|---|
| `status` | `number` | HTTP status, `200` by default |
| `body` | `string` | Response body, e.g. KBZ Pay's `success`; empty by default |
| `headers` | `Record<string, string>` | Response headers, `{ 'Content-Type': 'text/plain' }` by default |
| `send(res)` | `void` | Writes the status, headers and body to a `node:http` `ServerResponse` (or Express `res`) and ends it |
| `toResponse()` | `Response` | The acknowledgement as a Fetch API `Response` |

`Acknowledgement.default()` is an empty `200` with `Content-Type: text/plain`. Write it with your framework's response API, see [Acknowledging](/node-myanmar-payments/callbacks#acknowledging).

## PaymentStatusResult

Returned by `kbz.status()`, `aya.status()` and `yoma.status()`. A class with read-only fields.

| Field / Method | Type | Description |
|---|---|---|
| `orderId` | `string \| undefined` | Your order ID; `undefined` for Yoma, which returns only the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gatewayStatus` | `string` | The gateway's own status value |
| `gatewayReference` | `string \| undefined` | The gateway's ID for the payment |
| `amount` | `string \| undefined` | The amount the gateway reports |
| `raw` | `Record<string, unknown>` | The gateway's response |
| `isSuccessful()` | `boolean` | `status === 'successful'` |

## CallbackRequest

| Member | Type | Description |
|---|---|---|
| `CallbackRequest.from({ body, headers, query })` | `CallbackRequest` | From the raw parts: the body as a `string`, `Buffer`, `Uint8Array` or `ArrayBuffer`, the headers as an object or `[name, value]` pairs, the query string as a `string`, `URLSearchParams` or an object. All three are optional |
| `CallbackRequest.fromJson(payload, headers?)` | `CallbackRequest` | From a decoded payload, encoded as a JSON body |
| `CallbackRequest.fromNodeRequest(req)` | `Promise<CallbackRequest>` | From a `node:http` `IncomingMessage` (Express `req`, or Koa `ctx.req` without a body parser) |
| `CallbackRequest.fromWebRequest(request)` | `Promise<CallbackRequest>` | From a Fetch API `Request`, read from a clone |
| `rawBody` | `Uint8Array` | The raw body, exactly as received |
| `body` | `string` | The raw body, decoded as UTF-8 |
| `headers` | `Record<string, string>` | Headers with lowercase names; repeated headers joined with `, ` |
| `query` | `Record<string, string>` | Query string values (the first of each) |
| `header(name)` | `string \| undefined` | One header, case-insensitively |
| `parsedBody()` | `Record<string, unknown>` | The body decoded as JSON or a form; JSON numbers are their exact text as `string`s |
| `input()` | `Record<string, unknown>` | The body merged over the query string |
| `queryInput()` | `Record<string, unknown>` | The query string merged over the body |

## PaymentStatus

`type PaymentStatus = 'successful' | 'pending' | 'failed' | 'canceled' | 'expired' | 'unknown'`: statuses are plain strings, and the `PaymentStatus` object names each value.

| Constant | Value |
|---|---|
| `PaymentStatus.Successful` | `successful` |
| `PaymentStatus.Pending` | `pending` |
| `PaymentStatus.Failed` | `failed` |
| `PaymentStatus.Canceled` | `canceled` |
| `PaymentStatus.Expired` | `expired` |
| `PaymentStatus.Unknown` | `unknown` |

`PaymentStatus.values` lists every status. `PaymentStatus.isFinal(status)` is `false` for `pending` and `unknown`. `resolveStatus(statuses, gatewayStatus)` maps a trimmed gateway value through an object and returns `'unknown'` when it is not listed.
