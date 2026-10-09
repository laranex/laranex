---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult, Acknowledgement, CallbackRequest and the PaymentStatus type.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handleCallback()` (and AYA's `verifyRedirect()`) once the signature is verified.

| Field / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gatewayStatus` | `string` | The gateway's own status value, unmapped |
| `gatewayReference` | `string \| undefined` | The gateway's id for the payment |
| `amount` | `string \| undefined` | The amount the gateway reports, exactly as it sent it |
| `raw` | `Record<string, unknown>` | The verified payload, as plain JavaScript values |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `isSuccessful()` | `boolean` | `status === 'successful'` |

Build one yourself to test your own fulfillment code: `new PaymentCallback({ orderId, status, gatewayStatus, gatewayReference?, amount?, raw?, acknowledgement? })`.

## Acknowledgement

| Field / Method | Type | Description |
|---|---|---|
| `status` | `number` | HTTP status, `200` by default |
| `body` | `string` | Response body, e.g. KBZ Pay's `success` |
| `headers` | `Record<string, string>` | Response headers, `{ 'Content-Type': 'text/plain' }` by default |
| `send(res)` | `void` | Writes the status, headers and body to a `node:http` `ServerResponse` (or Express `res`) and ends it |
| `toResponse()` | `Response` | The acknowledgement as a Fetch API `Response` |

`Acknowledgement.default()` is an empty `200` with `Content-Type: text/plain`.

## PaymentStatusResult

Returned by `kbz.status()`, `aya.status()` and `yoma.status()`.

| Field / Method | Type | Description |
|---|---|---|
| `orderId` | `string \| undefined` | Your order id; `undefined` for Yoma, which returns only the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gatewayStatus` | `string` | The gateway's own status value |
| `gatewayReference` | `string \| undefined` | The gateway's id for the payment |
| `amount` | `string \| undefined` | The amount the gateway reports |
| `raw` | `Record<string, unknown>` | The gateway's response |
| `isSuccessful()` | `boolean` | `status === 'successful'` |

## CallbackRequest

| Member | Type | Description |
|---|---|---|
| `CallbackRequest.fromNodeRequest(req)` | `Promise<CallbackRequest>` | From a `node:http` `IncomingMessage` (Express `req`, or Koa `ctx.req` without a body parser) |
| `CallbackRequest.fromWebRequest(request)` | `Promise<CallbackRequest>` | From a Fetch API `Request` |
| `CallbackRequest.from({ body, headers, query })` | `CallbackRequest` | From the raw parts |
| `CallbackRequest.fromJson(payload, headers?)` | `CallbackRequest` | From a decoded payload, encoded as a JSON body |
| `body` | `string` | The raw body |
| `headers` | `Record<string, string>` | Headers with lowercase names |
| `query` | `Record<string, string>` | Query string values |
| `header(name)` | `string \| undefined` | One header, case-insensitively |
| `parsedBody()` | `Record<string, unknown>` | The body decoded as JSON or a form |
| `input()` | `Record<string, unknown>` | The body merged over the query string |
| `queryInput()` | `Record<string, unknown>` | The query string merged over the body |

## PaymentStatus

`type PaymentStatus = 'successful' | 'pending' | 'failed' | 'cancelled' | 'expired' | 'unknown'`

| Constant | Value |
|---|---|
| `PaymentStatus.Successful` | `successful` |
| `PaymentStatus.Pending` | `pending` |
| `PaymentStatus.Failed` | `failed` |
| `PaymentStatus.Cancelled` | `cancelled` |
| `PaymentStatus.Expired` | `expired` |
| `PaymentStatus.Unknown` | `unknown` |

`PaymentStatus.values` lists every status. `PaymentStatus.isFinal(status)` is `false` for `pending` and `unknown`. `resolveStatus(statuses, gatewayStatus)` maps a trimmed gateway value through a table and returns `unknown` when it is not listed.
