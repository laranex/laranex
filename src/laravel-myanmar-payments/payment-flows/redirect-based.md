---
title: Redirect-Based Flow
description: RequestPaymentResult reference for redirect-based payment flows in Laravel Myanmar Payments.
---

# Redirect-Based Flow

**Drivers:** Wave Money, KBZ Pay (`kbzpay.pwa`)

`value` contains a URL. Redirect the customer there and the gateway handles the payment on its own page. When the customer completes or cancels, the gateway POSTs the result to your `callbackUrl`.

| Property | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow::RedirectBased` | Identifies the flow type |
| `value` | `string` | The gateway URL to redirect the customer to |
| `originalValue` | `string` | Same as `value` |
| `transactionId` | `string` | Your order/transaction identifier |
| `raw` | `array` | Raw gateway response |
