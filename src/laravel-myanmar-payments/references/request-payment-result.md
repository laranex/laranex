---
title: RequestPaymentResult
description: Property and method reference for RequestPaymentResult, returned by every driver's initiate() method.
---

# RequestPaymentResult

Returned by every driver's `initiate()` method.

## Properties

| Property | Type | Description |
|---|---|---|
| `flow` | `PaymentFlow` | The payment flow type for this driver |
| `value` | `mixed` | The primary value to act on — URL, QR string, or app payload depending on the flow |
| `originalValue` | `mixed` | The raw gateway value — same as `value` for redirect/QR/app flows; `['url' => string, 'data' => array]` for form-based flows |
| `transactionId` | `string` | Your order/transaction identifier |
| `raw` | `array` | Raw gateway response |

## Methods

| Method | Returns | Description |
|---|---|---|
| `isRedirectBased()` | `bool` | `true` when `flow` is `PaymentFlow::RedirectBased` |
| `isFormBased()` | `bool` | `true` when `flow` is `PaymentFlow::FormBased` |
| `isQrBased()` | `bool` | `true` when `flow` is `PaymentFlow::QrBased` |
| `isAppBased()` | `bool` | `true` when `flow` is `PaymentFlow::AppBased` |

## PaymentFlow

| Case | Value | Used by |
|---|---|---|
| `PaymentFlow::RedirectBased` | `redirect` | Wave Money, KBZ Pay PWA |
| `PaymentFlow::FormBased` | `form` | AYA PGW, CyberSource |
| `PaymentFlow::QrBased` | `qr` | KBZ Pay QR |
| `PaymentFlow::AppBased` | `app` | KBZ Pay App |
