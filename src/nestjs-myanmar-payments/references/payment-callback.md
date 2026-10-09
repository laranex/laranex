---
title: PaymentCallback & Status
description: Property reference for PaymentCallback, PaymentStatusResult and PaymentStatus.
---

# PaymentCallback & Status

## PaymentCallback

Returned by every gateway's `handleCallback()` and by `ayaPay().verifyRedirect()`, after the signature has been verified.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string` | Your order ID |
| `status` | `PaymentStatus` | The status mapped onto this package's statuses |
| `gatewayStatus` | `string` | The gateway's own status value, unmapped |
| `gatewayReference` | `string \| undefined` | The gateway's ID for the payment |
| `amount` | `string \| undefined` | The amount as the gateway sent it |
| `raw` | `Readonly<Record<string, unknown>>` | The verified payload |
| `isSuccessful()` | `boolean` | `status === PaymentStatus.Successful` |
| `acknowledgement` | `Acknowledgement` | The response the gateway expects (`status`, `body`, `headers`) |

In NestJS, return the callback from an `@AcknowledgeCallback()` handler, or call `acknowledge(res, callback)`, to send the acknowledgement.

## PaymentStatusResult

Returned by `kbzPay().status()`, `ayaPay().status()` and `yomaMmqr().status()`.

| Property / Method | Type | Description |
|---|---|---|
| `orderId` | `string \| undefined` | Your order ID. `undefined` for Yoma MMQR, which only returns the reference |
| `status` | `PaymentStatus` | The mapped status |
| `gatewayStatus` | `string` | The gateway's own status value |
| `gatewayReference` | `string \| undefined` | The gateway's ID for the payment |
| `amount` | `string \| undefined` | The amount as the gateway reported it |
| `raw` | `Readonly<Record<string, unknown>>` | The gateway's response |
| `isSuccessful()` | `boolean` | `status === PaymentStatus.Successful` |

## PaymentStatus

| Value | String | `PaymentStatus.isFinal()` |
|---|---|---|
| `PaymentStatus.Successful` | `successful` | `true` |
| `PaymentStatus.Pending` | `pending` | `false` |
| `PaymentStatus.Failed` | `failed` | `true` |
| `PaymentStatus.Canceled` | `canceled` | `true` |
| `PaymentStatus.Expired` | `expired` | `true` |
| `PaymentStatus.Unknown` | `unknown` | `false` |
