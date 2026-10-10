---
title: Installation
description: Install Laravel Myanmar Payments via Composer. Requires PHP 8.1+ and Laravel 10 or higher. Auto-discovery registers the service provider and facade.
---

# Installation

## Install the Package

> **Requires** PHP 8.1+ and Laravel 10 to 13.

```bash
composer require laranex/laravel-myanmar-payments
```

Laravel's package auto-discovery registers the service provider and the `MyanmarPayments` facade (`Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments`). The facade resolves the `Laranex\LaravelMyanmarPayments\MyanmarPayments` singleton, which you can also inject into your own classes.

The package is a thin Laravel layer over [`laranex/php-myanmar-payments`](https://github.com/laranex/php-myanmar-payments), which Composer installs alongside it. The core talks to gateways through any PSR-18 HTTP client; in Laravel every call goes through the `Http` client, so `Http::fake()` works in your tests and no extra client is needed. The package requires `guzzlehttp/guzzle` ^7.4 or ^8, which Laravel's `Http` client runs on (Laravel 10 only suggests it), so Composer installs it for you.

## Publish the Config

```bash
php artisan vendor:publish --tag="myanmar-payments-config"
```

This creates `config/myanmar-payments.php` (the `myanmar-payments` tag publishes the same file). Publishing is optional: every value is read from environment variables. See [Configuration](/laravel-myanmar-payments/configuration).

## Framework Services

The package uses these Laravel services. Every Laravel app has them, so there is nothing to register:

| Service | Used for |
|---|---|
| HTTP client (`Http`) | Gateway calls, so `Http::fake()` works in tests |
| Cache | Sharing Yoma MMQR access tokens (`cache_store`) |
| Encrypter (`APP_KEY`) | Encrypting auto-submit form links |
| Router | The auto-submit form route |

## What It Provides

| Class | What it is |
|---|---|
| `Facades\MyanmarPayments` | The facade: `kbzPay()`, `waveMoney()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()`, `gateway($name)`, `gateways()`, `handleCallback($gateway, $request)`, `acknowledge($callback)` |
| `MyanmarPayments` | The singleton behind the facade, for constructor injection |
| `Gateways\KbzPay`, `WaveMoney`, `AyaPay`, `YomaMmqr`, `CyberSource` | The SDK gateways, extended to accept a Laravel `Request` in `handleCallback()` (and AYA's `verifyRedirect()`); AYA Pay and CyberSource also set `autoSubmitUrl` |
| `Http\CallbackResponse` | What `acknowledge()` returns: a `Responsable` with the gateway's acknowledgement |
| `Http\CallbackRequestFactory` | Turns a Laravel `Request` into the SDK's `CallbackRequest` |
| `Http\FormPaymentUrl` | Builds and reads the encrypted auto-submit form links |
| `Http\Controllers\FormPaymentController` | The auto-submit form route's controller |
| `Http\LaravelHttpClient` | The PSR-18 client over Laravel's `Http` client that the gateways use |
| `MyanmarPaymentsServiceProvider` | Registers the singleton, the config and the form route |

All classes live under `Laranex\LaravelMyanmarPayments`. Everything about payments themselves (`Amount`, payment data, results, `PaymentCallback`, `PaymentStatus`, exceptions) comes from `Laranex\PhpMyanmarPayments`.

## Without Laravel

Plain PHP projects can install the core package directly and use the same gateways, request classes and results. See the [PHP Myanmar Payments docs](/php-myanmar-payments/introduction) for the full guide.

```bash
composer require laranex/php-myanmar-payments guzzlehttp/guzzle
```

```php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$kbzPay = new KbzPay(new KbzPayConfig(
    appId: '...',
    appKey: '...',
    merchantCode: '...',
    sandbox: true,
));

$payment = $kbzPay->pwa(new KbzPayPaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    callbackUrl: 'https://shop.test/payments/kbz/callback',
));

// In the callback endpoint
$callback = $kbzPay->handleCallback(CallbackRequest::fromGlobals());
$callback->acknowledgement->send();
```

To build every gateway from one object, as this package's facade does, use the SDK's `MyanmarPayments`; see [One Object for Every Gateway](/php-myanmar-payments/configuration#one-object-for-every-gateway).
