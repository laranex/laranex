---
title: PaymentCallback & Status
description: Property reference for PaymentCallback, PaymentStatusResult and the PaymentStatus enum.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handleCallback()` and by `ayaPay()->verifyRedirect()`, after the signature has been verified.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order id |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gatewayStatus` | `string` | The gateway's own status value, unmapped |
| `gatewayReference` | `?string` | The gateway's id for the payment |
| `amount` | `?string` | The amount as the gateway sent it |
| `raw` | `array` | The verified payload |
| `isSuccessful()` | `bool` | `status === PaymentStatus::Successful` |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects (`status`, `body`, `headers`) |

In Laravel, return `MyanmarPayments::acknowledge($callback)` to send the acknowledgement.

Returned by `MyanmarPayments::handleCallback($gateway, $request)` too, for a gateway chosen by name.

## PaymentStatusResult

Returned by `kbzPay()->status()`, `ayaPay()->status()` and `yomaMmqr()->status()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `?string` | Your order id. `null` for Yoma MMQR, which only returns the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gatewayStatus` | `string` | The gateway's own status value |
| `gatewayReference` | `?string` | The gateway's id for the payment |
| `amount` | `?string` | The amount as the gateway reported it |
| `raw` | `array` | The gateway's response |
| `isSuccessful()` | `bool` | `status === PaymentStatus::Successful` |

## PaymentStatus

| Case | Value | `isFinal()` |
|---|---|---|
| `PaymentStatus::Successful` | `successful` | `true` |
| `PaymentStatus::Pending` | `pending` | `false` |
| `PaymentStatus::Failed` | `failed` | `true` |
| `PaymentStatus::Canceled` | `canceled` | `true` |
| `PaymentStatus::Expired` | `expired` | `true` |
| `PaymentStatus::Unknown` | `unknown` | `false` |
