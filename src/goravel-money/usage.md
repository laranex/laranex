---
title: Usage
description: Create, read, compare, format and serialize Money values in any currency, and handle errors.
---

# Usage

`money.Money` is an immutable amount in a currency, held as an exact integer number of minor units (cents) of any size. Every method returns a new value, and no amount ever passes through a `float64`.

## Creating Money

```go
import (
	money "github.com/laranex/goravel-money/v4"
	moneyfacades "github.com/laranex/goravel-money/v4/facades"
)

manager := moneyfacades.Money() // *money.Manager

// from a decimal string
price, err := manager.Of("1234.50", "USD")
// one comma or space separator may group thousands; default currency
price, err = manager.Of("1,234.50", "")
// an int is a whole amount: 1234 JPY
yen, err := manager.Of(1234, "JPY")
// from minor units (cents): 1234.50 USD
cents, err := manager.OfMinor(123450, "USD")
// minor units of any size
huge, err := manager.OfMinor("99999999999999999999", "USD")
// 0.000 KWD
zero, err := manager.Zero("KWD")

usd := money.MustCurrency("USD")
price, err = money.Of("12.34", usd) // without the container
price = money.MustOf("12.34", usd)  // panics on an error, for constants
```

An empty currency code means `money.default_currency`. Codes are case-insensitive. An unknown code returns an `*money.UnknownCurrencyError`. `moneyfacades.Money()` panics when the service provider is not registered; `money.Registered()` returns the manager with an error instead. Without the container, pass a `money.Currency` from `money.LookupCurrency` (or `money.MustCurrency`, which panics on an unknown code). `money.Parse` is `money.Of` for strings only, and `money.New` and `money.FromBigInt` build money from `int64` and `*big.Int` minor units.

### Precision Is Strict

Each currency has a fixed number of decimals. Extra decimals that are zeros are fine; anything else returns a `*money.ParseError` (`money.ErrTooManyDecimals`) that tells you how many decimals the currency allows. Pass a rounding mode to round instead:

```go
jpy := money.MustCurrency("JPY")

money.Of("12.500", usd)                // 12.50 USD
// error: USD allows 2 decimal places, but "1.234" has 3...
money.Of("1.234", usd)
money.Of("1.235", usd, money.HalfUp)   // 1.24 USD
money.Of("2.5", jpy, money.HalfEven)   // 2 JPY
```

Only ASCII digits, an optional sign, one dot as the decimal separator, and commas or spaces grouping thousands are accepted. `"12,50"`, `".5"`, `"5."`, `"1e3"`, `"$10"` and localized digits such as `"၁၂၃"` return a `*money.ParseError` (`money.ErrInvalidDecimal`) rather than guessing; normalize user input before parsing it.

Grouping must be consistent. Plain digits (`"1234567.89"`) are always fine; a grouped amount uses one separator throughout (a comma, a space, a no-break space or a narrow no-break space), in Western groups of three or in Indian grouping, where the last group has three digits and earlier groups two:

```go
money.Of("1,234,567.89", usd) // Western grouping
money.Of("12,34,567.89", usd) // Indian grouping
money.Of("1 234 567.89", usd) // spaces

money.Of("1 234,567", usd)    // ErrInvalidDecimal: mixed separators
money.Of("1,234,56,789", usd) // ErrInvalidDecimal: irregular groups
// ErrInvalidDecimal: the decimal separator is always a dot
money.Of("1.234.567,89", usd)
```

### Custom Currencies

Register extra codes, or change an ISO precision, under `money.currencies`:

```go
"currencies": map[string]any{
	"PTS": 0, // loyalty points, no decimals
},
```

```go
points, err := manager.Of("300", "PTS")
```

A currency is identified by its code and its precision, so `money.MustCurrency("MMK")` (ISO, 2 decimals) and an MMK overridden to 0 decimals are different currencies: combining them returns a `*money.CurrencyMismatchError`. Resolve codes through the manager so the whole application uses the same precision.

