---
title: Installation
description: Install PHP Myanmar Payments with Composer. Requires PHP 8.1+ and any PSR-18 HTTP client, discovered automatically.
---

# Installation

## Via Composer

> **Requires** PHP 8.1+ and any [PSR-18](https://www.php-fig.org/psr/psr-18/) HTTP client, which sends the gateway requests.

```bash
composer require laranex/php-myanmar-payments guzzlehttp/guzzle
```

The package has no framework dependency. [`php-http/discovery`](https://github.com/php-http/discovery) finds the client you have installed: Guzzle, Symfony HttpClient or any other PSR-18 implementation. Guzzle is shown above; skip it if your project already has a client. You can also pass your own client, see [Configuration](/php-myanmar-payments/configuration#http-client).

Every class is typed and checked with PHPStan at level 7. Import each class from its namespace:

```php
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
```

| Namespace | Contents |
|---|---|
| `Laranex\PhpMyanmarPayments` | `Amount` and the `MyanmarPayments` facade |
| `Laranex\PhpMyanmarPayments\Results` | Results, `PaymentCallback`, `PaymentStatusResult` |
| `Laranex\PhpMyanmarPayments\Enums` | `PaymentStatus`, `PaymentFlow` |
| `Laranex\PhpMyanmarPayments\Http` | `CallbackRequest`, `Acknowledgement` |
| `Laranex\PhpMyanmarPayments\Exceptions` | Exceptions |
| `Laranex\PhpMyanmarPayments\KbzPay` | `KbzPay`, `KbzPayConfig`, `KbzPayPaymentData`, `KbzPaySigner` |
| `Laranex\PhpMyanmarPayments\WaveMoney` | `WaveMoney`, `WaveMoneyConfig`, `WaveMoneyPaymentData`, `WaveMoneyItem` |
| `Laranex\PhpMyanmarPayments\AyaPay` | `AyaPay`, `AyaPayConfig`, `AyaPayPaymentData`, `AyaPayMethod`, `AyaPayService` |
| `Laranex\PhpMyanmarPayments\YomaMmqr` | `YomaMmqr`, `YomaMmqrConfig`, `YomaMmqrPaymentData` |
| `Laranex\PhpMyanmarPayments\CyberSource` | `CyberSource`, `CyberSourceConfig`, `CyberSourcePaymentData`, `CyberSourceTransactionType` |

Classes marked `@internal` (`Transport`, `HttpResponse`, the `Support` classes other than `ArrayCache`, and the Wave Money and AYA signers) are not part of the public API.

## Quick Start

A plain PHP app that starts a KBZ Pay PWA payment and verifies the callback:

```php
<?php

// public/index.php
require __DIR__.'/../vendor/autoload.php';

use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

// Throws a ConfigurationException naming the missing setting
$kbz = KbzPay::fromEnv();

$route = $_SERVER['REQUEST_METHOD'].' '
    .parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($route === 'GET /checkout') {
    $data = new KbzPayPaymentData(
        orderId: 'ORDER_1',
        amount: 10000,
        callbackUrl: 'https://shop.test/payments/kbz/callback',
    );
    $payment = $kbz->pwa($data);

    header('Location: '.$payment->url);
    exit;
}

if ($route === 'POST /payments/kbz/callback') {
    try {
        $callback = $kbz->handleCallback(CallbackRequest::fromGlobals());
    } catch (SignatureVerificationException) {
        http_response_code(400);
        echo 'invalid callback';
        exit;
    }

    if ($callback->isSuccessful()) {
        // compare $callback->amount with your order,
        // then fulfill $callback->orderId
    }

    $callback->acknowledgement->send(); // KBZ Pay expects a plain "success"
    exit;
}

http_response_code(404);
```

See [Framework Integration](/php-myanmar-payments/framework-integration) for Symfony, Slim and any PSR-7 / PSR-15 framework.

## Using Laravel?

Install [`laranex/laravel-myanmar-payments`](/laravel-myanmar-payments/introduction) instead. It wraps this package with a facade, `.env` configuration, `Request` support for callbacks and an auto-submit form route.
