---
title: Usage
description: Create, verify and revoke refresh tokens, and prune expired ones.
---

# Usage

## How it works

Your API hands the client a short-lived access token together with a long-lived refresh token. When the access token expires, the client exchanges the refresh token for a new pair, and the old refresh token is revoked so it can be used only once.

<SequenceDiagram
  title="Signing in"
  :participants="['Client', 'Your API']"
  :steps="[
    { from: 'Client', to: 'Your API', label: 'Sign in', detail: 'credentials' },
    { from: 'Your API', to: 'Your API', label: 'Issue a refresh token', detail: '$user->createRefreshToken()' },
    { from: 'Your API', to: 'Client', label: 'Access token + refresh token', response: true },
  ]"
/>

<SequenceDiagram
  title="Rotating a refresh token"
  :participants="['Client', 'Your API']"
  :steps="[
    { from: 'Client', to: 'Your API', label: 'Refresh', detail: 'refresh token' },
    { from: 'Your API', to: 'Your API', label: 'Verify the token', detail: 'RefreshToken::tokenable($jwt)' },
    { from: 'Your API', to: 'Your API', label: 'Revoke it', detail: '$token->revoke(), 401 when false' },
    { from: 'Your API', to: 'Your API', label: 'Issue a new one', detail: '$token->instance->createRefreshToken()' },
    { from: 'Your API', to: 'Client', label: 'New access token + refresh token', response: true },
  ]"
/>

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

`RefreshToken::tokenable()` verifies the RS256 signature and the token's `iat`, `nbf` and `exp` claims, then looks up the stored row by the token id (`jti`). It returns the stored token model, or `null` when the token is malformed, tampered with, signed with another key, expired (by its claims or by the row's `expires_at`), revoked or no longer stored:

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
// revoke this token, returns true when this call revoked it
$token->revoke();

// revoke every token of the same owner, returns the number updated
$token->revokeAll();
```

`revoke()` is a single conditional `UPDATE` that only matches a token that is still active. It returns `false` when the token was already revoked, for example by another request that verified the same token a moment earlier.

To rotate a token, revoke the old one and issue a new one. Reject the request when `revoke()` returns `false`, so a token can be exchanged only once even when two requests race:

```php
abort_unless($token->revoke(), 401);

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
