---
title: Installation
description: Install Laravel Myanmar Payments via Composer. Requires PHP 8.1+ and Laravel 10 or higher. Auto-discovery registers the service provider and facade.
---

# Installation

## Via Composer

> **Requires** PHP 8.1+ and Laravel 10 to 13.

```bash
composer require laranex/laravel-myanmar-payments
```

Laravel's package auto-discovery registers the service provider and the `MyanmarPayments` facade (`Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments`).

The package is a thin Laravel layer over [`laranex/php-myanmar-payments`](https://github.com/laranex/php-myanmar-payments), which Composer installs alongside it. The core talks to gateways through any PSR-18 HTTP client; in Laravel every call goes through the `Http` client, so `Http::fake()` works in your tests and no extra client is needed.

## Publish Config

```bash
php artisan vendor:publish --tag="myanmar-payments-config"
```

This creates `config/myanmar-payments.php`. Publishing is optional: every value is read from environment variables. See [Configuration](/laravel-myanmar-payments/configuration).

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

$kbzPay = new KbzPay(new KbzPayConfig(appId: '...', appKey: '...', merchantCode: '...', sandbox: true));

$payment = $kbzPay->pwa(new KbzPayPaymentData(orderId: 'ORDER_1', amount: 1000, callbackUrl: 'https://shop.test/kbz/callback'));

// In the callback endpoint
$callback = $kbzPay->handleCallback(CallbackRequest::fromGlobals());
$callback->acknowledgement()->send();
```