### No Floats

Floats can't hold most decimal amounts exactly, so every method that takes an amount, multiplier or percentage rejects them with `money.ErrInvalidOperand` and suggests a string:

```go
// error: floats are not accepted for money (1.1 given)...;
// pass a string such as "1.1", or an integer
price.Times(1.1)
price.Times("1.1") // fine
```

## Reading Money

```go
m, err := manager.Of("1234.5", "USD")

m.Amount()  // "123450"   minor units, always a string
m.Decimal() // "1234.50"  with the currency's precision
// money.Currency: Code() "USD", Name() "US Dollar", NumericCode() 840
m.Currency()
m.Precision() // 2

m.IsZero()
m.IsPositive()
m.IsNegative()
```

Minor units come from ISO 4217: USD and MMK have 2, JPY 0, KWD and BHD 3, CLF 4. Never hard-code two decimals. `money.Currencies()` lists every active ISO 4217 currency, and `m.Sign()` returns -1, 0 or 1.

## Comparing

Comparisons accept another `Money`, or a decimal string or int in the same currency:

```go
price.Equals("19.99")
price.GreaterThan(money.MustOf("10", usd))
price.GreaterThanOrEqual("10")
price.LessThan(20)
price.LessThanOrEqual("19.99")
price.Compare(other)                   // -1, 0 or 1
price.IsSameCurrency(a, b)
```

`Equals` returns `false` for different currencies. The other comparisons return a `*money.CurrencyMismatchError` that names both amounts. Every comparison returns an error for an operand that is not a valid amount, such as a float or `"abc"`. `Money` is comparable, so `==` works and it can be a map key.

## Arithmetic

```go
total, err := price.Plus(shipping, "2.50")
withTax, err := total.AddPercent("8.875")
parts, err := total.Split(3)
```

See [Arithmetic](/goravel-money/arithmetic) for multiplying, dividing, percentages, splitting, rounding and aggregates.

## Formatting

```go
eur := money.MustCurrency("EUR")
inr := money.MustCurrency("INR")

// configured locale: "$1,234.50"
money.MustOf("1234.5", usd).Format()
money.MustOf("1234.5", eur).Format("de_DE")     // "1.234,50 €"
money.MustOf("1500", jpy).Format("en")          // "¥1,500"
money.MustOf("1234567.89", inr).Format("en_IN") // "₹12,34,567.89"
manager.Format(m, "fr_FR")                      // "1 234,50 €"
// "USD 1234.50", never locale-dependent
m.String()
```

The locale defaults to `money.locale`, then `app.locale`. Formatting uses CLDR data generated from ICU 77.1 for the locale's currency symbol, separators, grouping (including Indian lakh grouping) and digits, but builds the number from the exact decimal string, so `123456789012345678901.23` formats without losing a digit. Without a supported locale, `Format()` returns `USD 1234.50`.

`money.Locales()` lists the 61 supported locales. Locales may use `-` or `_` and any case (`de-DE`, `de_DE.UTF-8`), and another region falls back to its language (`de_LU` uses `de`). The output matches ICU character for character.

## Serialization

`json.Marshal`, `m.Fields()` and the column types produce strings, in the shape configured by `money.serialization`:

```json
{
  "amount": "123450",
  "currency": "USD",
  "decimal": "1234.50",
  "formatted": "$1,234.50"
}
```

- `amount`: `minor` (the default, `"123450"`) or `decimal` (`"1234.50"`, and no `decimal` key)
- `include_decimal`: add the `decimal` key when `amount` is `minor`
- `include_formatted`: add the `formatted` key in the configured locale

Decoding reads `amount` and `currency` (the amount as a string or a JSON integer, interpreted as `serialization.amount` says) and ignores the other keys. `money.Currency` and `money.Rounding` encode as `"USD"` and `"half_up"`.

## Interop

