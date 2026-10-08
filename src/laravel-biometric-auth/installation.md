---
title: Installation
description: Install Laravel Biometric Auth, publish its config and run the migration.
---

# Installation

```bash
composer require laranex/laravel-biometric-auth
```

The service provider and the `LaravelBiometricAuth` facade alias are registered automatically. phpseclib 3 (3.0.57+) and phpseclib 4 are both supported.

## Migration

The package loads its migration automatically. Run it to create the `biometrics` table (the name is configurable, see [Configuration](/laravel-biometric-auth/configuration)):

```bash
php artisan migrate
```

To customize the migration, publish it first. Once a `*_create_biometrics_table.php` migration exists in your app, the package stops loading its own copy, so the table is never created twice. Publishing again reuses the published file.

```bash
php artisan vendor:publish --tag="biometric-auth-migrations"
php artisan migrate
```

| Tag | Publishes |
|---|---|
| `biometric-auth-config` | `config/biometric-auth.php` |
| `biometric-auth-migrations` | `database/migrations/*_create_biometrics_table.php` |
| `biometric-auth` | Both |
