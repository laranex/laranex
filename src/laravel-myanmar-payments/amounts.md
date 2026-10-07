---
title: Amounts
description: Amounts are exact Amount values or plain integers, never floats. Each gateway validates them against its documented rules for decimals and minimums.
---

# Amounts

Every payment data class takes `Amount|int` for its amount. A plain `int` is a whole amount; use the `Laranex\PhpMyanmarPayments\Amount` value object when you need decimals. Floats are never accepted, so an amount is never rounded on its way into a signature.

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

Amount::kyat(1000);       // whole amount
Amount::parse('1000.50'); // decimal amount

$payment = MyanmarPayments::kbzPay()->pwa(new KbzPayPaymentData(
    orderId: 'ORDER_1',
    amount: Amount::parse('1000.50'), // or simply 1000
    callbackUrl: route('payments.kbz.callback'),
));
```

## Creating Amounts

| Constructor | Accepts |
|---|---|
| `Amount::kyat(int $amount)` | A whole amount, 0 or more. Works for whole units of any currency |
| `Amount::parse(string $amount)` | Plain digits with an optional decimal part: `1000`, `1000.50`, `0.5` |

`parse()` rejects signs, exponents, spaces and thousands separators (`-1`, `1e5`, ` 10`, `1,000`, `10.`, `.5`), and both constructors reject negatives, by throwing `InvalidPaymentDataException` with an `amount` error.

An `Amount` exposes `toString()` (exactly as given, also via `(string) $amount`), `decimalPlaces()`, `wholePart()`, `isZero()` and `isPositive()`. The payment data classes always store an `Amount`, so `$data->amount` is an `Amount` even when you passed an `int`.

## Gateway Rules

Each gateway checks the amount against its official documentation when the payment data is created, before any request is sent:

| Gateway | Decimals | Other rules |
|---|---|---|
| KBZ Pay | Up to 2 places | Greater than 0, MMK only |
| Wave Money | No | Greater than 0, MMK only. The total defaults to the sum of the items |
| AYA Payment Gateway | No | Greater than 0, MMK only |
| Yoma MMQR | No | Greater than 0 |
| CyberSource | Any | 0 or more, at most 15 characters, any ISO 4217 currency |

A violation throws `InvalidPaymentDataException`, e.g. `Wave Money does not accept decimal amounts.`

Amounts reported back by gateways (`PaymentCallback::$amount`, `PaymentStatusResult::$amount`) stay plain strings: they are the raw values the gateway sent. Compare them with your order before fulfilling.
