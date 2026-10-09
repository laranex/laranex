---
title: Usage
description: Create, read, compare, format and serialize Money values of any size in any currency, and handle errors.
---

# Usage

`money.Money` is an immutable amount in a currency, held as an exact integer number of minor units (cents) of any size. Every method returns a new value, and no amount ever passes through a `float64`.

## Creating money

Inside a Goravel application, use the facade. An empty currency code means `money.default_currency`:

```go
import (
	money "github.com/laranex/goravel-money/v4"
	moneyfacades "github.com/laranex/goravel-money/v4/facades"
)

manager := moneyfacades.Money() // *money.Manager

price, err := manager.Parse("1234.50", "USD")          // from a decimal string
price, err = manager.Parse("1,234.50", "")             // commas and spaces may group thousands; default currency
yen, err := manager.Parse("1234", "JPY")               // a whole amount: 1234 JPY
cents, err := manager.Make(123450, "USD")              // from int64 minor units: 1234.50 USD
huge, err := manager.OfMinor("99999999999999999999", "USD") // minor units of any size
zero, err := manager.Zero("KWD")                       // 0.000 KWD
```

Codes are case-insensitive. An unknown code returns an `*money.UnknownCurrencyError`. `moneyfacades.Money()` panics when the service provider is not registered; `money.Registered()` returns the manager with an error instead.

Without the container, pass a `money.Currency`:

```go
usd := money.MustCurrency("USD")            // panics on an unknown code; LookupCurrency returns an error
price, err := money.Parse("1234.50", usd)
price = money.MustParse("1234.50", usd)     // panics on an error, for constants
cents := money.New(123450, usd)             // int64 minor units
huge, err := money.OfMinor("99999999999999999999", usd)
fromBig := money.FromBigInt(big.NewInt(123450), usd) // *big.Int minor units; nil is zero
zero := money.Zero(usd)
```

### Precision is strict

Each currency has a fixed number of decimals. Extra decimals that are zeros are fine; anything else returns a `*money.ParseError` (`money.ErrTooManyDecimals`) that tells you how many decimals the currency allows. Pass a rounding mode to round instead:

```go
manager.Parse("12.500", "USD")              // 12.50 USD
manager.Parse("1.234", "USD")               // error: USD allows 2 decimal places, but "1.234" has 3; ...
manager.Parse("1.235", "USD", money.HalfUp) // 1.24 USD
manager.Parse("2.5", "JPY", money.HalfEven) // 2 JPY
```

Only digits, an optional sign, one dot as the decimal separator, and commas or spaces grouping thousands (`"1,234,567.89"`, `"12,34,567.00"`, `"1 234.50"`) are accepted. `"12,50"`, `".5"`, `"5."`, `"1e3"` and `"$10"` return `money.ErrInvalidDecimal` rather than guessing.

### Custom currencies

Register extra codes, or change an ISO precision, under `money.currencies`:

```go
"currencies": map[string]any{
	"PTS": 0, // loyalty points, no decimals
},
```

```go
points, err := moneyfacades.Money().Parse("300", "PTS")
```

Without the container, `money.NewCurrency("PTS", 0)` builds one and `money.NewRegistry(map[string]int{"PTS": 0})` resolves codes the same way the manager does: `Lookup(code)` returns the `Currency` (custom first, then ISO 4217), `Has(code)` reports whether it exists, and `Custom()` returns the custom currencies as code => decimal places.

A `Currency` is identified by its code and its precision, so `money.MustCurrency("MMK")` (ISO, 2 decimals) and an MMK overridden to 0 decimals are different currencies: combining them returns a `*money.CurrencyMismatchError`. Resolve codes through the manager (or one `Registry`) so the whole application uses the same precision.

### No floats

Floats can't hold most decimal amounts exactly, so every method that takes an amount, multiplier or percentage rejects them with `money.ErrInvalidOperand` and suggests a string:

```go
price.Times(1.1)   // error: floats are not accepted for money (1.1 given) ...; pass a string such as "1.1"
price.Times("1.1") // fine
```

## Reading money

```go
m, _ := manager.Parse("1234.5", "USD")

m.Amount()     // "123450"   minor units, always a string
m.Decimal()    // "1234.50"  with the currency's precision
m.Int64()      // 123450, or money.ErrOverflow beyond int64
m.BigInt()     // *big.Int copy
m.Currency()   // money.Currency: Code() "USD", Name() "US Dollar", MinorUnits() 2, NumericCode() 840
m.Precision()  // 2

m.IsZero(); m.IsPositive(); m.IsNegative(); m.Sign()
```

`money.Currencies()` lists every active ISO 4217 currency (179, the same list as Laravel Money). Minor units come from ISO 4217: USD and MMK have 2, JPY 0, KWD and BHD 3, CLF 4. Never hard-code two decimals.

## Comparing

Comparisons accept another `Money`, or a decimal string or integer in the same currency:

```go
price.Equals("19.99")                  // bool
price.GreaterThan(money.MustParse("10", usd))
price.GreaterThanOrEqual("10")
price.LessThan(20)
price.LessThanOrEqual("19.99")
price.Compare(other)                   // -1, 0 or 1
price.IsSameCurrency(a, b)
```

`Equals` returns `false` for different currencies. The other comparisons return `(bool, error)` or `(int, error)` with a `*money.CurrencyMismatchError` that names both amounts. `Money` is comparable, so `==` works and it can be a map key.

## Arithmetic

```go
total, err := price.Plus(shipping, "2.50")
withTax, err := total.AddPercent("8.875")
parts, err := total.Split(3)
```

