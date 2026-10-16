---
title: Installation
description: Install Laravel Myanmar Payments via Composer. Requires PHP 8.1+ and Laravel 10 to 13. Auto-discovery registers the service provider and facade.
---

# Installation

## Install the Package

> **Requires** PHP 8.1+ and Laravel 10 to 13.

```bash
composer require laranex/laravel-myanmar-payments
```

Laravel's package auto-discovery registers the service provider and the `MyanmarPayments` facade (`Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments`). The facade resolves the `Laranex\LaravelMyanmarPayments\MyanmarPayments` singleton, which you can also inject into your own classes.

Only AYA Pay's and CyberSource's auto-submit form links use `APP_KEY` (they are encrypted with it); the other gateways work without one.

The package is a thin Laravel layer over [`laranex/php-myanmar-payments`](https://github.com/laranex/php-myanmar-payments), which Composer installs alongside it.

## Publish the Config

```bash
php artisan vendor:publish --tag="myanmar-payments-config"
```

This creates `config/myanmar-payments.php` (the `myanmar-payments` tag publishes the same file). Publishing is optional: every value is read from environment variables. See [Configuration](/laravel-myanmar-payments/configuration).

## What It Provides

| Class | What it is |
|---|---|
| `Facades\MyanmarPayments` | The facade: `kbzPay()`, `wavePay()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()`, `gateway($name)`, `gateways()`, `handleCallback($gateway, $request)`, `acknowledge($callback)` |
| `MyanmarPayments` | The singleton behind the facade, for constructor injection |
| `Gateways\KbzPay`, `WavePay`, `AyaPay`, `YomaMmqr`, `CyberSource` | The SDK gateways, extended to accept a Laravel `Request` in `handleCallback()` (and AYA's `verifyRedirect()`); AYA Pay and CyberSource also set `autoSubmitUrl` |
| `Http\CallbackResponse` | What `acknowledge()` returns: a `Responsable` with the gateway's acknowledgement |

All classes live under `Laranex\LaravelMyanmarPayments`. Everything about payments themselves (`Amount`, payment data, results, `PaymentCallback`, `PaymentStatus`, exceptions) comes from `Laranex\PhpMyanmarPayments`.
