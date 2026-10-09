---
title: Upgrading
description: Upgrade Laravel Refresh Token from v1 to v4. New namespaces, new key file names, keyContents() and a morph-aware owner type.
---

# Upgrading to v4 from v1

Versions 2.x and 3.x were skipped so every Laranex package shares the same major version.

## Requirements

PHP 8.1+ and Laravel 10 to 13.

```bash
composer require laranex/laravel-refresh-token:^4.0
```

The package no longer depends on `spatie/laravel-package-tools`, `league/oauth2-server`, `phpseclib/phpseclib`, `lcobucci/clock` or `nesbot/carbon`. Keys are generated with the OpenSSL extension and tokens use `lcobucci/jwt` ^5.

## Namespaces

| Before | After |
|---|---|
| `Laranex\RefreshToken\Traits\HasRefreshTokens` | `Laranex\RefreshToken\Concerns\HasRefreshTokens` |
| `Laranex\RefreshToken\Commands\KeysCommand` | `Laranex\RefreshToken\Console\Commands\KeysCommand` |
| `Laranex\RefreshToken\Commands\PruneCommand` | `Laranex\RefreshToken\Console\Commands\PruneCommand` |

## Key files

v1's `refresh-token:keys` wrote `refresh-token-private.key` / `refresh-token-public.key`, but tokens were signed and verified with `oauth-private.key` / `oauth-public.key`. v4 uses `refresh-token-*.key` everywhere.

- If you generated keys with `refresh-token:keys`, they are now used. Nothing to do.
- If you created `storage/oauth-private.key` and `storage/oauth-public.key` by hand, rename them to `storage/refresh-token-private.key` and `storage/refresh-token-public.key`, or set `REFRESH_TOKEN_PRIVATE_KEY` / `REFRESH_TOKEN_PUBLIC_KEY`.

Tokens issued before the rename keep verifying as long as the same key pair is used.

A missing or empty key now throws `Laranex\RefreshToken\Exceptions\MissingKeyException` instead of every token silently failing to verify.

`refresh-token:keys` now refuses key lengths below 2048 bits, creates a missing key directory, and exits with status `1` when a key cannot be written (v1 reported success anyway).

## Reading keys

`RefreshToken::makeCryptKey()` returned a `league/oauth2-server` `CryptKey`. It is replaced by `keyContents()`, which returns the PEM string:

```php
// Before
RefreshToken::makeCryptKey('public')->getKeyContents();

// After
RefreshToken::keyContents('public');
```

## Configuration

Remove any `model` key from a published `config/refresh-token.php`; it was never read. Swap the model in a service provider instead:

```php
RefreshToken::useRefreshTokenModel(MyRefreshToken::class);
```

## Morph map

Tokens are now stored with `getMorphClass()`. If your app uses `Relation::morphMap()`, tokens issued by v1 stored the full class name: update `refreshable_type` in the refresh tokens table to the alias, or revoke those tokens.

## Issuing for unsaved models

`createRefreshToken()` on a model without a key now throws a `LogicException`.

## Token lifetime

`RefreshToken::refreshTokensExpireIn()` now requires a date in the future. v1 accepted a past date, which made every newly issued token already expired; v4 throws an `InvalidArgumentException` for a past date or the current moment.

```php
RefreshToken::refreshTokensExpireIn(now()->addDays(30)); // OK
RefreshToken::refreshTokensExpireIn(now()->subDay());    // throws InvalidArgumentException
```

## Database

Existing tables keep working. New installs get `id` as the primary key and an index on `refreshable_type` + `refreshable_id`. To add them to an existing table, write a migration of your own:

```php
Schema::table('laravel_refresh_tokens', function (Blueprint $table) {
    $table->primary('id');
    $table->index(['refreshable_type', 'refreshable_id']);
});
```

The model now casts `revoked` to a boolean and `expires_at` to a date.

## New

- `HasRefreshTokens::refreshTokens()` morph-many relation.
- `expired()` and `revoked()` factory states; the factory's default `refreshable_type` follows the configured user model instead of a hard-coded `App\Models\User`.
- `refresh-token:prune` reports how many tokens it deleted.
- Token timestamps follow `Carbon::setTestNow()` and `travel()`.
- New `--tag="refresh-token"` publishes the config and the migration together (the existing `refresh-token-config` and `refresh-token-migrations` tags are unchanged).