See [Arithmetic](/goravel-money/arithmetic) for multiplying, dividing, percentages, splitting, rounding and aggregates.

## Formatting

```go
money.MustParse("1234.5", usd).Format()            // configured locale: "$1,234.50"
money.MustParse("1234.5", eur).Format("de_DE")     // "1.234,50 €"
money.MustParse("1500", jpy).Format("en")          // "¥1,500"
money.MustParse("1234567.89", inr).Format("en_IN") // "₹12,34,567.89"
money.MustParse("1500", mmk).Format("my_MM")       // "၁,၅၀၀.၀၀ K"
manager.Format(m, "fr_FR")                         // "1 234,50 €"
m.String()                                         // "USD 1234.50", never locale-dependent
```

The locale defaults to `money.locale`, then `app.locale`. Go has no ICU, so the package ships CLDR data generated from ICU 77.1 for 61 locales: the currency symbols, separators, grouping (including Indian lakh grouping), native digits and the positive and negative patterns, with ICU's currency spacing. It builds the output from the exact decimal string, so `123456789012345678901.23` formats without losing a digit, and the output matches ICU character for character (the test suite checks 8,296 ICU outputs).

Supported locales (`money.Locales()`): `ar`, `ar_EG`, `ar_SA`, `de`, `de_AT`, `de_CH`, `de_DE`, `en`, `en_AU`, `en_CA`, `en_GB`, `en_IN`, `en_NZ`, `en_SG`, `en_US`, `es`, `es_ES`, `es_MX`, `fa`, `fa_IR`, `fr`, `fr_CA`, `fr_CH`, `fr_FR`, `he`, `he_IL`, `hi`, `hi_IN`, `id`, `id_ID`, `it`, `it_IT`, `ja`, `ja_JP`, `ko`, `ko_KR`, `ms`, `ms_MY`, `my`, `my_MM`, `nl`, `nl_NL`, `pl`, `pl_PL`, `pt`, `pt_BR`, `pt_PT`, `ru`, `ru_RU`, `sv`, `sv_SE`, `th`, `th_TH`, `tr`, `tr_TR`, `vi`, `vi_VN`, `zh`, `zh_CN`, `zh_HK`, `zh_TW`. Locales may use `-` or `_` and any case (`de-DE`, `de_DE.UTF-8`). Another region falls back to its language (`de_LU` uses `de`); an unsupported or empty locale formats as `USD 1234.50`.

`money.FormatDecimal("-1234.50", "USD", "en")` formats a decimal string directly.

## JSON

`Money` marshals to strings, in the shape configured by `money.serialization`:

```json
{"amount": "123450", "currency": "USD", "decimal": "1234.50", "formatted": "$1,234.50"}
```

- `amount`: `"minor"` (the default, `"123450"`) or `"decimal"` (`"1234.50"`, and no `decimal` key)
- `include_decimal`: add the `decimal` key when `amount` is `"minor"`
- `include_formatted`: add the `formatted` key in the configured locale

`m.Fields()` (or `manager.Fields(m)`) returns the same keys and values in order, as `[]money.Field{Key, Value}`. Decoding reads `amount` and `currency` (the amount as a string or a JSON integer, interpreted as `serialization.amount` says) and ignores the other keys.

`money.Currency` and `money.Rounding` implement `encoding.TextMarshaler`, so they encode as `"USD"` and `"half_up"` in JSON and other text formats. Decoding a `Currency` resolves the code with the configured registry and rejects unknown codes.

## The manager

`*money.Manager` is immutable and safe for concurrent use. Besides `Parse`, `Make`, `OfMinor`, `Zero`, `Format` and `Fields` it exposes the configuration: `DefaultCurrency()`, `Currency(code)`, `Precision(code)`, `Rounding()`, `Locale()`, `Serialization()` and `Registry()`. Build one without the container with `money.NewManager(money.DefaultConfig())`, or from a Goravel config with `money.ConfigFrom(facades.Config())`.

The service provider binds the manager under the container key `money.Binding` (`"laranex.money"`). `money.Resolve(app)` returns it from a given application, and `money.Registered()` from the application the provider was registered with; both return an error instead of panicking.

## Errors

Every error matches `money.ErrMoney` and one specific reason with `errors.Is`, so a controller can answer bad input with a 422:

```go
price, err := moneyfacades.Money().Parse(ctx.Request().Input("price"), "")
if errors.Is(err, money.ErrMoney) {
	return ctx.Response().Json(http.StatusUnprocessableEntity, http.Json{"message": err.Error()})
}
```

The typed errors mirror Laravel Money's exceptions:

| Typed error (`errors.As`) | Laravel Money | Reasons (`errors.Is`) |
|---|---|---|
| `*money.ParseError` | `MoneyParseException` | `ErrInvalidDecimal` (malformed), `ErrTooManyDecimals` (more decimals than the currency allows) |
| `*money.UnknownCurrencyError` | `UnknownCurrencyException` | `ErrUnknownCurrency`: not ISO 4217 or configured; `Default` is true for the default currency |
| `*money.CurrencyMismatchError` | `CurrencyMismatchException` | `ErrCurrencyMismatch`: different currencies combined, compared or stored. The message names both amounts |
| `*money.InvalidMoneyError` | `InvalidMoneyException` | `ErrInvalidOperand` (floats, wrong types), `ErrDivisionByZero`, `ErrInvalidAllocation`, `ErrEmptyAggregate`, `ErrOverflow`, `ErrInvalidStoredAmount`, `ErrInvalidConfig` |
