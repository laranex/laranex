---
title: Amounts
description: Amounts are exact Amount values kept as decimal text, never floating-point numbers. Payment data also takes whole numbers and bigints, and each gateway validates them against its documented rules.
---

# Amounts

Every payment data `amount` (and every Wave Money item `amount`) is an `Amount`, a whole `number` or a `bigint`. An `Amount` is an exact, non-negative amount kept as decimal text, so it is never rounded through a floating-point `number`.

```ts
import { Amount } from '@laranex/myanmar-payments';

Amount.kyat(10000); // whole amount: 10000
Amount.kyat(10_000_000_000_000_000_000n); // any size of bigint
Amount.parse('10000.50'); // decimal, from a string
Amount.from(10000); // any accepted input
```

Payment data accepts the same inputs directly (`amount: 10000`, `amount: 10000n`), which is the same as passing `Amount.from(...)`. A fractional `number` such as `10.5` is never accepted: write decimals as `Amount.parse('10.50')`.

## Parsing

`Amount.parse` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Amount.kyat` takes a safe integer `number` or a `bigint` of any size. Negative values, fractions, `NaN` and integers beyond `Number.MAX_SAFE_INTEGER` (pass a `bigint` instead) throw.

They throw an `InvalidPaymentDataError` with an `amount` entry, so bad user input surfaces like any other invalid field:

```ts
import { Amount, InvalidPaymentDataError } from '@laranex/myanmar-payments';

try {
  const amount = Amount.parse(userInput);
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
| `amount.toString()` | The amount as sent to the gateway, e.g. `1000.50` |
| `amount.toJSON()` | The same string, so `JSON.stringify` writes `"1000.50"` |
| `amount.decimalPlaces()` | Number of fractional digits |
| `amount.wholePart()` | The digits before the decimal point |
| `amount.isZero()` | The amount equals zero |
| `amount.isPositive()` | The amount is greater than zero |
| `amount.equals(other)` | Same value, ignoring leading zeros of the whole part and trailing fractional zeros (`1000` equals `01000` and `1000.00`); takes an `Amount` or a `string`. Text that isn't plain digits (`1,000`, ` 1000`), `undefined` and `null` are never equal |

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

## Storing Amounts

`amount.toString()` is the exact text (`"1000.50"`), so store it in a text or `DECIMAL` column. `JSON.stringify` writes an `Amount` as that string through `toJSON()`, so no consumer parses it as a float; read it back with `Amount.parse`.

Amounts reported by gateways (`PaymentCallback.amount`, `PaymentStatusResult.amount`) are plain `string`s: the exact text the gateway sent, even when it sent a JSON number such as `1000.50`. Compare them with `amount.equals(callback.amount)`.
