---
title: Installation
description: Install Laravel Biometric Auth, publish its config and run the migration.
---

# Installation

```bash
composer require laranex/laravel-biometric-auth
```

The `biometrics` table migration runs with your migrations. To customise it, publish it first:

```bash
php artisan vendor:publish --tag="biometric-auth-migrations"
php artisan migrate
```
