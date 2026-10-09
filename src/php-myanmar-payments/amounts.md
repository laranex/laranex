---
title: Amounts
description: Amounts are exact Amount values kept as decimal text, never floats. Payment data also takes whole ints, and each gateway validates them against its documented rules.
---

# Amounts

Every payment data `amount` (and every Wave Money item `amount`) is an `Amount` or a whole `int`. An `Amount` is an exact, non-negative amount kept as decimal text, so it is never rounded through a `float`.

```php
use Laranex\PhpMyanmarPayments\Amount;

Amount::kyat(10000);       // whole amount: 10000
Amount::parse('10000.50'); // decimal, from a string
Amount::from(10000);       // an Amount as is, or an int through kyat()
```

Payment data accepts a plain `int` directly (`amount: 10000`), which is the same as passing `Amount::kyat(10000)`. A `float` such as `10.5` is never accepted: write decimals as `Amount::parse('10.50')`.

## Parsing

`Amount::parse` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Amount::kyat` takes an `int`. Negative values throw.

They throw an `InvalidPaymentDataException` with an `amount` entry, so bad user input surfaces like any other invalid field:

```php
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\Exceptions\InvalidPaymentDataException;

try {
    $amount = Amount::parse($input);
} catch (InvalidPaymentDataException $e) {
    // The amount field must be a number such as 1000 or 1000.50,
    // got "1,000".
    error_log($e->errors()['amount']);
}
```

## Methods

| Method | Returns |
|---|---|
| `Amount::kyat($n)` | A whole amount from an `int` |
| `Amount::parse($text)` | A decimal amount from plain digits |
| `Amount::from($value)` | `$value` itself when it is an `Amount`, else `Amount::kyat($value)` |
| `$amount->toString()` | The amount as sent to the gateway, e.g. `1000.50`; also `(string) $amount` |
| `$amount->decimalPlaces()` | Number of fractional digits |
| `$amount->wholePart()` | The digits before the decimal point |
| `$amount->isZero()` | The amount equals zero |
| `$amount->isPositive()` | The amount is greater than zero |
| `$amount->equals($other)` | Same value, ignoring leading zeros and trailing fractional zeros (`1000` equals `1000.00`); takes an `Amount` or a `string`; `null` and text that is not plain digits are never equal |
| `json_encode($amount)` | The amount as a JSON string, e.g. `"1000.50"` |

The payment data classes always store an `Amount`, so `$data->amount` is an `Amount` even when you passed an `int`.

## Gateway Rules

Each gateway checks the amount against its official documentation when you create the payment data, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation throws `InvalidPaymentDataException`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

## Storing Amounts

`$amount->toString()` is the exact text (`"1000.50"`), so store it in a text or `DECIMAL` column. `json_encode` writes an `Amount` as a string (`"1000.50"`), so no JSON consumer parses it as a float. Read it back with `Amount::parse`.

Amounts reported by gateways (`PaymentCallback::$amount`, `PaymentStatusResult::$amount`) are plain `string`s: the exact text the gateway sent, even when it sent a JSON number such as `1000.50`. Compare them with `$amount->equals($callback->amount)`.
