---
title: Usage
description: Create, read, compare, format and serialize Money values in any currency.
---

# Usage

`Laranex\LaravelMoney\Money` is an immutable amount in a currency. Every method returns a new instance.

## Creating money

```php
use Laranex\LaravelMoney\Money;
use Laranex\LaravelMoney\Rounding;

Money::of('1234.50', 'USD');     // from a decimal string
Money::of('1,234.50');           // commas and spaces may group thousands; default currency
Money::of(1234, 'JPY');          // an int is a whole amount: 1234 JPY
Money::ofMinor(123450, 'USD');   // from minor units (cents): 1234.50 USD
Money::zero('KWD');              // 0.000 KWD

money('12.34', 'USD');           // the helper, same as Money::of()
LaravelMoney::of('12.34');       // the facade, same as Money::of()
```

The currency is optional and defaults to `money.default_currency`. Codes are case-insensitive, and a `Money\Currency` works too. An unknown code throws `UnknownCurrencyException`.

### Precision is strict

Each currency has a fixed number of decimals. Extra decimals that are zeros are fine; anything else throws a `MoneyParseException` that tells you how many decimals the currency allows. Pass a rounding mode to round instead:

```php
Money::of('12.500', 'USD');                   // 12.50 USD
Money::of('1.234', 'USD');                    // MoneyParseException: USD allows 2 decimal places, but "1.234" has 3.
Money::of('1.235', 'USD', Rounding::HalfUp);  // 1.24 USD
Money::of('2.5', 'JPY', Rounding::HalfEven);  // 2 JPY
```

Only digits, an optional sign, one dot as the decimal separator and grouping commas or spaces are accepted. `"12,50"` is rejected rather than read as 1250.

### No floats

Floats can't hold most decimal amounts exactly, so every method that takes an amount, multiplier or percentage rejects them with an `InvalidMoneyException` that suggests a string:

```php
Money::of(12.5);            // InvalidMoneyException: Floats are not accepted for money (12.5 given)...
Money::of('12.5');          // fine
$price->times('1.1');       // multipliers are strings too
```

## Reading money

```php
$money = Money::of('1234.5', 'USD');

$money->amount();     // "123450"  minor units, always a string
$money->toDecimal();  // "1234.50" with the currency's precision
$money->currency();   // "USD"
$money->precision();  // 2

$money->isZero();
$money->isPositive();
$money->isNegative();
```

## Comparing

Comparisons accept another `Money`, or an int or string decimal amount in the same currency:

```php
$price->equals('19.99');
$price->greaterThan(Money::of('10'));
$price->greaterThanOrEqual('10');
$price->lessThan(20);
$price->lessThanOrEqual('19.99');
$price->compare($other);                 // -1, 0 or 1
$price->isSameCurrency($a, $b);
```

`equals()` returns `false` for different currencies; the other comparisons throw a `CurrencyMismatchException`.

## Formatting

```php
Money::of('1234.5', 'USD')->format();         // "$1,234.50"
Money::of('1234.5', 'EUR')->format('de_DE');  // "1.234,50 €"
Money::of('1500', 'JPY')->format();           // "¥1,500"
(string) Money::of('9.99');                    // same as format()
```

The locale defaults to `money.locale`, then the app locale. Formatting uses `ext-intl` for the locale's currency symbol, separators, grouping (including Indian lakh grouping) and digits, but builds the number from the exact decimal string, so even `123456789012345678901.23` formats without losing a digit. Without `ext-intl`, money formats as `USD 1234.50`.

## Serialization

`toArray()`, `json_encode()` and serialized model attributes all produce strings:

```json
{"amount": "123450", "currency": "USD", "decimal": "1234.50", "formatted": "$1,234.50"}
```

Configure the shape with `money.serialization`: `amount` (`minor` or `decimal`), `include_decimal` and `include_formatted`.

## MoneyPHP interop

```php
$moneyphp = $money->toMoneyPhp();               // Money\Money
$money = Money::fromMoneyPhp(\Money\Money::EUR(500));
LaravelMoney::currencies()->currencies();       // Money\Currencies, for moneyphp formatters and converters
```

`Rounding::HalfUp->toMoneyPhp()` returns the matching `Money\Money::ROUND_*` constant.

## Macros

`Money` is macroable:

```php
Money::macro('withVat', fn (): Money => $this->addPercent(20));

Money::of('10')->withVat(); // 12.00
```

## Exceptions

Every exception extends `Laranex\LaravelMoney\Exceptions\MoneyException`, which extends `InvalidArgumentException`:

| Exception | Thrown when |
|---|---|
| `MoneyParseException` | an amount can't be parsed, or has more decimals than the currency allows |
| `UnknownCurrencyException` | a currency (or the default currency) isn't ISO 4217 or configured |
| `CurrencyMismatchException` | amounts in different currencies are combined or compared, or a cast gets the wrong currency. The message names both amounts |
| `InvalidMoneyException` | a float is passed, division by zero, invalid ratios, a value a cast can't store, or invalid config |
