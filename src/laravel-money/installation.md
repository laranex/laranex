---
title: Installation
description: Install Laravel Money, set the default currency and review the configuration.
---

# Installation

```bash
composer require laranex/laravel-money
```

The service provider, the `LaravelMoney` facade alias and the `money()` helper are registered automatically.

Laravel Money needs `ext-bcmath` (required by `moneyphp/money`). Install `ext-intl` for locale-aware formatting such as `$1,234.50`; without it, money formats as `USD 1234.50`.

## Default currency

Set the default currency in your `.env`. It must be an ISO 4217 code or a custom currency, and defaults to `USD`:

```ini
MONEY_CURRENCY=USD
```

## Configuration

Publishing the config file is optional:

```bash
php artisan vendor:publish --tag="laravel-money-config"
```

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
| `default_currency` | `USD` | Currency used by `Money::of()`, `money()`, the facade and the casts when none is given |
| `rounding` | `half_up` | Default rounding for multiplication, division, percentages and averages. One of `half_up`, `half_down`, `half_even`, `half_odd`, `half_positive_infinity`, `half_negative_infinity`, `ceiling`, `floor` (or a `Rounding` case) |
| `currencies` | `[]` | Custom currency codes and their decimal places, e.g. `['PTS' => 0]`. They take precedence over ISO 4217, so they can also override an ISO precision |
| `locale` | `null` | Locale for `format()` and the `formatted` key. `null` uses the app locale |
| `serialization.amount` | `minor` | `minor` (`"123450"`) or `decimal` (`"1234.50"`) for the `amount` key |
| `serialization.include_decimal` | `true` | Add a `decimal` key when `amount` is `minor` |
| `serialization.include_formatted` | `true` | Add a `formatted` key |

The `laravel-money` tag publishes the same file.

::: warning Changing precision
Integer columns store minor units, so a currency's precision decides how they are read. Don't change the precision of a currency (in `currencies`) once amounts are stored in it.
:::
