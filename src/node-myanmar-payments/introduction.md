---
title: Introduction
---

<PackageIntroduction />

## Why Node Myanmar Payments

Every Myanmar payment gateway signs its requests and callbacks its own way, reports its own status codes and has its own rules for amounts. Node Myanmar Payments handles all of that behind one typed API for Node.js and any framework: build the payment data, start the payment, then verify the callback the gateway sends back.

- **Five gateways, one pattern.** KBZ Pay (PWA, QR and in-app), Wave Money, AYA Pay, Yoma MMQR and CyberSource, each with its own class and the same three steps.
- **One typed result per flow.** `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment` holds exactly what the next step needs: a URL to redirect to, an auto-submitting form, a QR code or the signed order for the KBZ Pay mobile SDK. See [Payment Flows](/node-myanmar-payments/payment-flows).
- **Exact amounts, checked against each gateway's rules.** An `Amount` is kept as decimal text, takes a `bigint` of any size and never passes through a fractional `number`. Decimals, currency and limits follow each gateway's official documentation and are checked before any request is sent. See [Amounts](/node-myanmar-payments/amounts).
- **Verified callbacks.** `handleCallback()` checks the gateway's signature without a network call, maps its status onto one `PaymentStatus` and gives you the acknowledgement the gateway expects. When a callback is late, ask KBZ Pay, AYA Pay or Yoma MMQR with `status()`. See [Callbacks & Status](/node-myanmar-payments/callbacks).
- **Errors that say what went wrong.** A missing setting, an invalid field, a gateway error and a bad signature each throw their own error class, with a message that names the setting, the field or the gateway's code.
- **No runtime dependencies.** Requests go through the global `fetch` (or any `HttpClient` you pass) and signing uses `node:crypto`. ES modules and CommonJS both ship with TypeScript types, and callbacks are read from Node's request or a web `Request`, so Express, Fastify, Next.js and Hono all work. NestJS apps use [NestJS Myanmar Payments](/nestjs-myanmar-payments/introduction), which wraps this package.
- **Same behavior in every language.** The PHP, Go, Node.js and Python SDKs pass one shared set of test vectors for signing and callback verification, and read the same environment variables, so one `.env` file and one Yoma MMQR token cache serve them all.
- **Nothing stored for you.** The package keeps no tables and no webhook log. [Handling Webhooks](/node-myanmar-payments/webhooks) shows the recommended flow as code you copy: verify, store, acknowledge, then process each call once.
- **Easy to test.** Every gateway call goes through the `fetch` or client you pass, so your tests fake the responses, replay signed callbacks and never touch the network. See [Testing](/node-myanmar-payments/testing).
