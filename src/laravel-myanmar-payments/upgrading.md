---
title: Upgrading
description: Upgrade to Laravel Myanmar Payments v3 from v2 or the v3 preview. Typed accessors, typed results, Request-based callbacks and a mapped PaymentStatus.
---

# Upgrading to v3

v3 is rebuilt on [`laranex/php-myanmar-payments`](https://github.com/laranex/php-myanmar-payments). Every gateway takes a typed request object and returns a typed result.

## Requirements

PHP 8.1+ and Laravel 10 to 13.

## Facade

```php
// Before (v2)
use Laranex\LaravelMyanmarPayments\LaravelMyanmarPaymentsFacade;

// Before (v3 preview)
use Laranex\LaravelMyanmarPayments\MyanmarPaymentsFacade as MyanmarPayments;

// After
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
```

The global alias changed from `LaravelMyanmarPayments` to `MyanmarPayments`.

## Starting Payments

String driver names are replaced with typed accessors, and the request classes moved to the core package.

| Before | After |
|---|---|
| `driver('kbzpay.pwa')->initiate($data)` | `kbzPay()->pwa($data)` |
| `driver('kbzpay.qr')->initiate($data)` | `kbzPay()->qr($data)` |
| `driver('kbzpay.app')->initiate($data)` | `kbzPay()->app($data)` |
| `driver('wave_money')->initiate($data)` | `waveMoney()->initiate($data)` |
| `driver('aya_pay')->initiate($data)` | `ayaPay()->initiate($data)` |
| `driver('cyber_source')->initiate($data)` | `cyberSource()->initiate($data)` |
| — | `yomaMmqr()->initiate($data)` (new) |

| Before | After |
|---|---|
| `Data\Request\KbzPayRequestPaymentData` | `Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData` |
| `Data\Request\WaveMoneyRequestPaymentData` | `Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyPaymentData` |
| `Data\Request\AyaPayRequestPaymentData` | `Laranex\PhpMyanmarPayments\AyaPay\AyaPayPaymentData` |
| `Data\Request\CyberSourceRequestPaymentData` | `Laranex\PhpMyanmarPayments\CyberSource\CyberSourcePaymentData` |

Parameters share one vocabulary: `transactionId` is now `orderId`, `backendResultUrl` is `callbackUrl`, `frontendUrl` / `frontendResultUrl` is `returnUrl`. Wave items are `WaveMoneyItem` objects, AYA needs a `channel` and an `AyaPayMethod`, and KBZ's `currency` / `nonceStr` and CyberSource's `transactionUuid` / `referenceNumber` are handled internally.

## Results

`RequestPaymentResult` and its `mixed` `value` / `originalValue` are replaced by one class per flow:

| Before | After |
|---|---|
| `$result->value` (redirect) | `RedirectPayment::$url` |
| `$result->value` (form) | `FormPayment::$autoSubmitUrl` |
| `$result->originalValue['url' / 'data']` | `FormPayment::$action` / `$fields` |
| `$result->value` (KBZ QR) | `QrPayment::$qrString` |
| `$result->value` (KBZ App) | `AppPayment::toArray()` |
| `$result->transactionId` | `$payment->orderId` |

See [Payment Flows](/laravel-myanmar-payments/payment-flows).

## Callbacks

Pass the request instead of an array, and read the mapped status:

```php
// Before
$result = MyanmarPayments::driver('kbzpay.pwa')->handleCallback($request->all());
if ($result->successful) { /* $result->transactionId */ }

// After
$callback = MyanmarPayments::kbzPay()->handleCallback($request);
if ($callback->isSuccessful()) { /* $callback->orderId */ }

return MyanmarPayments::acknowledge($callback);
```

`HandlePaymentResult::$successful` becomes `PaymentCallback::$status` (`PaymentStatus`), and unknown gateway statuses no longer throw. `transactionId` is split into `orderId` (yours) and `gatewayReference` (the gateway's). See [Callbacks & Status](/laravel-myanmar-payments/callbacks).

## Configuration

Republish the config: `php artisan vendor:publish --tag="myanmar-payments-config" --force`.

- Each gateway has a `*_SANDBOX` switch that picks its endpoints; base URL variables are now optional overrides.
- KBZ Pay's config keys are `api_url` and `pwa_url`; the `KBZ_PAY_BASE_URL` and `KBZ_PAY_PWA_BASE_REDIRECT_URL` env names are unchanged. `KBZ_PAY_MERCHANT_NAME` is no longer used.
- AYA reads `AYA_PAY_*`, falling back to the `AYA_PGW_*` names.
- Yoma MMQR, `MYANMAR_PAYMENTS_HTTP_TIMEOUT`, `MYANMAR_PAYMENTS_CACHE_STORE` and the `form_route` options are new.

## Removed

- 2C2P support, its config and the `firebase/php-jwt` dependency.
- `MyanmarPayments::driver()` and `RequestPaymentData` / `PaymentDriver` contracts.
