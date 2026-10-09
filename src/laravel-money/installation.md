---
title: Installation
description: Install Laravel Money, set the default currency and review the configuration.
---

# Installation

```bash
composer require laranex/laravel-money
```

The service provider, the `LaravelMoney` facade and the `money()` helper are registered automatically.

Laravel Money needs `ext-bcmath` (required by `moneyphp/money`). Install `ext-intl` for locale-aware formatting such as `$1,234.50`; without it, money formats as `USD 1234.50`.

## Default Currency

Set the default currency in your `.env`. It must be an ISO 4217 code or a custom currency, and defaults to `USD`:

```ini
MONEY_CURRENCY=USD
```

## Configuration

Publishing the config file is optional; without it, the package reads `MONEY_CURRENCY` and uses the defaults below:

```bash
php artisan vendor:publish --tag="laravel-money-config"
```

The `laravel-money` tag publishes the same file, `config/money.php`:

```php
return [
    'default_currency' => env('MONEY_CURRENCY', 'USD'),

    'rounding' => 'half_up',

    'currencies' => [
        // 'PTS' => 0,
    ],

    'locale' => null,

    'serialization' => [
        'amount' => 'minor',
        'include_decimal' => true,
        'include_formatted' => true,
    ],
];
```

| Option | Default | Description |
|---|---|---|
| `default_currency` | `MONEY_CURRENCY`, else `USD` | Used whenever no currency is given, and by casts without a currency. An ISO 4217 code or a custom currency |
| `rounding` | `half_up` | Default rounding for multiplication, division, percentages, averages and `roundTo()`. See [Rounding](/laravel-money/arithmetic#rounding) |
| `currencies` | none | Custom currencies as code => decimal places, e.g. `'PTS' => 0`. They take precedence over ISO 4217, so `'MMK' => 0` changes MMK's precision |
| `locale` | the app locale | Locale for `format()` and the `formatted` key, e.g. `en`, `de_DE`, `my_MM` |
| `serialization` | minor + decimal + formatted | The [serialized shape](/laravel-money/usage#serialization) of `Money` |

An unknown default currency or an invalid value throws an exception the first time it is used, so a typo shows up immediately.

::: warning Changing precision
Integer columns store minor units, so a currency's precision decides how they are read. Don't change the precision of a currency (in `currencies`) once amounts are stored in it.
:::

## What's Included

| Class | Contents |
|---|---|
| `Laranex\LaravelMoney\Money` | The `Money` value object |
| `Laranex\LaravelMoney\Rounding` | The rounding modes |
| `Laranex\LaravelMoney\Facades\LaravelMoney` | The facade: building money, the configuration and the currency registry |
| `Laranex\LaravelMoney\Casts\AsMoney` | The [Eloquent casts](/laravel-money/casts) |
| `Laranex\LaravelMoney\Exceptions\*` | The [exceptions](/laravel-money/usage#errors) |
