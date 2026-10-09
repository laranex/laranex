---
title: Casts
description: Store money with Eloquent in integer or DECIMAL columns, with a fixed currency or a currency column per row.
---

# Casts

Money attributes on Eloquent models use one of the casts below. Each reads the column into a `Laranex\LaravelMoney\Money`, and `NULL` into `null`.

| Cast | Column | Currency |
|---|---|---|
| `Money::class` | integer minor units | default currency |
| `AsMoney::of('USD')` | integer minor units | always USD |
| `AsMoney::currencyColumn('currency')` | integer minor units | from another column of the row |
| `AsMoney::decimal('USD')` | DECIMAL | always USD (no argument for the default currency) |
| `AsMoney::decimal(currencyColumn: 'currency')` | DECIMAL | from another column of the row |

## Integer Columns (Recommended)

Store minor units in a `bigInteger` column. `"1234.50"` USD is stored as `123450`, `"1500"` JPY as `1500`, `"1.250"` KWD as `1250`.

```php
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->bigInteger('price')->nullable();
    $table->bigInteger('cost')->nullable();
    $table->timestamps();
});
```

```php
use Illuminate\Database\Eloquent\Model;
use Laranex\LaravelMoney\Casts\AsMoney;
use Laranex\LaravelMoney\Money;

class Product extends Model
{
    protected function casts(): array
    {
        return [
            'price' => Money::class,      // default currency
            'cost' => AsMoney::of('USD'), // always USD
        ];
    }
}
```

The currency is part of the cast, so the column holds only the amount. A [custom currency](/laravel-money/usage#custom-currencies) works the same way: `AsMoney::of('PTS')`.

`Money::class` follows `money.default_currency`, so changing the default later reinterprets existing rows; use a fixed currency for columns that must never change.

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

## Writing and Reading

```php
$price = Money::of($request->input('price'));
$product = Product::create([
    'price' => $price,
    'cost' => Money::of('2.50', 'USD'),
]); // price = 1050, cost = 250

$fresh = Product::findOrFail($product->id);
$fresh->price; // Money, or null for NULL
$fresh->cost;  // 2.50 USD
```

Besides a `Money`, an attribute accepts a moneyphp `Money\Money`, a decimal string in the attribute's currency (`'19.99'`, parsed strictly) or `null`. Ints and floats are rejected with an `InvalidMoneyException`, because `1999` could mean 1999.00 or 19.99.

Saving `Money` in another currency than the column's throws a `CurrencyMismatchException`:

```
The attribute [cost] stores USD amounts, but EUR 1.00 was given. Convert it
to USD first.
```

Reading a value that is not an integer, such as `"10.50"` from a DECIMAL column, throws an `InvalidMoneyException` that points you to `AsMoney::decimal()`.

## A Currency per Row

Multi-currency tables keep the currency in its own column:

```php
$table->string('currency', 3)->nullable();
$table->bigInteger('balance')->nullable();
```

```php
'balance' => AsMoney::currencyColumn('currency'),
```

The cast reads the currency column for every row:

```php
$wallet = new Wallet;
$wallet->balance = Money::of('1500', 'JPY');
$wallet->currency; // "JPY": filled because it was empty
$wallet->save();

$wallet->balance;  // 1500 JPY; null for NULL

// The attribute [balance] reads its currency from [currency], which
// holds JPY, but USD 10.00 was given. Convert the amount, or change
// [currency] first.
$wallet->balance = Money::of('10', 'USD');
```

When the currency column is empty, assigning money fills it. When it holds a different currency, the cast throws a `CurrencyMismatchException` and changes nothing; change the column first (or convert the amount). When the column is empty on read, the cast's fixed currency, else the default currency, is used. Several attributes can share one currency column.

## DECIMAL Columns

```php
$table->decimal('fee', 20, 4)->nullable();
```

```php
'fee' => AsMoney::decimal('USD'),
```

```php
$product->fee = Money::of('12.34', 'USD'); // writes "12.34"
```

The cast writes `"12.34"` and reads strictly: a stored value with more non-zero decimals than the currency allows (such as `12.345` for USD) throws a `MoneyParseException`. Trailing zeros (`12.3400`) are fine. `AsMoney::decimal(currencyColumn: 'currency')` is the DECIMAL version of `AsMoney::currencyColumn()`, and works the same way.

::: warning SQLite
SQLite stores DECIMAL columns as floating point. The cast accepts a float from the database only when it maps back to an exact amount, and throws an `InvalidMoneyException` otherwise. Prefer integer columns on SQLite.
:::

## Serialization

Cast attributes serialize like [`Money`](/laravel-money/usage#serialization), or `null`:

```json
{
  "price": {
    "amount": "1050",
    "currency": "USD",
    "decimal": "10.50",
    "formatted": "$10.50"
  },
  "cost": null
}
```

## Inspecting a Cast

Every cast resolves to a `Laranex\LaravelMoney\Casts\MoneyCast`, which you can inspect, for example in a form request or a custom serializer:

```php
$cast = AsMoney::castUsing(['decimal', 'currency_column=currency']);

$cast->storesDecimal();                 // true
$cast->currencyColumn();                // "currency"
// Money\Currency for that row (JPY)
$cast->currency(['currency' => 'jpy']);
// the fixed currency, else the default
$cast->currency();
```
