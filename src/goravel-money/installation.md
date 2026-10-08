---
title: Installation
description: Install Goravel Money with go get and package:install, which registers the service provider, writes config/money.go and adds MONEY_CURRENCY to .env.example.
---

# Installation

> **Requires** Go 1.25+ and Goravel 1.18+.

```bash
go get github.com/laranex/goravel-money/v4
./artisan package:install github.com/laranex/goravel-money/v4
```

`package:install`:

- registers `&money.ServiceProvider{}` in `bootstrap/providers.go`
- writes `config/money.go`
- adds `MONEY_CURRENCY=USD` to `.env.example`

`./artisan package:uninstall github.com/laranex/goravel-money/v4` removes the provider and the config file.

## Installing by hand

Add `&money.ServiceProvider{}` (import `money "github.com/laranex/goravel-money/v4"`) to `bootstrap/providers.go`, then publish the config:

```bash
./artisan vendor:publish --package=github.com/laranex/goravel-money/v4
```

The tags `goravel-money` and `goravel-money-config` select the same file (use them together with `--package`).

## Configuration

`config/money.go` has one setting:

```go
config.Add("money", map[string]any{
	"default_currency": config.Env("MONEY_CURRENCY", "USD"),
})
```

`default_currency` is the ISO 4217 code used whenever you pass an empty currency code, and by `money.Column[money.Default]` fields. Without the published file the provider reads `MONEY_CURRENCY`, then falls back to `USD`. An unknown code makes `facades.Money()` panic the first time it is used, so a typo shows up immediately.

## Packages

| Import path | Name used in these docs | Contents |
|---|---|---|
| `github.com/laranex/goravel-money/v4` | `money` | `Money`, `Currency`, `Parse`, `Manager`, `Column`, errors, `ServiceProvider` |
| `github.com/laranex/goravel-money/v4/facades` | `moneyfacades` | `Money()` |
| `github.com/laranex/goravel-money/v4/iso` | `iso` | One type per ISO 4217 currency for `Column` fields: `iso.MMK`, `iso.USD`, ... |
