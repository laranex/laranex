---
title: Installation
description: Install Laravel Refresh Token, generate the RSA keys and run the migration.
---

# Installation

```bash
composer require laranex/laravel-refresh-token
```

The service provider and the `RefreshToken` facade alias are registered automatically.

## Keys

Generate an RSA key pair for signing refresh tokens. The command writes `refresh-token-private.key` (with `0600` permissions) and `refresh-token-public.key` to the key path (`storage/` by default, see [Configuration](/laravel-refresh-token/configuration)).

```bash
php artisan refresh-token:keys
```

| Option | Default | Description |
|---|---|---|
| `--force` | | Overwrite keys that already exist |
| `--length` | `4096` | Length of the private key in bits (at least `2048`) |

The command creates the key directory if it does not exist. If the directory or either key file cannot be written it prints the path and exits with status `1`, so a deploy script fails instead of continuing without keys.

In production you can set the PEM contents in `REFRESH_TOKEN_PRIVATE_KEY` and `REFRESH_TOKEN_PUBLIC_KEY` instead of shipping key files. Literal `\n` sequences are expanded to newlines.

When neither the environment variable nor the key file is available, issuing or verifying a token throws `Laranex\RefreshToken\Exceptions\MissingKeyException`, which names the file it expected.

## Migration

The package loads its migration automatically. Run it to create the `laravel_refresh_tokens` table (the name is configurable, see [Configuration](/laravel-refresh-token/configuration)):

```bash
php artisan migrate
```

To customize the migration, publish it first:

```bash
php artisan vendor:publish --tag="refresh-token-migrations"
```

| Tag | Publishes |
|---|---|
| `refresh-token-config` | `config/refresh-token.php` |
| `refresh-token-migrations` | `database/migrations/*_create_laravel_refresh_tokens_table.php` |
| `refresh-token` | Both |
