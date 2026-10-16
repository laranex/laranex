---
title: Introduction
---

<PackageIntroduction />

## Why Goravel Myanmar Payments

Every Myanmar payment gateway signs, sends and acknowledges payments its own way, with its own rules for amounts. Goravel Myanmar Payments puts KBZ Pay, Wave Money, AYA Pay, Yoma MMQR and CyberSource behind one facade. All gateway logic lives in [Go Myanmar Payments](/go-myanmar-payments/introduction); this package wires it into Goravel.

- **One facade, every gateway.** `paymentsfacades.MyanmarPayments()` returns a manager with `KbzPay()`, `WaveMoney()`, `AyaPay()`, `YomaMmqr()` and `CyberSource()`, configured from environment variables.
- **One-command setup.** `package:install` registers the service provider, writes `config/myanmar_payments.go` and adds the gateway variables to `.env.example`.
- **A typed result for each flow.** Every payment returns a `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment`, so you always know what to do next. See [Payment Flows](/goravel-myanmar-payments/payment-flows).
- **Exact amounts.** `myanmarpayments.Amount` values, never floats, checked against each gateway's documented rules before any request is sent.
- **Verified callbacks.** `HandleCallback` checks the gateway's signature against the exact body it sent and maps its status onto one `PaymentStatus`; `payments.Acknowledge` returns the response the gateway expects.
- **Goravel all the way down.** Gateway calls go through Goravel's HTTP client, Yoma MMQR tokens are shared through your cache store, and AYA Pay and CyberSource checkout forms open from an encrypted link.
- **Easy to test.** Goravel's HTTP client fakes see every gateway call, and signed callbacks can be posted to your own routes. See [Testing](/goravel-myanmar-payments/testing).
- **Your webhooks, your storage.** The package never stores webhooks; the docs show the recommended store, acknowledge and process-once flow as sample code. See [Handling Webhooks](/goravel-myanmar-payments/webhooks).
- **Ready for AI agents.** An agent skill, installed with `npx skills add`, teaches coding agents to use the package correctly.
