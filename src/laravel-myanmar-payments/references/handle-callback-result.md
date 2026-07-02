---
title: HandleCallbackResult
description: Property reference for HandlePaymentResult, returned by every driver's handleCallback() method.
---

# HandleCallbackResult

Returned by every driver's `handleCallback()` method.

## Properties

| Property | Type | Description |
|---|---|---|
| `successful` | `bool` | `true` when the gateway confirmed the payment, `false` otherwise |
| `transactionId` | `string` | The gateway's transaction identifier |
| `raw` | `array` | Raw callback payload received from the gateway |
