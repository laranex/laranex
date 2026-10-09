---
title: Usage
description: Create, read, compare, format and serialize Money values in any currency, and handle errors.
---

# Usage

`Laranex\LaravelMoney\Money` is an immutable amount in a currency, held as an exact integer number of minor units (cents). Every method returns a new value, and no amount ever passes through a float.

## Creating Money

```php
use Laranex\LaravelMoney\Facades\LaravelMoney;
use Laranex\LaravelMoney\Money;

// from a decimal string
$price = Money::of('1234.50', 'USD');
// one comma or space separator may group thousands; default currency
$price = Money::of('1,234.50');
// an int is a whole amount: 1234 JPY
$yen = Money::of(1234, 'JPY');
// from minor units (cents): 1234.50 USD
$cents = Money::ofMinor(123450, 'USD');
// minor units of any size
$huge = Money::ofMinor('99999999999999999999', 'USD');
// 0.000 KWD
$zero = Money::zero('KWD');

$price = LaravelMoney::of('12.34', 'USD'); // the facade
$price = money('12.34', 'USD');            // the helper
```

The currency is optional and defaults to `money.default_currency`. Codes are case-insensitive, and a `Money\Currency` works too. An unknown code throws an `UnknownCurrencyException`.

### Precision Is Strict

Each currency has a fixed number of decimals. Extra decimals that are zeros are fine; anything else throws a `MoneyParseException` that tells you how many decimals the currency allows. Pass a rounding mode to round instead:

```php
use Laranex\LaravelMoney\Rounding;

Money::of('12.500', 'USD');                  // 12.50 USD
// MoneyParseException: USD allows 2 decimal places, but "1.234" has 3...
Money::of('1.234', 'USD');
Money::of('1.235', 'USD', Rounding::HalfUp); // 1.24 USD
Money::of('2.5', 'JPY', Rounding::HalfEven); // 2 JPY
```

Only ASCII digits, an optional sign, one dot as the decimal separator, and commas or spaces grouping thousands are accepted. `"12,50"`, `".5"`, `"5."`, `"1e3"`, `"$10"` and localized digits such as `"၁၂၃"` throw a `MoneyParseException` rather than guessing; normalize user input before parsing it.

Grouping must be consistent. Plain digits (`"1234567.89"`) are always fine; a grouped amount uses one separator throughout (a comma, a space, a no-break space or a narrow no-break space), in Western groups of three or in Indian grouping, where the last group has three digits and earlier groups two:

```php
Money::of('1,234,567.89', 'USD'); // Western grouping
Money::of('12,34,567.89', 'USD'); // Indian grouping
Money::of('1 234 567.89', 'USD'); // spaces

Money::of('1 234,567', 'USD');    // MoneyParseException: mixed separators
Money::of('1,234,56,789', 'USD'); // MoneyParseException: irregular groups
// MoneyParseException: the decimal separator is always a dot
Money::of('1.234.567,89', 'USD');
```

### Custom Currencies

Register extra codes, or change an ISO precision, under `money.currencies`:

```php
'currencies' => [
    'PTS' => 0, // loyalty points, no decimals
],
```

```php
$points = Money::of('300', 'PTS');
```

A currency is identified by its code and its precision, so an MMK amount built before MMK was overridden to 0 decimals and one built after are different currencies: combining them throws a `CurrencyMismatchException`. Keep `money.currencies` fixed while the application runs.

### No Floats

Floats can't hold most decimal amounts exactly, so every method that takes an amount, multiplier or percentage rejects them with an `InvalidMoneyException` that suggests a string:

```php
// InvalidMoneyException: Floats are not accepted for money (1.1 given)...
// Pass a string such as "1.1", or an integer.
$price->times(1.1);
$price->times('1.1'); // fine
```

## Reading Money

```php
$money = Money::of('1234.5', 'USD');

$money->amount();    // "123450"   minor units, always a string
$money->toDecimal(); // "1234.50"  with the currency's precision
// Money\Currency: getCode() "USD"
$money->currency();
$money->precision(); // 2

$money->isZero();
$money->isPositive();
$money->isNegative();
```

Minor units come from ISO 4217: USD and MMK have 2, JPY 0, KWD and BHD 3, CLF 4. Never hard-code two decimals.

## Comparing

Comparisons accept another `Money`, or a decimal string or int in the same currency:

```php
$price->equals('19.99');
$price->greaterThan(Money::of('10', 'USD'));
$price->greaterThanOrEqual('10');
$price->lessThan(20);
$price->lessThanOrEqual('19.99');
$price->compare($other);              // -1, 0 or 1
$price->isSameCurrency($a, $b);
```

`equals()` returns `false` for different currencies. The other comparisons throw a `CurrencyMismatchException` that names both amounts. Every comparison throws for an operand that is not a valid amount, such as a float or `"abc"`.

## Arithmetic

```php
$total = $price->plus($shipping, '2.50');
$withTax = $total->addPercent('8.875');
$parts = $total->split(3);
```

