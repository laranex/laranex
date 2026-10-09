---
title: PaymentCallback & Status
description: Property reference for PaymentCallback, PaymentStatusResult, Acknowledgement, CallbackRequest and the PaymentStatus enum.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handleCallback()` (and AYA's `verifyRedirect()`) once the signature is verified. A final class with read-only properties.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gatewayStatus` | `string` | The gateway's own status value, unmapped |
| `gatewayReference` | `?string` | The gateway's ID for the payment |
| `amount` | `?string` | The amount the gateway reports, exactly as it sent it |
| `raw` | `array` | The verified payload, with JSON numbers kept as strings, never `float` |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `isSuccessful()` | `bool` | `status === PaymentStatus::Successful` |

Build one yourself to test your own fulfillment code, with named arguments: `new PaymentCallback(orderId: ..., status: ..., gatewayStatus: ..., gatewayReference: null, amount: null, raw: [], acknowledgement: Acknowledgement::default())`. `status` takes a `PaymentStatus`, and `acknowledgement` defaults to `Acknowledgement::default()`.

## Acknowledgement

A final class in `Laranex\PhpMyanmarPayments\Http` with read-only properties; `new Acknowledgement(status: ..., body: ..., headers: ...)` builds one, each argument optional.

| Property / Method | Type | Description |
|---|---|---|
| `status` | `int` | HTTP status, `200` by default |
| `body` | `string` | Response body, e.g. KBZ Pay's `success`; empty by default |
| `headers` | `array<string, string>` | Response headers, `['Content-Type' => 'text/plain']` by default |
| `send()` | `void` | Writes the status, headers and body with `http_response_code()`, `header()` and `echo` |

`Acknowledgement::default()` is an empty `200` with `Content-Type: text/plain`. Write it with your framework's response class, see [Acknowledging](/php-myanmar-payments/callbacks#acknowledging).

## PaymentStatusResult

Returned by `$kbz->status()`, `$aya->status()` and `$yoma->status()`. A final class with read-only properties.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `?string` | Your order ID; `null` for Yoma, which returns only the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gatewayStatus` | `string` | The gateway's own status value |
| `gatewayReference` | `?string` | The gateway's ID for the payment |
| `amount` | `?string` | The amount the gateway reports |
| `raw` | `array` | The gateway's response |
| `isSuccessful()` | `bool` | `status === PaymentStatus::Successful` |

## CallbackRequest

| Member | Type | Description |
|---|---|---|
| `new CallbackRequest(body: '', headers: [], query: [])` | `CallbackRequest` | From the raw parts: the body as a `string`, the headers as name => value, the query parameters as an array |
| `CallbackRequest::fromGlobals()` | `CallbackRequest` | From `php://input`, the request headers in `$_SERVER` and `$_GET` |
| `CallbackRequest::fromPsr7($request)` | `CallbackRequest` | From a PSR-7 `ServerRequestInterface`; repeated headers joined with `, ` |
| `CallbackRequest::fromArray($payload, $headers = [])` | `CallbackRequest` | From a decoded payload, encoded as a JSON body with `Content-Type: application/json` |
| `body` | `string` | The raw body, exactly as received |
| `headers()` | `array<string, string>` | Headers as given |
| `query` | `array` | Query string parameters |
| `header($name)` | `?string` | One header, case-insensitively |
| `parsedBody()` | `array` | The body decoded as JSON (when it is a JSON object) or a form (the first value of a repeated key); JSON numbers keep their exact text as strings |
| `input()` | `array` | The body merged over the query string |
| `queryInput()` | `array` | The query string merged over the body |

## PaymentStatus

`enum PaymentStatus: string` in `Laranex\PhpMyanmarPayments\Enums`: `$status->value` is the value and `PaymentStatus::from($value)` reads it back.

| Case | Value |
|---|---|
| `PaymentStatus::Successful` | `successful` |
| `PaymentStatus::Pending` | `pending` |
| `PaymentStatus::Failed` | `failed` |
| `PaymentStatus::Canceled` | `canceled` |
| `PaymentStatus::Expired` | `expired` |
| `PaymentStatus::Unknown` | `unknown` |

`PaymentStatus::cases()` lists every status. `$status->isFinal()` is `false` for `Pending` and `Unknown`. `PaymentStatus::resolve($statuses, $gatewayStatus)` maps a trimmed gateway value through an array and returns `PaymentStatus::Unknown` when it is not listed.
