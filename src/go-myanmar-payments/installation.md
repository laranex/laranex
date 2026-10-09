---
title: Installation
description: Install Go Myanmar Payments with go get. Requires Go 1.22+ and has no dependencies outside the standard library.
---

# Installation

## Via go get

> **Requires** Go 1.22+. No dependencies outside the standard library: it sends the gateway requests with `net/http`.

```bash
go get github.com/laranex/go-myanmar-payments/v4
```

Import the shared types from the root package and each gateway from its own package:

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)
```

The root package holds the shared types. Each gateway has its own package, which exports only that gateway's types:

| Import path | Contents |
|---|---|
| `github.com/laranex/go-myanmar-payments/v4` | `Amount`, results, `PaymentCallback`, `PaymentStatus`, `CallbackRequest`, `Acknowledgement`, errors and `PaymentError`, `HTTPDoer`, `TokenCache` and `MemoryTokenCache` |
| `github.com/laranex/go-myanmar-payments/v4/kbzpay` | `Gateway`, `Config`, `PaymentData`, `Signer` |
| `github.com/laranex/go-myanmar-payments/v4/wavemoney` | `Gateway`, `Config`, `PaymentData`, `Item` |
| `github.com/laranex/go-myanmar-payments/v4/ayapay` | `Gateway`, `Config`, `PaymentData`, `Method`, `Service` |
| `github.com/laranex/go-myanmar-payments/v4/yomammqr` | `Gateway`, `Config`, `PaymentData` |
| `github.com/laranex/go-myanmar-payments/v4/cybersource` | `Gateway`, `Config`, `PaymentData`, `TransactionType` |
| `github.com/laranex/go-myanmar-payments/v4/payments` | `Gateways`, the facade that builds every gateway, with `Config` and `Options` |

The module path carries the major version, so every import ends in `/v4`. The root package is named `myanmarpayments`; the examples import it under that name.

## Quick Start

A `net/http` app that starts a KBZ Pay PWA payment and verifies the callback:

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
	// Returns a *myanmarpayments.ConfigurationError naming the missing
	// setting
	kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		log.Fatal(err)
	}

	http.HandleFunc("GET /checkout", func(
		w http.ResponseWriter, r *http.Request,
	) {
		payment, err := kbz.PWA(r.Context(), kbzpay.PaymentData{
			OrderID:     "ORDER_1",
			Amount:      myanmarpayments.Kyat(10000),
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
		// err is a *myanmarpayments.SignatureVerificationError
		callback, err := kbz.HandleCallback(request)
		if err != nil {
			http.Error(w, "invalid callback", http.StatusBadRequest)
			return
		}
		if callback.IsSuccessful() {
			// compare callback.Amount with your order,
			// then fulfill callback.OrderID
		}
		// KBZ Pay expects a plain "success"
		callback.Acknowledgement.Write(w)
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

See [Framework Integration](/go-myanmar-payments/framework-integration) for `net/http`, chi, Gin and Echo.

## Using Goravel?

Install [`laranex/goravel-myanmar-payments`](/goravel-myanmar-payments/introduction) instead. It wraps this module with a service provider, a facade and a config file, callback helpers for Goravel's request and an auto-submit form route.
