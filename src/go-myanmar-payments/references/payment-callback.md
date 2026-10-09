---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult, Acknowledgement and the PaymentStatus type.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `HandleCallback` (and AYA's `VerifyRedirect`) once the signature is verified.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id |
| `Status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `GatewayStatus` | `string` | The gateway's own status value, unmapped |
| `GatewayReference` | `string` | The gateway's id for the payment |
| `Amount` | `string` | The amount the gateway reports, as it sent it |
| `Raw` | `map[string]any` | The verified payload |
| `Acknowledgement` | `Acknowledgement` | The response the gateway expects |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |

## Acknowledgement

| Field / Method | Type | Description |
|---|---|---|
| `Status` | `int` | HTTP status; `0` is written as `200` |
| `Body` | `string` | Response body, e.g. KBZ Pay's `success` |
| `Headers` | `map[string]string` | Response headers |
| `Write(w)` | `error` | Writes the headers, status and body to an `http.ResponseWriter` |

`DefaultAcknowledgement()` is an empty `200` with `Content-Type: text/plain`.

## PaymentStatusResult

Returned by `kbzpay.Status`, `ayapay.Status` and `yomammqr.Status`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order id; empty for Yoma, which returns only the reference |
| `Status` | `PaymentStatus` | The mapped status |
| `GatewayStatus` | `string` | The gateway's own status value |
| `GatewayReference` | `string` | The gateway's id for the payment |
| `Amount` | `string` | The amount the gateway reports |
| `Raw` | `map[string]any` | The gateway's response |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |

## PaymentStatus

`type PaymentStatus string`

| Constant | Value |
|---|---|
| `StatusSuccessful` | `successful` |
| `StatusPending` | `pending` |
| `StatusFailed` | `failed` |
| `StatusCanceled` | `canceled` |
| `StatusExpired` | `expired` |
| `StatusUnknown` | `unknown` |

`IsFinal()` is `false` for `StatusPending` and `StatusUnknown`. `ResolveStatus(statuses, gatewayStatus)` maps a trimmed gateway value through a table and returns `StatusUnknown` when it is not listed.
