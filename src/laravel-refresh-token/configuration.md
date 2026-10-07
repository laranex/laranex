---
title: Configuration
description: Configure Laravel Refresh Token keys, table and expiry.
---

# Configuration

Publishing the config file is optional:

```bash
php artisan vendor:publish --tag="refresh-token-config"
```

```php
return [
    'private_key' => env('REFRESH_TOKEN_PRIVATE_KEY'),
    'public_key' => env('REFRESH_TOKEN_PUBLIC_KEY'),
    'table' => 'laravel_refresh_tokens',
];
```

| Option | Description |
|---|---|
| `private_key` / `public_key` | Key contents (PEM). When empty, `oauth-private.key` and `oauth-public.key` are read from the key path |
| `table` | Table that stores refresh tokens |

## Overriding Defaults

Call these static methods on `Laranex\RefreshToken\RefreshToken`, for example in a service provider's `boot` method:

| Method | Description |
|---|---|
| `useRefreshTokenModel(string $model)` | Use your own model for refresh tokens |
| `loadKeysFrom(string $path)` | Key path: where key files are read and written (default: `storage_path()`) |
| `refreshTokensExpireIn(DateTimeInterface $date)` | Set how long refresh tokens live (default: 1 year) |

```php
use Laranex\RefreshToken\RefreshToken;

RefreshToken::refreshTokensExpireIn(now()->addDays(30));
```