See [Arithmetic](/laravel-money/arithmetic) for multiplying, dividing, percentages, splitting, rounding and aggregates.

## Formatting

```php
// configured locale: "$1,234.50"
Money::of('1234.5', 'USD')->format();
Money::of('1234.5', 'EUR')->format('de_DE');      // "1.234,50 €"
Money::of('1500', 'JPY')->format('en');           // "¥1,500"
Money::of('1234567.89', 'INR')->format('en_IN');  // "₹12,34,567.89"
LaravelMoney::format($money, 'fr_FR');            // "1 234,50 €"
// "USD 1234.50", never locale-dependent
(string) $money;
```

The locale defaults to `money.locale`, then the app locale. Formatting uses `ext-intl` for the locale's currency symbol, separators, grouping (including Indian lakh grouping) and digits, but builds the number from the exact decimal string, so `123456789012345678901.23` formats without losing a digit. Without `ext-intl`, `format()` returns `USD 1234.50`.

## Serialization

`toArray()`, `json_encode()` and cast model attributes produce strings, in the shape configured by `money.serialization`:

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

## Interop

`Money` wraps [MoneyPHP](https://www.moneyphp.org/)'s `Money\Money`:

```php
use Money\Money as MoneyPhp;

$moneyphp = $money->toMoneyPhp();               // Money\Money
$money = Money::fromMoneyPhp(MoneyPhp::EUR(500)); // 5.00 EUR
// Money\Currencies, for moneyphp formatters and converters
LaravelMoney::currencies()->currencies();
```

`Rounding::HalfUp->toMoneyPhp()` returns the matching `Money\Money::ROUND_*` constant, and `Rounding::fromMoneyPhp()` turns it back.

## The Facade and the Currency Registry

The `LaravelMoney` facade builds money and exposes the configuration:

```php
// also ofMinor(), zero(), fromMoneyPhp()
LaravelMoney::of('12.34', 'USD');
// Money\Currency('MMK'), validated; null or '' gives the default
LaravelMoney::currency('mmk');
// Money\Currency for money.default_currency
LaravelMoney::defaultCurrency();
LaravelMoney::precision('KWD'); // 3 (default currency when omitted)
LaravelMoney::rounding();       // Rounding::HalfUp, from money.rounding
LaravelMoney::locale();         // money.locale, else the app locale
LaravelMoney::format($money, 'de_DE'); // same as $money->format('de_DE')
// ['amount' => 'minor', 'include_decimal' => true,
//  'include_formatted' => true]
LaravelMoney::serialization();
```

`LaravelMoney::currencies()` returns the `CurrencyRegistry`, which knows every ISO 4217 currency plus your custom ones:

```php
$registry = LaravelMoney::currencies();

$registry->has('PTS');         // true when configured in money.currencies
// Money\Currency('JPY'); UnknownCurrencyException for unknown codes
$registry->resolve('jpy');
$registry->precision('JPY');   // 0
$registry->custom();           // ['PTS' => 0]
```

The facade resolves `Laranex\LaravelMoney\LaravelMoney` from the container, so `app(LaravelMoney::class)` returns the same service.

### Custom Formatting

`format()` uses `Laranex\LaravelMoney\Formatting\IntlFormatter` when `ext-intl` is loaded and `PlainFormatter` (`USD 1234.50`) otherwise. To change how money is displayed everywhere, implement the `Formatter` interface and register it, for example in a service provider:

```php
use Laranex\LaravelMoney\Formatting\Formatter;

final class CodeFirstFormatter implements Formatter
{
    public function format(
        string $decimal,
        string $currency,
        int $precision,
        string $locale,
    ): string {
        return $currency.' '.$decimal; // $decimal is exact, e.g. "-1234.50"
    }
}

LaravelMoney::useFormatter(new CodeFirstFormatter);
LaravelMoney::formatter();        // the formatter in use
LaravelMoney::useFormatter(null); // back to the default
```

## Extending Money

`Money` is macroable:

```php
Money::macro('withVat', fn (): Money => $this->addPercent(20));

Money::of('10', 'USD')->withVat(); // 12.00 USD
```

## Errors

Every exception extends `Laranex\LaravelMoney\Exceptions\MoneyException`, which extends `InvalidArgumentException`, so a controller can answer bad input with a 422:

```php
use Laranex\LaravelMoney\Exceptions\MoneyException;

try {
    $price = Money::of($request->input('price'));
} catch (MoneyException $e) {
    return response()->json(['message' => $e->getMessage()], 422);
}
```

| Exception | Thrown when |
|---|---|
| `MoneyParseException` | an amount is malformed, or has more decimals than the currency allows |
| `UnknownCurrencyException` | a currency (or the default currency) is not ISO 4217 or configured |
| `CurrencyMismatchException` | amounts in different currencies are combined, compared or stored together. The message names both amounts |
| `InvalidMoneyException` | a float or another invalid operand is passed, a scale or `roundTo()` decimals are outside the `Money::MAX_SCALE` bounds, money is divided by zero, parts or ratios are invalid, an aggregate is empty, a stored value is invalid, or the config is invalid |
