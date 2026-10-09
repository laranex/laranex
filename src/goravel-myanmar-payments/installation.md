---
title: Installation
description: Install Goravel Myanmar Payments with go get and package:install, which registers the service provider, writes config/myanmar_payments.go and adds the gateway variables to .env.example.
---

# Installation

## Install the Package

> **Requires** Go 1.25+ and Goravel 1.18+.

```bash
go get github.com/laranex/goravel-myanmar-payments/v4
./artisan package:install github.com/laranex/goravel-myanmar-payments/v4
```

`package:install` registers `&payments.ServiceProvider{}` in `bootstrap/providers.go`, writes `config/myanmar_payments.go` and appends the gateway variables (`KBZ_PAY_*`, `WAVE_MONEY_*`, `AYA_PAY_*`, `YOMA_MMQR_*`, `CYBER_SOURCE_*`) to `.env.example`. `./artisan package:uninstall github.com/laranex/goravel-myanmar-payments/v4` removes the provider and the config file.

The facade (`paymentsfacades.MyanmarPayments()`) returns the `*payments.Manager` singleton the provider binds, which you can also resolve with `payments.Resolve(app)`.

The package is a thin Goravel layer over [`github.com/laranex/go-myanmar-payments/v4`](https://github.com/laranex/go-myanmar-payments), which `go get` installs alongside it. The SDK talks to gateways through any `HTTPDoer`; in Goravel every call goes through Goravel's HTTP client, so `Fake()` works in your tests and no extra client is needed.

## Publish the Config

`package:install` already wrote the config. To install by hand, add the provider to `bootstrap/providers.go`:

```go
import (
	"github.com/goravel/framework/contracts/foundation"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
)

func Providers() []foundation.ServiceProvider {
	return []foundation.ServiceProvider{
		// ...
		&payments.ServiceProvider{},
	}
}
```

Then publish the config:

```bash
./artisan vendor:publish \
  --package=github.com/laranex/goravel-myanmar-payments/v4
```

This creates `config/myanmar_payments.go` (the tags `goravel-myanmar-payments` and `goravel-myanmar-payments-config` select the same file). Publishing is optional: every value is read from environment variables. See [Configuration](/goravel-myanmar-payments/configuration).

## Framework Services

The provider uses whatever is registered and degrades gracefully:

| Service | Used for | Without it |
|---|---|---|
| HTTP client (`&http.ServiceProvider{}`) | Gateway calls, so `Fake()` works in tests | A plain `*http.Client` with the configured timeout |
| Cache (`&cache.ServiceProvider{}`) | Sharing Yoma MMQR access tokens | The SDK's in-memory cache, per process |
| Crypt (`&crypt.ServiceProvider{}`, `APP_KEY`) | Encrypting auto-submit form links | `AutoSubmitURL` returns `payments.ErrCryptNotAvailable` |
| Route | The auto-submit form route | No route is registered |

## What It Provides

| Name | What it is |
|---|---|
| `paymentsfacades.MyanmarPayments()` | The `*payments.Manager` of the registered application. Panics when the provider is not registered |
| `payments.Manager` | `KbzPay()`, `WaveMoney()`, `AyaPay()`, `YomaMmqr()`, `CyberSource()`, `Gateway(name)`, `HandleCallback(name, request)`, `AutoSubmitURL(form)`, `ResolveFormPayment(payload)`, `ServeForm(ctx)` |
| `payments.CallbackRequestFromContext(ctx)` | Turns a Goravel request into the SDK's `*myanmarpayments.CallbackRequest` |
| `payments.Acknowledge(ctx, callback)` | The response the gateway expects after a callback |
| `payments.AutoSubmitURL(form)` | `Manager.AutoSubmitURL` on the registered application's manager |
| `payments.GatewayKbzPay`, `GatewayWaveMoney`, `GatewayAyaPay`, `GatewayYomaMmqr`, `GatewayCyberSource`, `GatewayNames()` | The gateway names `Gateway` and `HandleCallback` accept: `kbz-pay`, `wave-money`, `aya-pay`, `yoma-mmqr`, `cyber-source` |
| `payments.CallbackHandler` | What `Gateway(name)` returns: anything with `HandleCallback` |
| `payments.ServiceProvider` | The provider `package:install` registers. It binds the manager, publishes the config and registers the form route |
| `payments.Registered()`, `payments.Resolve(app)` | The manager with an error instead of a panic |
| `payments.NewManager(payments.Options{...})` | Builds a manager outside the container. `Options` holds `Config` (required), `HTTPClient` (nil uses the SDK's default client), `TokenCache` (nil uses the SDK's in-memory cache), `Crypt` (nil disables `AutoSubmitURL`) and `Now` (nil uses `time.Now`) |
| `payments.NewHTTPClient(factory, name, timeout)` | The `myanmarpayments.HTTPDoer` the provider uses: each request goes through the Goravel HTTP client `name` (empty means the default) with `timeout`. A nil factory sends requests with a plain `*http.Client` |
| `payments.NewTokenCache(store)` | The `myanmarpayments.TokenCache` the provider uses for Yoma MMQR tokens, backed by a Goravel cache store |
| `payments.ErrUnknownGateway`, `ErrFormRouteDisabled`, `ErrCryptNotAvailable`, `ErrInvalidFormLink` | The package's own errors; see [Errors](/goravel-myanmar-payments/references/errors) |
| `payments.Binding`, `PackageName`, `ConfigKey`, `FormRouteName` | `laranex.myanmar_payments`, `github.com/laranex/goravel-myanmar-payments/v4`, `myanmar_payments` and `myanmar-payments.form` |
| `payments.DefaultFormRoutePath`, `DefaultFormRouteTTL`, `DefaultHTTPTimeout` | The defaults without a published config: `myanmar-payments/form`, 30 minutes and 30 seconds |

Payment data, results, `PaymentCallback`, `PaymentStatus`, `Amount` and errors are the SDK's own types, imported from `github.com/laranex/go-myanmar-payments/v4` (as `myanmarpayments`) and its gateway packages `kbzpay`, `wavemoney`, `ayapay`, `yomammqr` and `cybersource`.

## Without Goravel

Plain Go projects can install the SDK directly and use the same gateways, payment data and results. See the [Go Myanmar Payments docs](/go-myanmar-payments/introduction) for the full guide.

```bash
go get github.com/laranex/go-myanmar-payments/v4
```

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

// The zero value of Production selects the sandbox.
kbz, err := kbzpay.New(kbzpay.Config{
	AppID:        "...",
	AppKey:       "...",
	MerchantCode: "...",
}, nil)

payment, err := kbz.PWA(r.Context(), kbzpay.PaymentData{
	OrderID:     "ORDER_1",
	Amount:      myanmarpayments.Kyat(10000),
	CallbackURL: "https://shop.test/payments/kbz/callback",
})

// In the callback handler
request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
callback, err := kbz.HandleCallback(request)
err = callback.Acknowledgement.Write(w)
```
