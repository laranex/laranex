---
title: Amounts
description: Amounts are exact Amount values kept as decimal text, never floats. Payment data also takes whole ints, decimal text and Decimal, and each gateway validates them against its documented rules.
---

# Amounts

Every payment data `amount` (and every Wave Money item `amount`) is an `Amount`, a whole `int`, decimal text such as `"1000.50"` or a `Decimal`. An `Amount` is an exact, non-negative amount kept as decimal text, so it is never rounded through a `float`.

```python
from decimal import Decimal

from python_myanmar_payments import Amount

Amount.kyat(1000)  # whole amount: 1000
Amount.kyat(10_000_000_000_000_000_000)  # any size of int
Amount.parse("1000.50")  # decimal, from a string
Amount.of(Decimal("1000.50"))  # any accepted input
Amount(1000)  # the same as Amount.of(1000)
```

Payment data accepts the same inputs directly (`amount=1000`, `amount="1000.50"`, `amount=Decimal("1000.50")`), which is the same as passing `Amount.of(...)`. A `float` such as `10.5` is never accepted: write decimals as `Amount.parse("10.50")` or a `Decimal`.

## Parsing

`Amount.parse` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Amount.kyat` takes an `int` of any size. Negative values, `bool`s and anything that isn't an `int` raise. `Amount.of` also takes a finite, non-negative `Decimal` and keeps its exact digits (`Decimal("1000.50")` is `1000.50`).

They raise an `InvalidPaymentDataError` with an `amount` entry, so bad user input surfaces like any other invalid field:

```python
from python_myanmar_payments import Amount, InvalidPaymentDataError

try:
    amount = Amount.parse(user_input)
except InvalidPaymentDataError as error:
    print(error.errors["amount"])
```

## Methods

| Method | Returns |
|---|---|
| `Amount.kyat(n)` | A whole amount from an `int` |
| `Amount.parse(text)` | A decimal amount from plain digits |
| `Amount.of(value)` | `value` itself when it is an `Amount`, else the amount for an `int`, `str` or `Decimal` |
| `Amount(value)` | The same as `Amount.of(value)` |
| `str(amount)` | The amount as sent to the gateway, e.g. `1000.50` |
| `amount.to_decimal()` | The amount as an exact `Decimal`, e.g. for a `DecimalField` |
| `amount.decimal_places()` | Number of fractional digits |
| `amount.whole_part()` | The digits before the decimal point |
| `amount.is_zero()` | The amount equals zero |
| `amount.is_positive()` | The amount is greater than zero |
| `amount.equals(other)` | Same value, ignoring trailing fractional zeros (`1000` equals `1000.00`); takes an `Amount` or a `str`; `None` is never equal |
| `amount == other` | The same comparison between two `Amount`s; `Amount`s are hashable and immutable |

## Gateway Rules

Each gateway checks the amount against its official documentation when you start a payment, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation raises `InvalidPaymentDataError`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

## Storing Amounts

`str(amount)` is the exact text (`"1000.50"`), so store it in a text or `DECIMAL` column, or as `amount.to_decimal()`. `json.dumps` doesn't know `Amount`: write `str(amount)` into your JSON, so no consumer parses it as a float, and read it back with `Amount.parse`.

Amounts reported by gateways (`PaymentCallback.amount`, `PaymentStatusResult.amount`) are plain `str`s: the exact text the gateway sent, even when it sent a JSON number such as `1000.50`. Compare them with `amount.equals(callback.amount)`.
