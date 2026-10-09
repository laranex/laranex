---
title: Amounts
description: Amounts are exact Amount values kept as decimal text, never floating-point numbers. Each gateway validates them against its documented rules.
---

# Amounts

Every payment data `amount` (and every Wave Money item `amount`) is an `Amount` or a whole number of kyat. An `Amount` is an exact, non-negative amount kept as decimal text, so it is never rounded through a floating-point `number`.

```ts
import { Amount } from '@laranex/myanmar-payments';

Amount.kyat(1000);              // whole amount: 1000
// a bigint works too, beyond Number.MAX_SAFE_INTEGER
Amount.kyat(10_000_000_000n);
Amount.parse('1000.50');        // decimal, from a string
```

Payment data also accepts a plain integer (`amount: 1000`) or `bigint`, which is the same as `Amount.kyat()`. A fractional `number` such as `10.5` is never accepted: write decimals as `Amount.parse('10.50')`.

## Parsing

`Amount.parse` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Amount.kyat` takes a safe integer `number` or a `bigint`. Negative values, fractions, `NaN` and integers beyond `Number.MAX_SAFE_INTEGER` (pass a `bigint` instead) throw.

Both throw an `InvalidPaymentDataError` with an `amount` entry, so bad user input surfaces like any other invalid field:

```ts
try {
  const amount = Amount.parse(input);
} catch (error) {
  if (error instanceof InvalidPaymentDataError) {
    console.log(error.errors.amount);
  }
}
```

## Methods

| Method | Returns |
|---|---|
| `Amount.kyat(n)` | A whole amount from a safe integer or `bigint` |
| `Amount.parse(text)` | A decimal amount from plain digits |
| `Amount.from(value)` | `value` itself when it is an `Amount`, else `Amount.kyat(value)` |
| `Amount.isAmount(value)` | Whether `value` is an `Amount` |
| `toString()` | The amount as sent to the gateway, e.g. `1000.50` |
| `toJSON()` | The same string, so `JSON.stringify` writes `"1000.50"` |
| `decimalPlaces()` | Number of fractional digits |
| `wholePart()` | The digits before the decimal point |
| `isZero()` | The amount equals zero |
| `isPositive()` | The amount is greater than zero |
| `equals(other)` | Same value, ignoring trailing fractional zeros (`1000` equals `1000.00`); takes an `Amount` or a string; `undefined` or `null` is never equal |

## Gateway Rules

Each gateway checks the amount against its official documentation when you start a payment, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation throws `InvalidPaymentDataError`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

## JSON

`JSON.stringify` writes an `Amount` as a string (`"1000.50"`), so no JSON consumer parses it as a float. Read it back with `Amount.parse`.

Amounts reported by gateways (`PaymentCallback.amount`, `PaymentStatusResult.amount`) are plain `string`s: the exact text the gateway sent, even when it sent a JSON number such as `1000.50`. Compare them with `amount.equals(callback.amount)`.
