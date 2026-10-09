---
title: Installation
description: Install Go Myanmar Payments with go get. Requires Go 1.22+ and has no dependencies outside the standard library.
---

# Installation

## Via go get

> **Requires** Go 1.22+. No dependencies outside the standard library.

```bash
go get github.com/laranex/go-myanmar-payments/v4
```

The module has one root package with the shared types and one package per gateway:

| Import path | Contents |
|---|---|
| `github.com/laranex/go-myanmar-payments/v4` | `Amount`, results, `PaymentCallback`, `PaymentStatus`, `CallbackRequest`, errors, `HTTPDoer`, `TokenCache` |
| `github.com/laranex/go-myanmar-payments/v4/kbzpay` | KBZ Pay |
| `github.com/laranex/go-myanmar-payments/v4/wavemoney` | Wave Money |
| `github.com/laranex/go-myanmar-payments/v4/ayapay` | AYA Payment Gateway |
| `github.com/laranex/go-myanmar-payments/v4/yomammqr` | Yoma MMQR |
| `github.com/laranex/go-myanmar-payments/v4/cybersource` | CyberSource Secure Acceptance |

The module path carries the major version, so every import ends in `/v4`. The root package is named `myanmarpayments`; the examples import it under that name.

## Quick Start

```go
package main

import (
	"log"
	"net/http"
	"os"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

func main() {
	kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		// *myanmarpayments.ConfigurationError names the missing setting
		log.Fatal(err)
	}

	http.HandleFunc("GET /checkout", func(
		w http.ResponseWriter, r *http.Request,
	) {
		payment, err := kbz.PWA(r.Context(), kbzpay.PaymentData{
			OrderID:     "ORDER_1",
			Amount:      myanmarpayments.Kyat(1000),
			CallbackURL: "https://shop.test/payments/kbz/callback",
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		http.Redirect(w, r, payment.URL, http.StatusFound)
	})

	http.HandleFunc("POST /payments/kbz/callback", func(
		w http.ResponseWriter, r *http.Request,
	) {
		request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		callback, err := kbz.HandleCallback(request)
		if err != nil {
			http.Error(w, "invalid signature", http.StatusBadRequest)
			return
		}
		if callback.IsSuccessful() {
			// compare callback.Amount with your order,
			// then fulfill callback.OrderID
		}
		callback.Acknowledgement.Write(w) // KBZ Pay expects a plain "success"
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

See [net/http Integration](/go-myanmar-payments/net-http) for a full handler setup.
