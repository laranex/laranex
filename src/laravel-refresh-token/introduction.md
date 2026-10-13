---
title: Introduction
---

<PackageIntroduction />

## Why Laravel Refresh Token

Short-lived access tokens are safer, but nobody wants to sign in again every hour. A refresh token lets the client get a new access token without the password. Laravel Refresh Token issues refresh tokens as signed JWTs that are also stored in your database, so you can revoke any of them at any time.

- **Signed and stored.** Each token is an RS256 JWT, checked for its signature and its `iat`, `nbf` and `exp` claims, and backed by a database row, so revoking it takes effect immediately.
- **Rotation that survives races.** `revoke()` is one conditional update, so when two requests exchange the same token at once, only one of them wins.
- **Revoke everything at once.** `revokeRefreshTokens()` signs a model out everywhere after a password change, without needing a token.
- **Any Eloquent model.** Add the `HasRefreshTokens` trait to any model; tokens are stored with its morph class.
- **Keys from files or the environment.** `php artisan refresh-token:keys` writes an RSA key pair, or set the PEM contents in environment variables in production.
- **Housekeeping included.** `refresh-token:prune` deletes expired and revoked tokens in chunks, and a factory with `expired()` and `revoked()` states helps your tests.
- **Works with any access token.** It issues refresh tokens only, so pair it with Sanctum, Passport or your own access tokens.

```php
use Laranex\RefreshToken\RefreshToken;

$refreshToken = $user->createRefreshToken();

// Later, when the client sends it back
$token = RefreshToken::tokenable($refreshToken); // null when invalid, expired or revoked

abort_unless($token?->revoke(), 401);

return ['refresh_token' => $token->instance->createRefreshToken()];
```
