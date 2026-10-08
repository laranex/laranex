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

`config/money.go` mirrors Laravel Money's `config/money.php`:

```go
config.Add("money", map[string]any{
	"default_currency": config.Env("MONEY_CURRENCY", "USD"),
	"rounding":         "half_up",
	"currencies":       map[string]any{
		// "PTS": 0,
	},
	"locale": "",
	"serialization": map[string]any{
		"amount":            "minor",
		"include_decimal":   true,
		"include_formatted": true,
	},
})
```

| Key | Default | Meaning |
|---|---|---|
| `default_currency` | `MONEY_CURRENCY`, else `USD` | Used whenever a currency code is empty, and by `money.Column[money.Default]` fields. An ISO 4217 code or a custom currency. |
| `rounding` | `half_up` | Default rounding for `Times`, `DividedBy`, `Percent`, `Avg`, `RoundTo`... See [rounding](/goravel-money/arithmetic#rounding). |
| `currencies` | none | Custom currencies as code => decimal places, e.g. `"PTS": 0`. They take precedence over ISO 4217, so `"MMK": 0` changes MMK's precision. |
| `locale` | `app.locale` | Locale for `Format()` and the `formatted` JSON key, e.g. `en`, `de_DE`, `my_MM`. |
| `serialization` | minor + decimal + formatted | The [JSON shape](/goravel-money/usage#json) of `Money`. |

Without the published file the provider reads `MONEY_CURRENCY` and uses the defaults above. An unknown default currency or an invalid value makes `facades.Money()` panic the first time it is used, so a typo shows up immediately. Outside a Goravel application (plain Go, tests), `money.DefaultConfig()` applies.

## Packages

| Import path | Name used in these docs | Contents |
|---|---|---|
| `github.com/laranex/goravel-money/v4` | `money` | `Money`, `Currency`, `Rounding`, `Parse`, `Manager`, the column types, errors, `ServiceProvider` |
| `github.com/laranex/goravel-money/v4/facades` | `moneyfacades` | `Money()` |
| `github.com/laranex/goravel-money/v4/iso` | `iso` | One type per ISO 4217 currency for `Column` and `DecimalColumn` fields: `iso.MMK`, `iso.USD`, ... |
