---
title: Introduction
---

<PackageIntroduction />

## Why Laravel Money

Money is easy to get subtly wrong: floats drop cents, "divide by 100" breaks for yen and Kuwaiti dinar, and splitting a bill loses a cent. Laravel Money handles all of that for you, for every currency:

- **Precision comes from the currency.** USD and MMK have 2 decimals, JPY 0, KWD 3, all from ISO 4217. You can add your own currencies, such as loyalty points with 0 decimals.
- **No floats, ever.** Amounts are integers in minor units or decimal strings, and all math is exact. Passing a float throws with a hint.
- **Helpers you actually need:** `plus`, `minus`, `times`, `dividedBy`, `percent`, `addPercent`, `subtractPercent`, `percentageOf`, `split`, `allocate`, `roundTo`, `sum`, `avg` and more.
- **Eloquent casts** for integer and DECIMAL columns, with a fixed currency or a currency column per row.
- **Exact formatting** with `ext-intl` (`$1,234.50`, `1.234,50 €`), even for amounts too large for a float.

```php
use Laranex\LaravelMoney\Money;

$price = Money::of('1,234.50', 'USD');

$price->addPercent('8.875');                    // 1344.06 USD
$price->subtractPercent(15);                    // 1049.32 USD
Money::of('100')->split(3);                     // 33.34, 33.33, 33.33
Money::of('25')->percentageOf(Money::of('200')); // "12.50"
Money::of('1500', 'JPY')->times('1.1');         // 1650 JPY
$price->format();                               // "$1,234.50"
```

`Money` wraps [MoneyPHP](https://www.moneyphp.org/)'s `Money\Money`, so you can always drop down to it with `toMoneyPhp()`.
