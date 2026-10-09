---
title: Amounts
description: Amounts are exact Amount values or whole numbers, never floats. Each gateway validates them against its documented rules for decimals and minimums.
---

# Amounts

Every payment data object takes an `AmountInput` for its amount: an `Amount`, or a whole `number` or `bigint`. A plain whole number is a whole amount; use the `Amount` value object from `@laranex/myanmar-payments` when you need decimals. Fractional numbers are never accepted, so an amount is never rounded on its way into a signature.

```ts
import { Amount } from '@laranex/myanmar-payments';

Amount.kyat(10000); // whole amount
Amount.parse('10000.50'); // decimal amount

// this.payments is the injected MyanmarPaymentsService
const payment = await this.payments.kbzPay().pwa({
  orderId: `ORDER_${order.id}`,
  amount: Amount.parse('10000.50'), // or simply 10000
  callbackUrl: 'https://shop.test/payments/kbz/callback',
});
```

## Creating Amounts

| Constructor | Accepts |
|---|---|
| `Amount.kyat(amount: number \| bigint)` | A whole amount, 0 or more: a safe integer `number` or a `bigint`. Works for whole units of any currency |
| `Amount.parse(amount: string)` | Plain digits with an optional decimal part: `1000`, `1000.50`, `0.5`. Leading zeros of the whole part are dropped (`007.50` becomes `7.50`); the fraction is kept exactly |
| `Amount.from(amount: Amount \| number \| bigint)` | An `Amount` as is, or a whole number through `kyat()`. The gateways use it |

`parse()` rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`), and `kyat()` rejects negatives, fractions, `NaN` and integers beyond `Number.MAX_SAFE_INTEGER` (pass a `bigint` instead), by throwing `InvalidPaymentDataError` with an `amount` error.

An `Amount` exposes `toString()` (as given without leading zeros, also via `JSON.stringify`, which writes a string), `decimalPlaces()`, `wholePart()`, `isZero()`, `isPositive()` and `equals(other)`, which compares with another `Amount` or a decimal string, ignoring trailing fractional zeros.

## Gateway Rules

Each gateway checks the amount against its official documentation when you start the payment, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation throws `InvalidPaymentDataError`, e.g. `Wave Money does not accept decimal amounts; the amount field must be a whole number.`

Amounts reported back by gateways (`PaymentCallback.amount`, `PaymentStatusResult.amount`) stay plain strings: they are the raw values the gateway sent. Compare them with your order before fulfilling.
