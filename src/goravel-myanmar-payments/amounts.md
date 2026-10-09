---
title: Amounts
description: Amounts are exact myanmarpayments.Amount values, never floats. Each gateway validates them against its documented rules for decimals and minimums.
---

# Amounts

Every payment data struct takes a `myanmarpayments.Amount` for its amount. `myanmarpayments.Kyat()` builds a whole amount; use `myanmarpayments.ParseAmount()` when you need decimals. Floats are never accepted, so an amount is never rounded on its way into a signature.

```go
import (
	"fmt"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

myanmarpayments.Kyat(10000)                 // whole amount
myanmarpayments.MustParseAmount("10000.50") // decimal amount

kbz, err := paymentsfacades.MyanmarPayments().KbzPay()
payment, err := kbz.PWA(ctx, kbzpay.PaymentData{
	OrderID: fmt.Sprintf("ORDER_%d", order.ID),
	// or simply myanmarpayments.Kyat(10000)
	Amount:      myanmarpayments.MustParseAmount("10000.50"),
	CallbackURL: "https://shop.test/payments/kbz/callback",
})
```

## Creating Amounts

| Constructor | Accepts |
|---|---|
| `myanmarpayments.Kyat(n int64)` | A whole amount, 0 or more. Works for whole units of any currency |
| `myanmarpayments.ParseAmount(s string)` | Plain digits with an optional decimal part: `1000`, `1000.50`, `0.5`. Leading zeros of the whole part are dropped (`007.50` becomes `7.50`); the fraction is kept exactly. Returns `(Amount, error)` |
| `myanmarpayments.MustParseAmount(s string)` | Like `ParseAmount`, but panics on bad input. Use it for constants and tests |

`ParseAmount()` rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`) by returning an `*InvalidPaymentDataError` with an `amount` error. `Kyat()` never fails: a negative value yields an amount that every gateway's validation rejects with the same error.

An `Amount` exposes `String()` (as given without leading zeros), `DecimalPlaces()`, `IsSet()`, `Valid()`, `IsZero()` and `IsPositive()`. It encodes to JSON as a string (`"10000.50"`) and decodes from a JSON string or number without passing through a float. The zero value means "not provided".

## Gateway Rules

Each gateway checks the amount against its official documentation before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation returns an `*InvalidPaymentDataError`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

Amounts reported back by gateways (`PaymentCallback.Amount`, `PaymentStatusResult.Amount`) stay plain strings: they are the raw values the gateway sent. Compare them with your order before fulfilling.
