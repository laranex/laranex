---
title: App-Based Flow
description: RequestPaymentResult reference for app-based payment flows in Laravel Myanmar Payments.
---

# App-Based Flow

**Drivers:** KBZ Pay (`kbzpay.app`)

`value` contains a signed array payload. Return it as JSON to your mobile app, which passes it directly to the KBZ Pay SDK to launch the in-app payment flow. The gateway POSTs the result to your `callbackUrl` once the customer completes the payment.

| Property | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow::AppBased` | Identifies the flow type |
| `value` | `array` | Signed payload for the mobile SDK: `orderInfo`, `sign`, `signType` |
| `originalValue` | `array` | Same as `value` |
| `transactionId` | `string` | Your order/transaction identifier |
| `raw` | `array` | Raw gateway response |
