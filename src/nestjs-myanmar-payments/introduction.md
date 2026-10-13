---
title: Introduction
---

<PackageIntroduction />

## Why NestJS Myanmar Payments

Every Myanmar payment gateway signs, sends and acknowledges payments its own way, with its own rules for amounts. NestJS Myanmar Payments puts KBZ Pay, Wave Money, AYA Pay, Yoma MMQR and CyberSource behind one injectable service. All gateway logic lives in [Node Myanmar Payments](/node-myanmar-payments/introduction); this package wires it into NestJS.

- **One module, every gateway.** `MyanmarPaymentsModule.forRoot()` or `forRootAsync()` provides `MyanmarPaymentsService` with `kbzPay()`, `waveMoney()`, `ayaPay()`, `yomaMmqr()` and `cyberSource()`, configured from environment variables or module options. Endpoints default to production.
- **A typed result for each flow.** Every payment returns a `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment`, so you always know what to do next. See [Payment Flows](/nestjs-myanmar-payments/payment-flows).
- **Exact amounts.** Whole numbers or `Amount` values, never floats, checked against each gateway's documented rules before any request is sent.
- **Verified callbacks.** `@VerifiedCallback()` checks the gateway's signature against the exact body it sent and injects a `PaymentCallback` whose status is one `PaymentStatus`; `@AcknowledgeCallback()` sends the response the gateway expects.
- **NestJS all the way down.** Injectable gateways (`@InjectKbzPay()` and the rest), Express or Fastify, `@nestjs/config` for settings, `@nestjs/cache-manager` for shared Yoma MMQR tokens, and AYA Pay and CyberSource checkout forms that open from an encrypted link.
- **Easy to test.** A fake `fetch` sees every gateway call, `MyanmarPaymentsService` can be overridden, and signed callbacks can be posted to your own routes. See [Testing](/nestjs-myanmar-payments/testing).
- **Your webhooks, your storage.** The package never stores webhooks; the docs show the recommended store, acknowledge and process-once flow as sample code. See [Handling Webhooks](/nestjs-myanmar-payments/webhooks).
- **Ready for AI agents.** An agent skill, installed with `npx skills add`, teaches coding agents to use the package correctly.
