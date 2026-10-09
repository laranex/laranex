---
title: Configuration
description: Configure Laravel Refresh Token keys, table, model, key path and expiry.
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
| `private_key` / `public_key` | Key contents (PEM). Literal `\n` sequences are expanded. When empty, `refresh-token-private.key` and `refresh-token-public.key` are read from the key path |
| `table` | Table that stores refresh tokens (used by the migration and the model) |

## Overriding defaults

Call these static methods on `Laranex\RefreshToken\RefreshToken` (or the `RefreshToken` facade), for example in a service provider's `boot` method:

| Method | Description |
|---|---|
| `useRefreshTokenModel(string $model)` | Use your own model for refresh tokens. It should extend `Laranex\RefreshToken\Models\RefreshToken` |
| `loadKeysFrom(string $path)` | Key path: where key files are read and written (default: `storage_path()`) |
| `refreshTokensExpireIn(DateTimeInterface $date)` | Set how long refresh tokens live, as the interval between now and `$date` (default: 1 year) |

```php
use Laranex\RefreshToken\RefreshToken;

RefreshToken::refreshTokensExpireIn(now()->addDays(30));
RefreshToken::loadKeysFrom(base_path('secrets'));
```

The date must be in the future. A past date, or the current moment, throws an `InvalidArgumentException` and keeps the previous lifetime, because every token issued with it would already be expired.

Called without an argument, `refreshTokensExpireIn()` returns the current lifetime as a `DateInterval`.

## Reading keys

| Method | Returns |
|---|---|
| `keyPath(string $file)` | Absolute path of `$file` in the key path |
| `keyContents('private'\|'public')` | The PEM key from config, or from `refresh-token-<type>.key` in the key path. Throws `MissingKeyException` when neither is set |
