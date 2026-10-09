---
title: Installation
description: Install Goravel Money, set the default currency and review the configuration.
---

# Installation

```bash
go get github.com/laranex/goravel-money/v4
./artisan package:install github.com/laranex/goravel-money/v4
```

`package:install` registers `&money.ServiceProvider{}` in `bootstrap/providers.go`, writes `config/money.go` and adds `MONEY_CURRENCY=USD` to `.env.example`. `./artisan package:uninstall github.com/laranex/goravel-money/v4` removes the provider and the config file.

Goravel Money needs no C extension or ICU: locale-aware formatting such as `$1,234.50` uses CLDR data built into the package. Without a locale, money formats as `USD 1234.50`.

## Default Currency

Set the default currency in your `.env`. It must be an ISO 4217 code or a custom currency, and defaults to `USD`:

```ini
MONEY_CURRENCY=USD
```

## Configuration

To install by hand, add `&money.ServiceProvider{}` (import `money "github.com/laranex/goravel-money/v4"`) to `bootstrap/providers.go`. Publishing the config file is optional; without it, the package reads `MONEY_CURRENCY` and uses the defaults below:

```bash
./artisan vendor:publish --package=github.com/laranex/goravel-money/v4
```

The tags `goravel-money` and `goravel-money-config` (used with `--package`) select the same file, `config/money.go`:

```go
config.Add("money", map[string]any{
	"default_currency": config.Env("MONEY_CURRENCY", "USD"),

	"rounding": "half_up",

	"currencies": map[string]any{
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

| Option | Default | Description |
|---|---|---|
| `default_currency` | `MONEY_CURRENCY`, else `USD` | Used whenever a currency code is empty, and by `money.Column[money.Default]` fields. An ISO 4217 code or a custom currency |
| `rounding` | `half_up` | Default rounding for multiplication, division, percentages, averages and `RoundTo`. See [Rounding](/goravel-money/arithmetic#rounding) |
| `currencies` | none | Custom currencies as code => decimal places, e.g. `"PTS": 0`. They take precedence over ISO 4217, so `"MMK": 0` changes MMK's precision |
| `locale` | `app.locale` | Locale for `Format()` and the `formatted` key, e.g. `en`, `de_DE`, `my_MM` |
| `serialization` | minor + decimal + formatted | The [serialized shape](/goravel-money/usage#serialization) of `Money` |

An unknown default currency or an invalid value makes `moneyfacades.Money()` panic the first time it is used, so a typo shows up immediately. Outside a Goravel application (plain Go, tests), `money.DefaultConfig()` applies.

::: warning Changing precision
Integer columns store minor units, so a currency's precision decides how they are read. Don't change the precision of a currency (in `currencies`) once amounts are stored in it.
:::

## What's Included

| Package | Contents |
|---|---|
| `github.com/laranex/goravel-money/v4` (`money`) | `Money`, `Currency`, `Rounding`, `Manager`, the column types, the errors and `ServiceProvider` |
| `github.com/laranex/goravel-money/v4/facades` (`moneyfacades`) | `Money()`, the facade: building money, the configuration and the currency registry |
| `github.com/laranex/goravel-money/v4/iso` (`iso`) | One marker per ISO 4217 currency for the [column types](/goravel-money/columns): `iso.MMK`, `iso.USD`, ... |
