---
title: Arithmetic
description: Add, multiply, take percentages, split and round money exactly, in any currency.
---

# Arithmetic

All arithmetic is exact: amounts are integers in minor units and the math uses bcmath, never floats. Results are rounded to the currency's minor unit only where needed, with the configured rounding (`half_up` by default) or a `Rounding` you pass.

Wherever a method accepts `Money|int|string`, an int or string is a **decimal amount in the same currency**: `$price->plus('2.50')`.

## Adding and subtracting

```php
$total = $price->plus($shipping, '2.50');   // any number of operands
$total = $total->minus($discount);
$price->negated();                          // -19.99
$refund->absolute();                        // 19.99
```

Amounts in different currencies throw a `CurrencyMismatchException` that names both amounts and suggests converting one of them first.

## Multiplying and dividing

```php
Money::of('10.00')->times(3);                       // 30.00
Money::of('0.05')->times('0.5');                    // 0.03 (half up)
Money::of('0.05')->times('0.5', Rounding::Floor);   // 0.02
Money::of('20.00')->dividedBy(3);                   // 6.67
Money::of('10.00')->dividedBy('0.5');               // 20.00
Money::of('10.00')->mod('3');                       // 1.00
```

Multipliers and divisors are ints or decimal strings. Dividing by zero throws an `InvalidMoneyException`.

## Percentages

```php
$price = Money::of('200');

$price->percent('7.5');           // 15.00   7.5% of the amount
$price->addPercent(7);            // 214.00  e.g. tax
$price->subtractPercent(15);      // 170.00  e.g. a discount

Money::of('25')->percentageOf($price);       // "12.50"   what % 25 is of 200
Money::of('2')->percentageOf(Money::of('3'), 4); // "66.6667"
Money::of('50')->ratioOf($price);            // "0.2500"
```

`percent()`, `addPercent()` and `subtractPercent()` round once, on the percentage. `percentageOf(Money $total, int $scale = 2, ?Rounding $rounding = null)` and `ratioOf(Money $other, int $scale = 4, ?Rounding $rounding = null)` return decimal strings rounded to `$scale` decimals. Both throw an `InvalidMoneyException` when the other amount is zero or `$scale` is negative, and a `CurrencyMismatchException` for another currency.

## Splitting and allocating

Splitting never loses or invents a minor unit. Each part gets its share rounded down, and the leftover units go one at a time to the parts with the largest remainders, earlier parts first:

```php
Money::of('100.00')->split(3);           // 33.34, 33.33, 33.33
Money::of('1000', 'JPY')->split(3);      // 334, 333, 333
Money::of('1', 'KWD')->split(6);         // 0.167 ×4, 0.166 ×2

Money::of('100.00')->allocate(['owner' => 70, 'agent' => 20, 'platform' => 10]);
// ['owner' => 70.00, 'agent' => 20.00, 'platform' => 10.00]
```

`allocate()` keeps the array keys. Ratios are non-negative ints or decimal strings (`'0.3'`), and at least one must be positive. A negative amount is allocated like its absolute value, then negated.

## Rounding

```php
Money::of('12.34')->roundTo(0);                        // 12.00
Money::of('12.50')->roundTo(0, Rounding::HalfEven);    // 12.00
Money::of('12.34')->roundTo(1, Rounding::Ceiling);     // 12.40
Money::of('15', 'JPY')->roundTo(-1);                   // 20
```

`roundTo()` keeps the currency's precision (the result is still stored in minor units), so it's useful for cash rounding or whole-unit prices.

| `Rounding` case | Config value | 2.5 | -2.5 | 2.4 |
|---|---|---|---|---|
| `HalfUp` (default) | `half_up` | 3 | -3 | 2 |
| `HalfDown` | `half_down` | 2 | -2 | 2 |
| `HalfEven` | `half_even` | 2 | -2 | 2 |
| `HalfOdd` | `half_odd` | 3 | -3 | 2 |
| `HalfPositiveInfinity` | `half_positive_infinity` | 3 | -2 | 2 |
| `HalfNegativeInfinity` | `half_negative_infinity` | 2 | -3 | 2 |
| `Ceiling` | `ceiling` | 3 | -2 | 3 |
| `Floor` | `floor` | 2 | -3 | 2 |

## Aggregates

`sum`, `min`, `max` and `avg` take any iterable of `Money` in one currency, including collections:

```php
Money::sum($order->items->pluck('price'));
Money::min([$a, $b, $c]);
Money::max($prices);
Money::avg($prices, Rounding::HalfEven);
```

An empty list throws an `InvalidMoneyException`.
