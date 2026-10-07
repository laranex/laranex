---
title: Installation
description: Install PHP Myanmar Payments via Composer. Requires PHP 8.1+ and any PSR-18 HTTP client, discovered automatically.
---

# Installation

## Via Composer

> **Requires** PHP 8.1+ and any PSR-18 HTTP client.

```bash
composer require laranex/php-myanmar-payments guzzlehttp/guzzle
```

The package has no framework dependency. It talks to gateways through [PSR-18](https://www.php-fig.org/psr/psr-18/), and [`php-http/discovery`](https://github.com/php-http/discovery) finds the client you have installed: Guzzle, Symfony HttpClient or any other PSR-18 implementation. Guzzle is shown above; skip it if your project already has a client.

You can also pass your own client explicitly, see [Configuration](/php-myanmar-payments/configuration#http-client).

## Quick Start

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

$kbzPay = new KbzPay(new KbzPayConfig(
    appId: 'kp...',
    appKey: '...',
    merchantCode: '...',
    sandbox: true,
));

$payment = $kbzPay->pwa(new KbzPayPaymentData(
    orderId: 'ORDER_1',
    amount: 1000,
    callbackUrl: 'https://shop.test/kbz/callback.php',
));

header('Location: '.$payment->url);
exit;
```

## Using Laravel?

Install [`laranex/laravel-myanmar-payments`](/laravel-myanmar-payments/introduction) instead. It wraps this package with a facade, `.env` configuration, `Request` support for callbacks and an auto-submit form route.
