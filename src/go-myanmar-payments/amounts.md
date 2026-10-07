---
title: Amounts
description: Amounts are myanmarpayments.Amount values, exact decimal text that is never rounded through a float. Each gateway validates them against its documented rules.
---

# Amounts

Every `PaymentData.Amount` (and `wavemoney.Item.Amount`) is a `myanmarpayments.Amount`: an exact, non-negative amount kept as decimal text, so it is never rounded through a `float64`.

```go
myanmarpayments.Kyat(1000)                  // whole amount: 1000
myanmarpayments.MustParseAmount("1000.50")  // decimal; panics on bad input (constants, tests)

amount, err := myanmarpayments.ParseAmount(input) // decimal from user input
if err != nil {
	// *myanmarpayments.InvalidPaymentDataError with an "amount" entry
}
```

## Parsing

`ParseAmount` accepts only digits with an optional fractional part: `1000`, `1000.50`, `0.5`. It rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`). Leading zeros of the whole part are removed (`007` becomes `7`); fractional digits are kept exactly as given (`10.50` stays `10.50`).

`Kyat` takes an `int64` so plain integer variables need no conversion. A negative value does not panic: it produces an `Amount` that every gateway's `Validate` rejects like any other bad field.

The zero value `myanmarpayments.Amount{}` means "not provided"; every gateway reports it as `The amount field is required.`

## Methods

| Method | Returns |
|---|---|
| `String()` | The amount as sent to the gateway |
| `IsSet()` | `false` for the zero value |
| `Valid()` | Set and well formed |
| `DecimalPlaces()` | Number of fractional digits |
| `IsZero()` | The amount equals zero |
| `IsPositive()` | Valid and greater than zero |

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

## JSON

An `Amount` marshals as a JSON string (`"1000.50"`); the zero value marshals as `null`. It unmarshals from a string or a plain JSON number, using the number's literal text, so `10.5` becomes exactly `10.5` without a float conversion. `null` leaves it unset; `-1`, `1e5`, `"1,000"` and booleans are rejected.

Amounts reported by gateways (`PaymentCallback.Amount`, `PaymentStatusResult.Amount`) stay plain `string`s: they are the raw values the gateway sent.
