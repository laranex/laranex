---
title: Introduction
---

<PackageIntroduction />

## Why Goravel Money

Money is easy to get subtly wrong: floats drop cents, "divide by 100" breaks for yen and Kuwaiti dinar, and splitting a bill loses a cent. Goravel Money handles all of that for you, for every currency:

- **Precision comes from the currency.** USD and MMK have 2 decimals, JPY 0, KWD 3, all from ISO 4217. You can add your own currencies, such as loyalty points with 0 decimals.
- **No floats, ever.** Amounts are integers in minor units or decimal strings, and all math is exact. Passing a float returns an error with a hint.
- **Helpers you actually need:** `Plus`, `Minus`, `Times`, `DividedBy`, `Percent`, `AddPercent`, `SubtractPercent`, `PercentageOf`, `Split`, `Allocate`, `RoundTo`, `Sum`, `Avg` and more.
- **ORM column types** for integer and DECIMAL columns, with a fixed currency or a currency column per row.
- **Exact formatting** for the locale (`$1,234.50`, `1.234,50 €`), even for amounts too large for a float.

```go
import money "github.com/laranex/goravel-money/v4"

usd := money.MustCurrency("USD")
jpy := money.MustCurrency("JPY")
price := money.MustOf("1,234.50", usd)

price.AddPercent("8.875")                      // 1344.06 USD
price.SubtractPercent(15)                      // 1049.32 USD
money.MustOf("100", usd).Split(3)              // 33.34, 33.33, 33.33
money.MustOf("25", usd).
	PercentageOf(money.MustOf("200", usd), 2) // "12.50"
money.MustOf("1500", jpy).Times("1.1")         // 1650 JPY
price.Format()                                 // "$1,234.50"
```

Formatting uses CLDR data built into the package, so it needs no ICU. `Money` holds amounts of any size with `math/big`, so you can always convert with `BigInt()` or `Int64()`.
