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

`package:install` registers `&payments.ServiceProvider{}` in `bootstrap/providers.go`, writes `config/myanmar_payments.go` and appends the gateway variables (`KBZ_PAY_*`, `WAVE_PAY_*`, `AYA_PAY_*`, `YOMA_MMQR_*`, `CYBER_SOURCE_*`) to `.env.example`. `./artisan package:uninstall github.com/laranex/goravel-myanmar-payments/v4` removes the provider and the config file.

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
| `payments.Manager` | `KbzPay()`, `WavePay()`, `AyaPay()`, `YomaMmqr()`, `CyberSource()`, `Gateway(name)`, `HandleCallback(name, request)`, `AutoSubmitURL(form)`, `ResolveFormPayment(payload)`, `ServeForm(ctx)` |
| `payments.CallbackRequestFromContext(ctx)` | Turns a Goravel request into the SDK's `*myanmarpayments.CallbackRequest` |
| `payments.Acknowledge(ctx, callback)` | The response the gateway expects after a callback |
| `payments.AutoSubmitURL(form)` | `Manager.AutoSubmitURL` on the registered application's manager |
| `payments.GatewayKbzPay`, `GatewayWavePay`, `GatewayAyaPay`, `GatewayYomaMmqr`, `GatewayCyberSource`, `GatewayNames()` | The gateway names `Gateway` and `HandleCallback` accept: `kbz-pay`, `wave-pay`, `aya-pay`, `yoma-mmqr`, `cyber-source` |
| `payments.CallbackHandler` | What `Gateway(name)` returns: anything with `HandleCallback` |
| `payments.ServiceProvider` | The provider `package:install` registers. It binds the manager, publishes the config and registers the form route |
| `payments.Registered()`, `payments.Resolve(app)` | The manager with an error instead of a panic |
| `payments.NewManager(payments.Options{...})` | Builds a manager outside the container. `Options` holds `Config` (required), `HTTPClient` (nil uses the SDK's default client), `TokenCache` (nil uses the SDK's in-memory cache), `Crypt` (nil disables `AutoSubmitURL`) and `Now` (nil uses `time.Now`) |
| `payments.NewHTTPClient(factory, name, timeout)` | The `myanmarpayments.HTTPDoer` the provider uses: each request goes through the Goravel HTTP client `name` (empty means the default) with `timeout`. A nil factory sends requests with a plain `*http.Client` |
| `payments.NewTokenCache(store)` | The `myanmarpayments.TokenCache` the provider uses for Yoma MMQR tokens, backed by a Goravel cache store |
| `payments.ErrUnknownGateway`, `ErrFormRouteDisabled`, `ErrCryptNotAvailable`, `ErrInvalidFormLink`, `ErrCallbackBodyTooLarge` | The package's own errors; see [Errors](/goravel-myanmar-payments/references/errors) |
| `payments.Binding`, `PackageName`, `ConfigKey`, `FormRouteName` | `laranex.myanmar_payments`, `github.com/laranex/goravel-myanmar-payments/v4`, `myanmar_payments` and `myanmar-payments.form` |
| `payments.DefaultFormRoutePath` | The form route path without a published config: `myanmar-payments/form` |
| `payments.MaxCallbackBodyBytes`, `payments.DefaultHTTPTimeoutSeconds` | 64 KiB, the largest callback body `CallbackRequestFromContext` reads; 30, the HTTP timeout when `MYANMAR_PAYMENTS_HTTP_TIMEOUT` is blank |

Payment data, results, `PaymentCallback`, `PaymentStatus`, `Amount` and errors are the SDK's own types, imported from `github.com/laranex/go-myanmar-payments/v4` (as `myanmarpayments`) and its gateway packages `kbzpay`, `wavepay`, `ayapay`, `yomammqr` and `cybersource`.

## Without Goravel

Plain Go projects use [Go Myanmar Payments](/go-myanmar-payments/introduction) directly.
