---
title: Columns
description: Store money with Goravel's ORM in integer or DECIMAL columns, with a fixed currency or a currency column per row.
---

# Columns

Money fields on Goravel models (GORM underneath) use the column types below. Each implements `driver.Valuer`, `sql.Scanner` and JSON, and its zero value is `NULL`.

| Type | Column | Currency |
|---|---|---|
| `money.Column[money.Default]` | integer minor units | default currency |
| `money.Column[iso.USD]` | integer minor units | always USD |
| `money.AmountColumn` | integer minor units | from another column of the row |
| `money.DecimalColumn[iso.USD]` | DECIMAL | always USD (`money.Default` for the default currency) |
| `money.DecimalAmountColumn` | DECIMAL | from another column of the row |

## Integer Columns (Recommended)

Store minor units in a `BigInteger` column. `"1234.50"` USD is stored as `123450`, `"1500"` JPY as `1500`, `"1.250"` KWD as `1250`.

```go
import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

facades.Schema().Create("products", func(table schema.Blueprint) {
	table.ID()
	table.BigInteger("price").Nullable()
	table.BigInteger("cost").Nullable()
	table.TimestampsTz()
})
```

```go
import (
	"github.com/goravel/framework/database/orm"
	money "github.com/laranex/goravel-money/v4"
	"github.com/laranex/goravel-money/v4/iso"
)

type Product struct {
	orm.Model
	Price money.Column[money.Default] `json:"price"` // default currency
	Cost  money.Column[iso.USD]       `json:"cost"`  // always USD
}
```

The currency is part of the field's type, so the column holds only the amount. The `iso` package has one marker per ISO 4217 currency. For a [custom currency](/goravel-money/usage#custom-currencies), declare your own marker:

```go
type PTS struct{}

func (PTS) CurrencyCode() string { return "PTS" }

type Customer struct {
	orm.Model
	Points money.Column[PTS]
}
```

`Column[money.Default]` follows `money.default_currency`, so changing the default later reinterprets existing rows; use a fixed currency for columns that must never change.

::: tip Amounts beyond int64
`Column` writes amounts that do not fit in an `int64` as integer strings, for a `NUMERIC(38, 0)` column on PostgreSQL or MySQL. SQLite converts such values to floating point in an integer column; the column then refuses to read them rather than lose digits.
:::

## Writing and Reading

```go
import (
	money "github.com/laranex/goravel-money/v4"
	moneyfacades "github.com/laranex/goravel-money/v4/facades"
	"github.com/laranex/goravel-money/v4/iso"

	"goravel/app/facades"
)

usd := money.MustCurrency("USD")
price, err := moneyfacades.Money().Of(ctx.Request().Input("price"), "")
product := Product{
	Price: money.NewColumn[money.Default](price),
	Cost:  money.NewColumn[iso.USD](money.MustOf("2.50", usd)),
}
err = facades.Orm().Query().Create(&product) // price = 1050, cost = 250

var fresh Product
err = facades.Orm().Query().FindOrFail(&fresh, product.ID)
fresh.Price.Money // money.Money; fresh.Price.Valid is false for NULL
fresh.Cost.Ptr()  // 2.50 USD as *money.Money, nil for NULL
```

A field holds a `Money` built with `money.NewColumn`, or the zero value for `NULL`. Go's types rule out ints, floats and strings at compile time.

Saving `Money` in another currency than the column's fails with a `*money.CurrencyMismatchError`:

```
money: the column stores USD amounts, but EUR 1.00 was given; convert it to
USD first
```

Reading a value that is not an integer, such as `"10.50"` from a DECIMAL column, fails with `money.ErrInvalidStoredAmount` and points you to `money.DecimalColumn`.

## A Currency per Row

Multi-currency tables keep the currency in its own column:

```go
table.String("currency", 3).Nullable()
table.BigInteger("balance").Nullable()
```

```go
type Wallet struct {
	orm.Model
	Currency string             `json:"currency"`
	Balance  money.AmountColumn `json:"-"`
}
```

Go struct fields can't see each other while a row is scanned, so you pass the currency field explicitly:

```go
jpy := money.MustCurrency("JPY")
var wallet Wallet
err := wallet.Balance.Set(money.MustOf("1500", jpy), &wallet.Currency)
wallet.Currency // "JPY": filled because it was empty
err = facades.Orm().Query().Create(&wallet)

// 1500 JPY; ok is false for NULL
balance, ok, err := wallet.Balance.Money(wallet.Currency)

// money: the currency column holds JPY, but USD 10.00 was given;
// convert the amount, or change the currency column first
err = wallet.Balance.Set(money.MustOf("10", usd), &wallet.Currency)
```

When the currency column is empty, `Set` fills it. When it holds a different currency, `Set` returns a `*money.CurrencyMismatchError` and changes nothing; change the column first (or convert the amount). When the column is empty on read, `Money("")` uses the default currency. Several amount columns can share one currency column.

## DECIMAL Columns

```go
table.Decimal("fee").Total(20).Places(4).Nullable()
```

```go
Fee money.DecimalColumn[iso.USD] `json:"fee"`
```

```go
product.Fee = money.NewDecimalColumn[iso.USD](money.MustOf("12.34", usd))
```

The column writes `"12.34"` and reads strictly: a stored value with more non-zero decimals than the currency allows (such as `12.345` for USD) returns a `*money.ParseError`. Trailing zeros (`12.3400`) are fine. `money.DecimalAmountColumn` is the DECIMAL version of `money.AmountColumn`, and works the same way.

::: warning SQLite
SQLite stores DECIMAL columns as floating point. The column accepts a float from the database only when it maps back to an exact amount, and returns `money.ErrInvalidStoredAmount` otherwise. Prefer integer columns on SQLite.
:::

## Serialization

`Column` and `DecimalColumn` fields serialize like [`Money`](/goravel-money/usage#serialization), or `null`:

```json
{
  "price": {
    "amount": "1050",
    "currency": "USD",
    "decimal": "10.50",
    "formatted": "$10.50"
  },
  "cost": null
}
```

Decoding accepts the same object (or `null`) and checks that its currency is the column's. `AmountColumn` and `DecimalAmountColumn` serialize to the stored amount as a string (`"1500"`), because the currency lives in another field; serialize `Money(currency)` for the full shape.

## Inspecting a Column

Every column type tells you what it stores, for example in a request validator or a custom serializer:

```go
// money.Currency the column stores (USD), or an error for an unknown code
fresh.Cost.Currency()
fresh.Cost.Valid           // false for NULL
wallet.Balance.Amount()    // "1500", "" for NULL
var fee money.DecimalColumn[iso.USD]
fee.GormDataType()         // "decimal(38,10)"
```
