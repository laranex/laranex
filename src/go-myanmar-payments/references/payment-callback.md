---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult, Acknowledgement, CallbackRequest and the PaymentStatus type.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `HandleCallback()` (and AYA's `VerifyRedirect()`) once the signature is verified.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `Status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `GatewayStatus` | `string` | The gateway's own status value, unmapped |
| `GatewayReference` | `string` | The gateway's ID for the payment |
| `Amount` | `string` | The amount the gateway reports, exactly as it sent it |
| `Raw` | `map[string]any` | The verified payload, as decoded JSON (`json.Number`, never `float64`) |
| `Acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |

Build one yourself to test your own fulfillment code, as a struct literal: `&myanmarpayments.PaymentCallback{OrderID: …, Status: …, GatewayStatus: …}`. Fields you leave out are zero values, so set `Acknowledgement` to `myanmarpayments.DefaultAcknowledgement()` when your code writes it.

## Acknowledgement

A struct.

| Field / Method | Type | Description |
|---|---|---|
| `Status` | `int` | HTTP status; `0` is written as `200` |
| `Body` | `string` | Response body, e.g. KBZ Pay's `success`; empty by default |
| `Headers` | `map[string]string` | Response headers, `{"Content-Type": "text/plain"}` by default |
| `Write(w)` | `error` | Writes the headers, status and body to an `http.ResponseWriter` |

`DefaultAcknowledgement()` is an empty `200` with `Content-Type: text/plain`. Write it with your framework's response writer, see [Acknowledging](/go-myanmar-payments/callbacks#acknowledging).

## PaymentStatusResult

Returned by `kbz.Status()`, `aya.Status()` and `yoma.Status()`. A struct.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID; `""` for Yoma, which returns only the reference |
| `Status` | `PaymentStatus` | The mapped status |
| `GatewayStatus` | `string` | The gateway's own status value |
| `GatewayReference` | `string` | The gateway's ID for the payment |
| `Amount` | `string` | The amount the gateway reports |
| `Raw` | `map[string]any` | The gateway's response |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |

## CallbackRequest

| Member | Type | Description |
|---|---|---|
| `NewCallbackRequestFromHTTP(r)` | `(*CallbackRequest, error)` | From an `*http.Request`: reads the body once and restores it |
| `NewCallbackRequest(body, header, query)` | `*CallbackRequest` | From the raw parts: the body as `[]byte`, the headers as an `http.Header`, the query string as `url.Values`; `nil` header and query are allowed |
| `NewCallbackRequestFromJSON(payload, header)` | `(*CallbackRequest, error)` | From a decoded payload, encoded as a JSON body with `Content-Type: application/json` |
| `Body` | `[]byte` | The raw body, exactly as received |
| `Header` | `http.Header` | The request headers |
| `Query` | `url.Values` | The query string values |
| `HeaderValue(name)` | `string` | One header, case-insensitively, or `""` |
| `ParsedBody()` | `map[string]any` | The body decoded as JSON (when it is a JSON object) or a urlencoded form; JSON numbers become `json.Number` |
| `Input()` | `map[string]any` | The body merged over the query string |
| `QueryInput()` | `map[string]any` | The query string merged over the body |

## PaymentStatus

`type PaymentStatus string`: constants are strings, so they compare equal to their values and `string(status)` is the value.

| Constant | Value |
|---|---|
| `StatusSuccessful` | `successful` |
| `StatusPending` | `pending` |
| `StatusFailed` | `failed` |
| `StatusCanceled` | `canceled` |
| `StatusExpired` | `expired` |
| `StatusUnknown` | `unknown` |

`myanmarpayments.PaymentStatuses()` lists every status. `status.IsFinal()` is `false` for `StatusPending` and `StatusUnknown`. `ResolveStatus(statuses, gatewayStatus)` maps a trimmed gateway value through a `map[string]PaymentStatus` and returns `StatusUnknown` when it is not listed.
