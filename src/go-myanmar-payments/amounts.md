---
title: Amounts
description: Amounts are exact myanmarpayments.Amount values kept as decimal text, never floats. Each gateway validates them against its documented rules.
---

# Amounts

Every payment data `Amount` (and every Wave Money item `Amount`) is a `myanmarpayments.Amount`. An `Amount` is an exact, non-negative amount kept as decimal text, so it is never rounded through a `float64`.

```go
myanmarpayments.Kyat(10000) // whole amount: 10000

// decimal; panics on bad input (constants, tests)
myanmarpayments.MustParseAmount("1000.50")

// decimal, from user input
amount, err := myanmarpayments.ParseAmount(input)
```

Payment data takes only an `Amount`, so a `float64` such as `10.5` is never accepted: write decimals as `MustParseAmount("10.50")` or parse them with `ParseAmount`.

## Parsing

`ParseAmount` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Kyat` takes an `int64`, so plain integer variables need no conversion. A negative value does not panic: it produces an `Amount` that every gateway's `Validate` rejects like any other bad field. The zero value `myanmarpayments.Amount{}` means "not provided"; every gateway reports it as `The amount field is required.`

`ParseAmount` returns an `*myanmarpayments.InvalidPaymentDataError` with an `amount` entry, so bad user input surfaces like any other invalid field:

```go
amount, err := myanmarpayments.ParseAmount(input)
var invalidErr *myanmarpayments.InvalidPaymentDataError
if errors.As(err, &invalidErr) {
	log.Print(invalidErr.Errors["amount"])
}
```

## Methods

| Method | Returns |
|---|---|
| `Kyat(n)` | A whole amount from an `int64` |
| `ParseAmount(text)` | A decimal amount from plain digits, or an error |
| `MustParseAmount(text)` | The same, panicking on bad input |
| `amount.String()` | The amount as sent to the gateway, e.g. `1000.50`; `""` for the zero value |
| `amount.IsSet()` | `false` for the zero value |
| `amount.Valid()` | Set and well formed |
| `amount.DecimalPlaces()` | Number of fractional digits |
| `amount.WholePart()` | The digits before the decimal point; `""` for the zero value |
| `amount.IsZero()` | The amount equals zero |
| `amount.IsPositive()` | The amount is valid and greater than zero |
| `amount.Equals(text)` | Same value, ignoring leading zeros of the whole part and trailing fractional zeros (`01000` and `1000.00` equal `1000`); text that is not plain digits, and an unset or invalid amount, is never equal |

`Amount` is an immutable value: copy it and compare two `Amount`s with `==`, which compares the exact text (`1000` and `1000.00` differ); use `Equals` to compare by value.

## Gateway Rules

Each gateway checks the amount against its official documentation when you start a payment, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation returns `*myanmarpayments.InvalidPaymentDataError`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

## Storing Amounts

`amount.String()` is the exact text (`"1000.50"`), so store it in a text or `DECIMAL` column and read it back with `ParseAmount`. An `Amount` marshals as a JSON string (`"1000.50"`), so no JSON consumer parses it as a float; the zero value marshals as `null`. It unmarshals from a string or a plain JSON number, using the number's literal text, so `10.5` becomes exactly `10.5`; `null` leaves it unset, and `-1`, `1e5`, `"1,000"` and booleans are rejected.

Amounts reported by gateways (`PaymentCallback.Amount`, `PaymentStatusResult.Amount`) are plain `string`s: the exact text the gateway sent, even when it sent a JSON number such as `1000.50`. Compare them with `amount.Equals(callback.Amount)`.