`Money` holds its amount with `math/big`:

```go
import "math/big"

m.BigInt() // *big.Int copy
m.Int64()  // 123450, or money.ErrOverflow beyond int64
// 5.00 EUR from *big.Int or int64 minor units
fromBig := money.FromBigInt(big.NewInt(500), eur)
fromInt := money.New(500, eur)
```

`money.ParseRounding("half_even")` turns a config value into a `Rounding`, and `Rounding.String()` turns it back.

## The Facade and the Currency Registry

The `moneyfacades.Money()` facade returns the `*money.Manager`, which builds money and exposes the configuration:

```go
// also OfMinor(), Zero(), Make()
manager.Of("12.34", "USD")
// money.Currency for MMK, validated; "" gives the default
manager.Currency("mmk")
// money.Currency for money.default_currency
manager.DefaultCurrency()
manager.Precision("KWD")  // 3 (default currency for "")
manager.Rounding()        // money.HalfUp, from money.rounding
manager.Locale()          // money.locale, else app.locale
manager.Format(m, "de_DE") // same as m.Format("de_DE")
// money.Serialization{Amount: money.AmountMinor,
//  IncludeDecimal: true, IncludeFormatted: true}
manager.Serialization()
```

`manager.Registry()` returns the `*money.Registry`, which knows every ISO 4217 currency plus your custom ones:

```go
registry := manager.Registry()

registry.Has("PTS")    // true when configured in money.currencies
// money.Currency for JPY; *money.UnknownCurrencyError for unknown codes
registry.Lookup("jpy")
registry.Custom()      // map[PTS:0]
```

The service provider binds the manager under the container key `money.Binding`, so `money.Resolve(app)` returns the same manager. `money.NewManager(money.DefaultConfig())` builds one without the container.

### Custom Formatting

`Format()` uses the built-in CLDR data, and `money.FormatDecimal("-1234.50", "USD", "en")` formats a decimal string directly. To change how money is displayed everywhere, write a function and call it instead of `Format()`:

```go
func codeFirst(m money.Money) string {
	return m.Currency().Code() + " " + m.Decimal() // exact, e.g. "-1234.50"
}
```

## Extending Money

Go types can't gain methods from outside their package, so write functions that take a `Money`:

```go
func withVAT(m money.Money) (money.Money, error) {
	return m.AddPercent(20)
}

withVAT(money.MustOf("10", usd)) // 12.00 USD
```

## Errors

Every error matches `money.ErrMoney` and one specific reason with `errors.Is`, so a controller can answer bad input with a 422:

```go
price, err := moneyfacades.Money().Of(ctx.Request().Input("price"), "")
if errors.Is(err, money.ErrMoney) {
	return ctx.Response().Json(http.StatusUnprocessableEntity, http.Json{
		"message": err.Error(),
	})
}
```

| Error (`errors.As`) | Returned when |
|---|---|
| `*money.ParseError` | an amount is malformed (`ErrInvalidDecimal`), or has more decimals than the currency allows (`ErrTooManyDecimals`) |
| `*money.UnknownCurrencyError` | a currency (or the default currency) is not ISO 4217 or configured (`ErrUnknownCurrency`) |
| `*money.CurrencyMismatchError` | amounts in different currencies are combined, compared or stored together (`ErrCurrencyMismatch`). The message names both amounts |
| `*money.InvalidMoneyError` | a float or another invalid operand is passed, a scale or `RoundTo` decimals are outside the `money.MaxScale` bounds, or a rounding is not a valid mode (`ErrInvalidOperand`), money is divided by zero (`ErrDivisionByZero`), parts or ratios are invalid (`ErrInvalidAllocation`), an aggregate is empty (`ErrEmptyAggregate`), a stored value is invalid (`ErrInvalidStoredAmount`), an amount doesn't fit in an `int64` (`ErrOverflow`), or the config is invalid (`ErrInvalidConfig`) |
