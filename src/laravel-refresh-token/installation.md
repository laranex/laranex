---
title: Installation
description: Install Laravel Refresh Token, generate the encryption keys and run the migration.
---

# Installation

```bash
composer require laranex/laravel-refresh-token
```

Generate an RSA key pair for signing refresh tokens. The command writes `refresh-token-private.key` and `refresh-token-public.key` to the key path (`storage/` by default).

```bash
php artisan refresh-token:keys
```

| Option | Default | Description |
|---|---|---|
| `--force` | | Overwrite keys that already exist |
| `--length` | `4096` | Length of the private key |

::: warning
When the keys are not set in the environment, the package loads them from `oauth-private.key` and `oauth-public.key` in the key path, not from the file names the command writes. Until this is aligned, set `REFRESH_TOKEN_PRIVATE_KEY` and `REFRESH_TOKEN_PUBLIC_KEY` (see [Configuration](/laravel-refresh-token/configuration)) or rename the files.
:::

Run the migration. It creates the `laravel_refresh_tokens` table (configurable, see [Configuration](/laravel-refresh-token/configuration)).

```bash
php artisan migrate
```
