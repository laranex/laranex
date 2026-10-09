---
title: Arithmetic
description: Add, multiply, take percentages, split and round money exactly, in any currency, with eight rounding modes.
---

# Arithmetic

All arithmetic is exact: amounts are integers in minor units and the math uses bcmath, never floats. Results are rounded to the currency's minor unit only where needed, with the configured rounding (`half_up` by default) or a `Rounding` you pass as the last argument.

Wherever a method takes an operand, it accepts a `Money`, or a **decimal amount in the same currency** given as a string (`'2.50'`) or an int (`2` means 2.00). Multipliers, divisors, percentages and ratios are decimal strings or ints. Floats are rejected with an `InvalidMoneyException`.

Every method returns a new `Money`, and every method that can fail throws a `MoneyException` (`negated()` and `absolute()` cannot).

## Adding and Subtracting

```php
use Laranex\LaravelMoney\Money;

$total = $price->plus($shipping, '2.50'); // any number of operands
$total = $total->minus($discount);
$price->negated();                        // -19.99
$refund->absolute();                      // 19.99
```

Amounts in different currencies throw a `CurrencyMismatchException` that names both amounts and suggests converting one of them first:

```
Cannot combine USD 10.00 with EUR 5.00: the amounts are in different
currencies. Convert one of them first...
```

Decimal operands are parsed strictly: `$yen->plus('0.5')` throws a `MoneyParseException`.

## Multiplying and Dividing

```php
use Laranex\LaravelMoney\Rounding;

Money::of('10.00', 'USD')->times(3);                     // 30.00
Money::of('0.05', 'USD')->times('0.5');                  // 0.03 (half up)
Money::of('0.05', 'USD')->times('0.5', Rounding::Floor); // 0.02
Money::of('20.00', 'USD')->dividedBy(3);                 // 6.67
Money::of('10.00', 'USD')->dividedBy('0.5');             // 20.00
Money::of('10.00', 'USD')->mod('3');                     // 1.00
```

Dividing by zero (including `mod()` by zero) throws an `InvalidMoneyException`. `mod()` keeps the sign of the amount: -10.00 mod 3 is -1.00.

## Percentages

```php
$price = Money::of('200', 'USD');

$price->percent('7.5');      // 15.00   7.5% of the amount
$price->addPercent(7);       // 214.00  e.g. tax
$price->subtractPercent(15); // 170.00  e.g. a discount

// "12.50": what % 25 is of 200
Money::of('25', 'USD')->percentageOf($price, 2);
// "66.6667"
Money::of('2', 'USD')->percentageOf(Money::of('3', 'USD'), 4);
// "0.2500"
Money::of('50', 'USD')->ratioOf($price, 4);
```

`percent()`, `addPercent()` and `subtractPercent()` round once, on the percentage. `percentageOf($total, $scale)` and `ratioOf($other, $scale)` return decimal strings rounded to `$scale` decimals. `$scale` must be between 0 and `Money::MAX_SCALE` (100), so no call can force a huge computation; anything else throws an `InvalidMoneyException`.

## Splitting and Allocating

Splitting never loses or invents a minor unit. Each part gets its share rounded down, and the leftover units go one at a time to the parts with the largest remainders, earlier parts first:

```php
Money::of('100.00', 'USD')->split(3); // 33.34, 33.33, 33.33
Money::of('1000', 'JPY')->split(3);   // 334, 333, 333
Money::of('1', 'KWD')->split(6);      // 0.167 ×4, 0.166 ×2

Money::of('100.00', 'USD')->allocate([70, 20, 10]); // 70.00, 20.00, 10.00
// 0.03, 0.03, 0.04
Money::of('0.10', 'USD')->allocate(['0.3', '0.3', '0.4']);
```

`allocate()` returns the parts in the order of the ratios. For named shares, pass an array with keys and get the same keys back:

```php
$shares = $total->allocate([
    'owner' => 70,
    'agent' => 20,
    'platform' => 10,
]);
$shares['owner']; // 70.00
```

Leftover units that tie go to keys in ascending order, so the result never depends on the order of the keys. Ratios are non-negative ints or decimal strings (`'0.3'`), and at least one must be positive. A negative amount is allocated like its absolute value, then negated. Invalid parts or ratios throw an `InvalidMoneyException`.

## Rounding

```php
Money::of('12.34', 'USD')->roundTo(0);                     // 12.00
Money::of('12.50', 'USD')->roundTo(0, Rounding::HalfEven); // 12.00
Money::of('12.34', 'USD')->roundTo(1, Rounding::Ceiling);  // 12.40
Money::of('15', 'JPY')->roundTo(-1);                       // 20
```

`roundTo()` keeps the currency's precision (the result is still stored in minor units), so it's useful for cash rounding or whole-unit prices. `$decimals` must be between `-Money::MAX_SCALE` and `Money::MAX_SCALE` (-100 to 100); anything else throws an `InvalidMoneyException`.

| `Rounding` | Config value | 2.5 | -2.5 | 2.4 |
|---|---|---|---|---|
| `HalfUp` (default) | `half_up` | 3 | -3 | 2 |
| `HalfDown` | `half_down` | 2 | -2 | 2 |
| `HalfEven` | `half_even` | 2 | -2 | 2 |
| `HalfOdd` | `half_odd` | 3 | -3 | 2 |
| `HalfPositiveInfinity` | `half_positive_infinity` | 3 | -2 | 2 |
| `HalfNegativeInfinity` | `half_negative_infinity` | 2 | -3 | 2 |
| `Ceiling` | `ceiling` | 3 | -2 | 3 |
| `Floor` | `floor` | 2 | -3 | 2 |

`Rounding::from('half_even')` turns a config value into a mode, `->value` turns it back, and `Rounding::cases()` lists every mode.

## Aggregates

`sum()`, `min()`, `max()` and `avg()` take any iterable of `Money` in one currency, including collections:

```php
Money::sum($prices);                   // 20.01
Money::min($prices);
Money::max($prices);
Money::avg($prices, Rounding::HalfEven); // rounded to a minor unit
```

An empty list throws an `InvalidMoneyException`, and mixed currencies throw a `CurrencyMismatchException`.
