---
title: Installation
description: Install Laravel Myanmar Payments via Composer. Requires PHP 8.1+ and Laravel 10 or higher. Auto-discovery registers the service provider and facade.
---

# Installation


## Via Composer

> **Requires** PHP 8.1+ and Laravel 10+

```bash
composer require laranex/laravel-myanmar-payments
```

Laravel's package auto-discovery will register the service provider and `MyanmarPayments` facade automatically.

## Publish Config

```bash
php artisan vendor:publish --tag="myanmar-payments-config"
```

This creates `config/myanmar-payments.php`. You only need to publish if you want to inspect or override the config structure — all values are read from environment variables.
