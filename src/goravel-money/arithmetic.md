---
title: Arithmetic
description: Add, multiply, take percentages, split and round money exactly, in any currency, with eight rounding modes.
---

# Arithmetic

All arithmetic is exact: amounts are integers in minor units and the math uses `math/big`, never floats. Results are rounded to the currency's minor unit only where needed, with the configured rounding (`half_up` by default) or a `money.Rounding` you pass as the last argument.

Wherever a method takes an operand, it accepts a `Money`, or a **decimal amount in the same currency** given as a string (`"2.50"`) or an integer (`2` means 2.00). Multipliers, divisors, percentages and ratios are decimal strings or integers. Floats are rejected with `money.ErrInvalidOperand`.

Every method returns a new `Money`, and every method that can fail also returns an error (`Negated` and `Absolute` cannot); the examples below leave out the error for brevity.

## Adding and subtracting

```go
total, err := price.Plus(shipping, "2.50") // any number of operands
total, err = total.Minus(discount)
price.Negated()                            // -19.99
refund.Absolute()                          // 19.99
```

Amounts in different currencies return a `*money.CurrencyMismatchError` that names both amounts and suggests converting one of them first:

```
money: cannot combine USD 10.00 with EUR 5.00: the amounts are in different currencies; convert one of them first
```

Decimal operands are parsed strictly: `jpy.Plus("0.5")` returns `money.ErrTooManyDecimals`.

## Multiplying and dividing

```go
usd := money.MustCurrency("USD")

money.MustParse("10.00", usd).Times(3)                // 30.00
money.MustParse("0.05", usd).Times("0.5")             // 0.03 (half up)
money.MustParse("0.05", usd).Times("0.5", money.Floor) // 0.02
money.MustParse("20.00", usd).DividedBy(3)            // 6.67
money.MustParse("10.00", usd).DividedBy("0.5")        // 20.00
money.MustParse("10.00", usd).Mod("3")                // 1.00
```

Dividing by zero (including `Mod` by zero) returns `money.ErrDivisionByZero`. `Mod` keeps the sign of the amount: -10.00 mod 3 is -1.00.

## Percentages

```go
price := money.MustParse("200", usd)

price.Percent("7.5")       // 15.00   7.5% of the amount
price.AddPercent(7)        // 214.00  e.g. tax
price.SubtractPercent(15)  // 170.00  e.g. a discount

money.MustParse("25", usd).PercentageOf(price, 2)                      // "12.50"   what % 25 is of 200
money.MustParse("2", usd).PercentageOf(money.MustParse("3", usd), 4)   // "66.6667"
money.MustParse("50", usd).RatioOf(price, 4)                           // "0.2500"
```

`Percent`, `AddPercent` and `SubtractPercent` round once, on the percentage. `PercentageOf(total, scale)` and `RatioOf(other, scale)` return decimal strings rounded to `scale` decimals; Laravel Money's defaults are 2 and 4. `scale` must be between 0 and `money.MaxScale` (100), so no call can force a huge computation; anything else returns `money.ErrInvalidOperand`.

## Splitting and allocating

Splitting never loses or invents a minor unit. Each part gets its share rounded down, and the leftover units go one at a time to the parts with the largest remainders, earlier parts first, exactly as in Laravel Money and moneyphp:

```go
money.MustParse("100.00", usd).Split(3)                    // 33.34, 33.33, 33.33
money.MustParse("1000", money.MustCurrency("JPY")).Split(3) // 334, 333, 333
money.MustParse("1", money.MustCurrency("KWD")).Split(6)    // 0.167 ×4, 0.166 ×2

money.MustParse("100.00", usd).Allocate(70, 20, 10)        // 70.00, 20.00, 10.00
money.MustParse("0.10", usd).Allocate("0.3", "0.3", "0.4") // 0.03, 0.03, 0.04
```

`Allocate` returns the parts in the order of the ratios. For named shares, `money.AllocateMap` takes a map of ratios and returns a map of amounts:

```go
shares, err := money.AllocateMap(total, map[string]int{"owner": 70, "agent": 20, "platform": 10})
shares["owner"] // 70.00
```

Go maps have no order, so with `AllocateMap` leftover units that tie go to keys in ascending order; the result is always the same. Ratios are non-negative integers or decimal strings (`"0.3"`), and at least one must be positive. A negative amount is allocated like its absolute value, then negated. Invalid parts or ratios return `money.ErrInvalidAllocation`.

## Rounding

```go
money.MustParse("12.34", usd).RoundTo(0)                // 12.00
money.MustParse("12.50", usd).RoundTo(0, money.HalfEven) // 12.00
money.MustParse("12.34", usd).RoundTo(1, money.Ceiling)  // 12.40
money.MustParse("15", money.MustCurrency("JPY")).RoundTo(-1) // 20
```

`RoundTo` keeps the currency's precision (the result is still stored in minor units), so it's useful for cash rounding or whole-unit prices. `decimals` must be between `-money.MaxScale` and `money.MaxScale` (-100 to 100); anything else returns `money.ErrInvalidOperand`. Like the other methods, it returns the config error when no rounding is passed and the money config can't be loaded.

| `money.Rounding` | Config value | 2.5 | -2.5 | 2.4 |
|---|---|---|---|---|
| `HalfUp` (default) | `half_up` | 3 | -3 | 2 |
| `HalfDown` | `half_down` | 2 | -2 | 2 |
| `HalfEven` | `half_even` | 2 | -2 | 2 |
| `HalfOdd` | `half_odd` | 3 | -3 | 2 |
| `HalfPositiveInfinity` | `half_positive_infinity` | 3 | -2 | 2 |
| `HalfNegativeInfinity` | `half_negative_infinity` | 2 | -3 | 2 |
| `Ceiling` | `ceiling` | 3 | -2 | 3 |
| `Floor` | `floor` | 2 | -3 | 2 |

`money.ParseRounding("half_even")` turns a config value into a mode, `Rounding.String()` turns it back, and `money.Roundings()` lists every mode.

## Aggregates

`Sum`, `Min`, `Max` and `Avg` take a slice of `Money` in one currency:

```go
money.Sum(prices)                 // 20.01
money.Min(prices)
money.Max(prices)
money.Avg(prices, money.HalfEven) // rounded to a minor unit
```

An empty slice returns `money.ErrEmptyAggregate`, and mixed currencies return a `*money.CurrencyMismatchError`.
