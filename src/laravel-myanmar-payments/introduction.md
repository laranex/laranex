---
title: Introduction
---

<PackageIntroduction />

## Why Laravel Myanmar Payments

Every Myanmar payment gateway signs, sends and acknowledges payments its own way, with its own rules for amounts. Laravel Myanmar Payments puts KBZ Pay, Wave Pay, AYA Pay, Yoma MMQR and CyberSource behind one facade. All gateway logic lives in [PHP Myanmar Payments](/php-myanmar-payments/introduction); this package wires it into Laravel.

- **One facade, every gateway.** `MyanmarPayments::kbzPay()`, `wavePay()`, `ayaPay()`, `yomaMmqr()` and `cyberSource()`, configured from environment variables.
- **A typed result for each flow.** Every payment returns a `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment`, so you always know what to do next. See [Payment Flows](/laravel-myanmar-payments/payment-flows).
- **Exact amounts.** Plain integers or `Amount` values, never floats, checked against each gateway's documented rules before any request is sent.
- **Verified callbacks.** `handleCallback($request)` checks the gateway's signature against the exact body it sent and maps its status onto one `PaymentStatus` enum; `acknowledge($callback)` returns the response the gateway expects.
- **Laravel all the way down.** Gateway calls go through the `Http` client, Yoma MMQR tokens are shared through your cache store, and AYA Pay and CyberSource checkout forms open from an encrypted link.
- **Easy to test.** `Http::fake()` sees every gateway call, the facade can be mocked, and signed callbacks can be posted to your own routes. See [Testing](/laravel-myanmar-payments/testing).
- **Your webhooks, your storage.** The package never stores webhooks; the docs show the recommended store, acknowledge and process-once flow as sample code. See [Handling Webhooks](/laravel-myanmar-payments/webhooks).
- **Ready for AI agents.** An agent skill, installed by Laravel Boost or `npx skills add`, teaches coding agents to use the package correctly.
