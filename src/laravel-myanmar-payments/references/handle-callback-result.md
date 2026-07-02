---
title: HandleCallbackResult
description: Property and method reference for HandlePaymentResult, returned by every driver's handleCallback() method.
---

# HandleCallbackResult

Returned by every driver's `handleCallback()` method.

## Properties

| Property | Type | Description |
|---|---|---|
| `status` | `HandlePaymentStatus` | The payment status reported by the gateway |
| `transactionId` | `string` | The gateway's transaction identifier |
| `raw` | `array` | Raw callback payload received from the gateway |

## Methods

| Method | Returns | Description |
|---|---|---|
| `isSuccessful()` | `bool` | `true` when `status` is `HandlePaymentStatus::Successful` |
| `isFailed()` | `bool` | `true` when `status` is `HandlePaymentStatus::Failed` |

## HandlePaymentStatus

| Case | Value | Meaning |
|---|---|---|
| `HandlePaymentStatus::Successful` | `successful` | Payment confirmed by the gateway |
| `HandlePaymentStatus::Failed` | `failed` | Payment was declined, cancelled, or timed out |
