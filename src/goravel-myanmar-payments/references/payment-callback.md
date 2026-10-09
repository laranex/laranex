---
title: PaymentCallback & Status
description: Field reference for PaymentCallback, PaymentStatusResult and the PaymentStatus type.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `HandleCallback()`, by `Manager.HandleCallback()` and by `AyaPay()` → `VerifyRedirect()`, after the signature has been verified.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID |
| `Status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `GatewayStatus` | `string` | The gateway's own status value, unmapped |
| `GatewayReference` | `string` | The gateway's ID for the payment |
| `Amount` | `string` | The amount as the gateway sent it |
| `Raw` | `map[string]any` | The verified payload |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |
| `Acknowledgement` | `Acknowledgement` | The response the gateway expects (`Status`, `Body`, `Headers`) |

In Goravel, return `payments.Acknowledge(ctx, callback)` to send the acknowledgement.

## PaymentStatusResult

Returned by `Status()` on `KbzPay()`, `AyaPay()` and `YomaMmqr()`.

| Field / Method | Type | Description |
|---|---|---|
| `OrderID` | `string` | Your order ID. Empty for Yoma MMQR, which only returns the reference |
| `Status` | `PaymentStatus` | The mapped status |
| `GatewayStatus` | `string` | The gateway's own status value |
| `GatewayReference` | `string` | The gateway's ID for the payment |
| `Amount` | `string` | The amount as the gateway reported it |
| `Raw` | `map[string]any` | The gateway's response |
| `IsSuccessful()` | `bool` | `Status == StatusSuccessful` |

## PaymentStatus

| Constant | Value | `IsFinal()` |
|---|---|---|
| `myanmarpayments.StatusSuccessful` | `successful` | `true` |
| `myanmarpayments.StatusPending` | `pending` | `false` |
| `myanmarpayments.StatusFailed` | `failed` | `true` |
| `myanmarpayments.StatusCanceled` | `canceled` | `true` |
| `myanmarpayments.StatusExpired` | `expired` | `true` |
| `myanmarpayments.StatusUnknown` | `unknown` | `false` |
