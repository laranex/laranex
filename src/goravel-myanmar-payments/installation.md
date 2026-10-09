---
title: Installation
description: Install Goravel Myanmar Payments with go get and package:install, which registers the service provider, writes config/myanmar_payments.go and adds the gateway variables to .env.example.
---

# Installation

> **Requires** Go 1.25+ and Goravel 1.18+. The Go SDK, [Go Myanmar Payments](/go-myanmar-payments/introduction), comes in as a dependency.

```bash
go get github.com/laranex/goravel-myanmar-payments/v4
./artisan package:install github.com/laranex/goravel-myanmar-payments/v4
```

`package:install`:

- registers `&payments.ServiceProvider{}` in `bootstrap/providers.go`
- writes `config/myanmar_payments.go`
- appends the gateway variables (`KBZ_PAY_*`, `WAVE_MONEY_*`, `AYA_PAY_*`, `YOMA_MMQR_*`, `CYBER_SOURCE_*`) to `.env.example`

`./artisan package:uninstall github.com/laranex/goravel-myanmar-payments/v4` removes the provider and the config file.

## Installing by hand

Add the provider to `bootstrap/providers.go`:

```go
import payments "github.com/laranex/goravel-myanmar-payments/v4"

func Providers() []foundation.ServiceProvider {
	return []foundation.ServiceProvider{
		// ...
		&payments.ServiceProvider{},
	}
}
```

Then publish the config:

```bash
./artisan vendor:publish --package=github.com/laranex/goravel-myanmar-payments/v4
```

The tags `goravel-myanmar-payments` and `goravel-myanmar-payments-config` select the same file. Without a published config the package reads the SDK's environment variables directly, so publishing is optional.

## Packages

| Import path | Name used in these docs | Contents |
|---|---|---|
| `github.com/laranex/goravel-myanmar-payments/v4` | `payments` | `ServiceProvider`, `Manager`, `CallbackRequestFromContext`, `Acknowledge`, `AutoSubmitURL`, `HTTPClient`, `TokenCache` (see the [package reference](/goravel-myanmar-payments/usage#package-reference)) |
| `github.com/laranex/goravel-myanmar-payments/v4/facades` | `paymentsfacades` | `MyanmarPayments()` |
| `github.com/laranex/go-myanmar-payments/v4` | `myanmarpayments` | The SDK's shared types: `Amount`, results, `PaymentCallback`, errors |
| `github.com/laranex/go-myanmar-payments/v4/kbzpay` and the other gateway packages | `kbzpay`, `wavemoney`, `ayapay`, `yomammqr`, `cybersource` | Each gateway's `PaymentData` and `Gateway` |

## Other facades it uses

The provider works with whatever is registered and degrades gracefully:

| Facade | Used for | Without it |
|---|---|---|
| HTTP client (`&http.ServiceProvider{}`) | Gateway calls, so `facades.Http().Fake()` works | A plain `*http.Client` with the configured timeout |
| Cache (`&cache.ServiceProvider{}`) | Sharing Yoma MMQR access tokens | The SDK's in-memory cache, per process |
| Crypt (`&crypt.ServiceProvider{}`, `APP_KEY`) | Encrypting auto-submit form links | `AutoSubmitURL` returns `payments.ErrCryptNotAvailable` |
| Route | The auto-submit form route | No route is registered |

## Quick start

```go
import (
	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func Checkout(ctx http.Context) http.Response {
	kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "%s", err.Error())
	}
	payment, err := kbz.PWA(ctx, kbzpay.PaymentData{
		OrderID:     "ORDER_1",
		Amount:      myanmarpayments.Kyat(1000),
		CallbackURL: "https://shop.test/payments/callback/kbzpay",
	})
	if err != nil {
		return ctx.Response().String(http.StatusBadGateway, "%s", err.Error())
	}
	return ctx.Response().Redirect(http.StatusFound, payment.URL)
}

func KbzCallback(ctx http.Context) http.Response {
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}
	kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
	if err != nil {
		return ctx.Response().String(http.StatusInternalServerError, "not configured")
	}
	callback, err := kbz.HandleCallback(request)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "invalid signature")
	}
	if callback.IsSuccessful() {
		// compare callback.Amount with your order, then fulfill callback.OrderID once
	}
	return payments.Acknowledge(ctx, callback) // KBZ Pay expects a plain "success"
}
```

For production callbacks, follow [Handling webhooks](/goravel-myanmar-payments/webhooks). Next: [Configuration](/goravel-myanmar-payments/configuration).
