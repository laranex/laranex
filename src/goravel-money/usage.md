---
title: Usage
description: Create, parse, format, compare and add Money values, store them in integer columns with money.Column, serialize them to JSON and handle errors.
---

# Usage

`money.Money` is an immutable amount in **integer minor units** (cents) of one ISO 4217 currency. It never passes through a `float64`.

## The facade

```go
import (
	money "github.com/laranex/goravel-money/v4"
	moneyfacades "github.com/laranex/goravel-money/v4/facades"
)

manager := moneyfacades.Money() // *money.Manager

price, err := manager.Parse("10.50", "")   // 1050 minor units in the default currency
cost, err := manager.Make(250000, "MMK")   // 2500.00 MMK from minor units
manager.Format(price)                      // "10.50"
manager.DefaultCurrency().Code()           // "USD"
usd, err := manager.Currency("usd")        // codes are case-insensitive
```

An empty currency code means the [default currency](/goravel-money/installation#configuration). `moneyfacades.Money()` panics when the service provider is not registered; `money.Registered()` returns the manager with an error instead.

## Without the container

```go
usd := money.MustCurrency("USD")          // panics on an unknown code; LookupCurrency returns an error
m := money.New(1050, usd)                 // 10.50 USD
m, err := money.Parse("10.50", usd)
m.Amount()                                // 1050 (int64 minor units)
m.Currency().Code()                       // "USD"
m.Decimal()                               // "10.50"
m.String()                                // "10.50 USD"
```

`money.Currencies()` lists every active ISO 4217 currency (179, the same list as Laravel Money); a `Currency` has `Code`, `Name`, `NumericCode` and `MinorUnits`.

## Precision

Minor units come from ISO 4217:

| Currency | Minor units | `Parse("2500.5", ...)` | `Decimal()` of 1 minor unit |
|---|---|---|---|
| USD, MMK | 2 | 250050 | `"0.01"` |
| JPY | 0 | 2501 | `"1"` |
| BHD | 3 | 2500500 | `"0.001"` |

Never hard-code two decimals; read `currency.MinorUnits()`.

## Parsing rules

`Parse` and `Manager.Parse` follow moneyphp's decimal parser, which Laravel Money uses, so both packages agree on every input:

- surrounding whitespace is trimmed; an empty string is zero
- `"10.50"`, `"-0.5"`, `".5"` and `"2500"` are accepted
- extra fraction digits round half away from zero: `"10.555"` USD is 1056, `"-10.555"` is -1056
- thousands separators (`"1,000"`), a leading `+`, exponents (`"1e3"`) and other characters return `ErrInvalidDecimal`
- amounts outside `int64` minor units return `ErrOverflow`

## Comparing and arithmetic

```go
a := money.New(1050, usd)
b := money.New(250, usd)

sum, err := a.Add(b)          // 13.00 USD
diff, err := a.Subtract(b)    // 8.00 USD
order, err := a.Compare(b)    // 1 (-1, 0 or 1)
a.Equals(b)                   // false: same amount and currency
a.SameCurrency(b)             // true
a.IsZero(); a.IsPositive(); a.IsNegative()
```

`Add`, `Subtract` and `Compare` return `ErrCurrencyMismatch` for different currencies and `ErrOverflow` when the result does not fit in `int64`.

## Storing money with the ORM

`money.Column[C]` stores the amount in an integer column. The currency is part of the field's type, so the column holds only the minor units:

```go
import (
	"github.com/goravel/framework/database/orm"
	money "github.com/laranex/goravel-money/v4"
	"github.com/laranex/goravel-money/v4/iso"
)

type Product struct {
	orm.Model
	Name  string
	Price money.Column[money.Default] `json:"price"` // the configured default currency
	Cost  money.Column[iso.MMK]       `json:"cost"`  // always MMK
}
```

Create the columns as nullable big integers:

```go
table.BigInteger("price").Nullable()
table.BigInteger("cost").Nullable()
```

Write and read them:

```go
price, err := moneyfacades.Money().Parse(ctx.Request().Input("price"), "")
product := Product{
	Name:  "Tea",
	Price: money.NewColumn[money.Default](price),
	Cost:  money.NewColumn[iso.MMK](money.New(250000, money.MustCurrency("MMK"))),
}
err = facades.Orm().Query().Create(&product) // price = 1050, cost = 250000

var fresh Product
err = facades.Orm().Query().FindOrFail(&fresh, product.ID)
fresh.Price.Valid  // false for NULL
fresh.Price.Money  // money.Money
fresh.Cost.Ptr()   // *money.Money, nil for NULL
```

Saving a `Money` in another currency than the column's fails with `ErrCurrencyMismatch`; reading a non-integer value fails with `ErrInvalidStoredAmount`. `Column[money.Default]` follows `money.default_currency`, so changing the default later reinterprets existing rows; use a fixed `iso.*` currency for columns that must never change.

## JSON

`Money` and `Column` encode as an object with the minor units as a string, the same shape as Laravel Money, and safe for JavaScript:

```json
{"price": {"amount": "1050", "currency": "USD"}, "cost": {"amount": "250000", "currency": "MMK"}}
```

A NULL column encodes as `null`. Decoding accepts the amount as a string or an integer.

## Errors

Every error is a `*money.InvalidMoneyError` wrapping one reason; check it with `errors.Is`:

```go
price, err := moneyfacades.Money().Parse(ctx.Request().Input("price"), "")
if errors.Is(err, money.ErrInvalidDecimal) {
	return ctx.Response().Json(http.StatusUnprocessableEntity, http.Json{"message": err.Error()})
}
```

| Reason | When |
|---|---|
| `ErrUnknownCurrency` | The code is not an active ISO 4217 currency |
| `ErrInvalidDecimal` | `Parse` input is not a plain decimal |
| `ErrOverflow` | The amount does not fit in `int64` minor units |
| `ErrCurrencyMismatch` | Arithmetic, comparison or a column write mixes currencies |
| `ErrInvalidStoredAmount` | A column or JSON value is not an integer amount |
