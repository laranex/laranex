---
title: Introduction
---

<PackageIntroduction />

## Why Go Myanmar Payments

Every Myanmar payment gateway signs its requests and callbacks its own way, reports its own status codes and has its own rules for amounts. Go Myanmar Payments handles all of that behind one typed API for `net/http` and every router built on it: build the payment data, start the payment, then verify the callback the gateway sends back.

- **Five gateways, one pattern.** KBZ Pay (PWA, QR and in-app), Wave Pay, AYA Pay, Yoma MMQR and CyberSource, each in its own package with the same three steps.
- **One typed result per flow.** `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment` holds exactly what the next step needs: a URL to redirect to, an auto-submitting form, a QR code or the signed order for the KBZ Pay mobile SDK. See [Payment Flows](/go-myanmar-payments/payment-flows).
- **Exact amounts, checked against each gateway's rules.** An `Amount` is kept as decimal text and never passes through a `float64`. Decimals, currency and limits follow each gateway's official documentation and are checked before any request is sent. See [Amounts](/go-myanmar-payments/amounts).
- **Verified callbacks.** `HandleCallback()` checks the gateway's signature without a network call, maps its status onto one `PaymentStatus` and gives you the acknowledgement the gateway expects. When a callback is late, ask KBZ Pay, AYA Pay or Yoma MMQR with `Status()`. See [Callbacks & Status](/go-myanmar-payments/callbacks).
- **Typed errors.** A missing setting, an invalid field, a gateway error and a bad signature each return their own error struct, matched with `errors.As`, with a message that names the setting, the field or the gateway's code.
- **Standard library only.** No dependencies: requests go through `net/http` or any `HTTPDoer` you pass, every network call takes a `context.Context`, and gateways are safe for concurrent use. Yoma MMQR tokens go in any `TokenCache`, such as Redis. Goravel apps use [Goravel Myanmar Payments](/goravel-myanmar-payments/introduction), which wraps this module.
- **Same behavior in every language.** The PHP, Go, Node.js and Python SDKs pass one shared set of test vectors for signing and callback verification, and read the same environment variables, so one `.env` file and one Yoma MMQR token cache serve them all.
- **Nothing stored for you.** The module keeps no tables and no webhook log. [Handling Webhooks](/go-myanmar-payments/webhooks) shows the recommended flow as code you copy: verify, store, acknowledge, then process each call once.
- **Easy to test.** Every gateway call goes through the `HTTPDoer` you pass, so your tests fake the responses with `httptest`, replay signed callbacks and never touch the network. See [Testing](/go-myanmar-payments/testing).
