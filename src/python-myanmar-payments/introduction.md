---
title: Introduction
---

<PackageIntroduction />

## Why Python Myanmar Payments

Every Myanmar payment gateway signs its requests and callbacks its own way, reports its own status codes and has its own rules for amounts. Python Myanmar Payments handles all of that behind one typed API for Django, Flask, FastAPI and any other framework: build the payment data, start the payment, then verify the callback the gateway sends back.

- **Five gateways, one pattern.** KBZ Pay (PWA, QR and in-app), Wave Money, AYA Pay, Yoma MMQR and CyberSource, each with its own class and the same three steps.
- **One typed result per flow.** `RedirectPayment`, `FormPayment`, `QrPayment` or `AppPayment` holds exactly what the next step needs: a URL to redirect to, an auto-submitting form, a QR code or the signed order for the KBZ Pay mobile SDK. See [Payment Flows](/python-myanmar-payments/payment-flows).
- **Exact amounts, checked against each gateway's rules.** An `Amount` is kept as decimal text, takes an `int` of any size or a `Decimal`, and never passes through a `float`. Decimals, currency and limits follow each gateway's official documentation and are checked before any request is sent. See [Amounts](/python-myanmar-payments/amounts).
- **Verified callbacks.** `handle_callback()` checks the gateway's signature without a network call, maps its status onto one `PaymentStatus` enum and gives you the acknowledgement the gateway expects. When a callback is late, ask KBZ Pay, AYA Pay or Yoma MMQR with `status()`. See [Callbacks & Status](/python-myanmar-payments/callbacks).
- **Errors that say what went wrong.** A missing setting, an invalid field, a gateway error and a bad signature each raise their own exception, with a message that names the setting, the field or the gateway's code.
- **Sync and async.** Every gateway that calls an API has a sync class for Django, Flask and other WSGI code and an async twin with the same methods for FastAPI, Starlette and async Django views. The only dependency is `httpx`, and the package is fully typed and checked with `mypy --strict`.
- **Same behavior in every language.** The PHP, Go, Node.js and Python SDKs pass one shared set of test vectors for signing and callback verification, and read the same environment variables, so one `.env` file and one Yoma MMQR token cache serve them all.
- **Nothing stored for you.** The package keeps no tables and no webhook log. [Handling Webhooks](/python-myanmar-payments/webhooks) shows the recommended flow as code you copy: verify, store, acknowledge, then process each call once.
- **Easy to test.** Every gateway call goes through `httpx`, so your tests fake the responses with `httpx.MockTransport` or respx, replay signed callbacks and never touch the network. See [Testing](/python-myanmar-payments/testing).
