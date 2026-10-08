---
title: Usage
description: Create, verify and revoke refresh tokens, and prune expired ones.
---

# Usage

## Preparing the model

Add the `HasRefreshTokens` trait to the model that owns refresh tokens:

```php
use Laranex\RefreshToken\Concerns\HasRefreshTokens;

class User extends Authenticatable
{
    use HasRefreshTokens;
}
```

Tokens are stored with the model's morph class (`getMorphClass()`), so `Relation::morphMap()` aliases are respected.

## Creating a refresh token

`createRefreshToken()` stores a token record and returns the signed RS256 JWT string to hand to the client:

```php
$refreshToken = $request->user()->createRefreshToken();
```

The model must be saved: calling it on an unsaved model throws a `LogicException`.

All tokens issued to a model are available through the `refreshTokens()` morph-many relation:

```php
$user->refreshTokens()->where('revoked', false)->count();
```

## Verifying a refresh token

`RefreshToken::tokenable()` verifies the signature and expiry and returns the stored token model, or `null` when the token is invalid, expired or revoked:

```php
use Laranex\RefreshToken\RefreshToken;

$token = RefreshToken::tokenable($request->input('refresh_token'));

if ($token === null) {
    abort(401);
}

$user = $token->instance; // the model that owns the token
```

Token timestamps use Carbon, so `Carbon::setTestNow()` and `travel()` apply in tests.

## Revoking

```php
$token->revoke();    // revoke this token
$token->revokeAll(); // revoke every token of the same owner, returns the number updated
```

To rotate a token, revoke the old one and issue a new one:

```php
$token->revoke();

return ['refresh_token' => $token->instance->createRefreshToken()];
```

## Pruning

Delete expired and revoked tokens. The command reports how many tokens it deleted.

```bash
php artisan refresh-token:prune
```

Or schedule it:

```php
Schedule::command('refresh-token:prune')->daily();
```

## Testing

The `Laranex\RefreshToken\Models\RefreshToken` model has a factory with `expired()` and `revoked()` states:

```php
use Laranex\RefreshToken\Models\RefreshToken;

RefreshToken::factory()->expired()->create();
RefreshToken::factory()->revoked()->create();
```

By default factory tokens belong to the configured user model (`auth.providers.users.model`, stored with its morph class) and a random id. Attach them to a real model through the `instance` relation:

```php
RefreshToken::factory()->for($user, 'instance')->create();
```
