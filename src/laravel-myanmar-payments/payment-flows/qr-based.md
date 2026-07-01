---
title: QR-Based Flow
description: RequestPaymentResult reference for QR-based payment flows in Laravel Myanmar Payments.
---

# QR-Based Flow

**Drivers:** KBZ Pay (`kbzpay.qr`)

`value` contains a raw QR code string. Render it as a QR image in your UI for the customer to scan with their KBZ Pay app. The gateway POSTs the result to your `callbackUrl` once the customer completes the scan.

| Property | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow::QrBased` | Identifies the flow type |
| `value` | `string` | Raw QR code string to render as an image |
| `originalValue` | `string` | Same as `value` |
| `transactionId` | `string` | Your order/transaction identifier |
| `raw` | `array` | Raw gateway response |
