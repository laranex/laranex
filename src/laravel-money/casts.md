---
title: Casts
description: Store money in integer or DECIMAL columns with a fixed currency or a currency column per row.
---

# Casts

Money attributes are cast to `Laranex\LaravelMoney\Money` (or `null`).

| Cast | Column | Currency |
|---|---|---|
| `Money::class` | integer minor units | default currency |
| `AsMoney::of('USD')` | integer minor units | always USD |
| `AsMoney::currencyColumn('currency')` | integer minor units | from the `currency` column |
| `AsMoney::decimal('USD')` | DECIMAL | always USD (or default when omitted) |
| `AsMoney::decimal(currencyColumn: 'currency')` | DECIMAL | from the `currency` column |

## Integer columns (recommended)

Store minor units in a `bigInteger` column. `"1234.50"` USD is stored as `123450`, `"1500"` JPY as `1500`, `"1.250"` KWD as `1250`.

```php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->bigInteger('price')->nullable();
    $table->bigInteger('cost')->nullable();
});
```

```php
use Laranex\LaravelMoney\Casts\AsMoney;
use Laranex\LaravelMoney\Money;

class Product extends Model
{
    protected function casts(): array
    {
        return [
            'price' => Money::class,          // default currency
            'cost' => AsMoney::of('USD'),     // always USD
        ];
    }
}
```

::: tip Laravel 10
Laravel 10 reads casts from the `$casts` property, which only allows constant strings. Use the string forms there:

```php
protected $casts = [
    'price' => Money::class,
    'cost' => AsMoney::class.':USD',
    'balance' => AsMoney::class.':currency_column=currency',
    'fee' => AsMoney::class.':decimal,USD',
];
```

`MoneyCast::class` and `MoneyCast::class.':USD'` from earlier versions still work as the integer cast.
:::

## A currency per row

Multi-currency tables keep the currency in its own column. The cast reads it for every row:

```php
$table->string('currency', 3)->nullable();
$table->bigInteger('balance')->nullable();

'balance' => AsMoney::currencyColumn('currency'),
```

```php
$wallet = Wallet::create(['balance' => Money::of('1500', 'JPY')]);
$wallet->currency; // "JPY": filled because the column was empty

$wallet->balance = Money::of('10', 'USD'); // CurrencyMismatchException: the column holds JPY
```

When the currency column is empty, assigning money fills it. When it holds a different currency, the cast throws a `CurrencyMismatchException`; change the column first (or convert the amount). When the column is empty on read, the cast's fixed currency or the default currency is used. Several attributes can share one currency column.

## DECIMAL columns

```php
$table->decimal('fee', 20, 4)->nullable();

'fee' => AsMoney::decimal('USD'),
```

The cast writes `"12.34"` and reads strictly: a stored value with more non-zero decimals than the currency allows (such as `12.345` for USD) throws a `MoneyParseException`. Trailing zeros (`12.3400`) are fine.

::: warning SQLite
SQLite stores DECIMAL columns as floating point. The cast accepts a float from the database only when it maps back to an exact amount, and throws otherwise. Prefer integer columns on SQLite.
:::

## Assigning values

```php
$product->price = Money::of('19.99');   // a Money
$product->price = \Money\Money::USD(1999); // a moneyphp Money
$product->price = '19.99';              // a decimal string in the attribute's currency (strict)
$product->price = null;                 // null stays null
```

Ints and floats are rejected with an `InvalidMoneyException`, because `1999` could mean 1999.00 or 19.99. Money in a different currency than the attribute stores throws a `CurrencyMismatchException`.

Reading an integer cast that holds something other than an integer, such as `"10.50"` from a DECIMAL column, throws an `InvalidMoneyException` that points you to `AsMoney::decimal()`.

## Serialization

Cast attributes serialize like `Money::toArray()`:

```php
$product->toArray()['price'];
// ['amount' => '1999', 'currency' => 'USD', 'decimal' => '19.99', 'formatted' => '$19.99']
```
