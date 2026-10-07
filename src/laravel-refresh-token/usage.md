---
title: Usage
description: Create, verify and revoke refresh tokens, and prune expired ones.
---

# Usage

## Preparing the Model

Add the `HasRefreshTokens` trait to the model that owns refresh tokens:

```php
use Laranex\RefreshToken\Traits\HasRefreshTokens;

class User extends Authenticatable
{
    use HasRefreshTokens;
}
```

## Creating a Refresh Token

`createRefreshToken()` stores a token record and returns the signed JWT string to hand to the client:

```php
$refreshToken = $request->user()->createRefreshToken();
```

## Verifying a Refresh Token

`RefreshToken::tokenable()` verifies the signature and expiry and returns the stored token model, or `null` when the token is invalid, expired or revoked:

```php
use Laranex\RefreshToken\RefreshToken;

$token = RefreshToken::tokenable($request->input('refresh_token'));

if (! $token) {
    // invalid refresh token
}

$user = $token->instance; // the model that owns the token
```

## Revoking

```php
$token->revoke();    // revoke this token
$token->revokeAll(); // revoke every token of the same owner
```

## Pruning

Delete expired and revoked tokens:

```bash
php artisan refresh-token:prune
```

Or schedule it:

```php
Schedule::command('refresh-token:prune')->daily();
```
