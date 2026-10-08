---
title: Upgrading
description: Upgrade Laravel Biometric Auth from v3 to v4. Padding names for phpseclib 3 and 4, single-use challenges and a typed revoke failure.
---

# Upgrading to v4 from v3

## Requirements

PHP 8.1+ and Laravel 10 to 13. Laravel 9 is no longer supported.

```bash
composer require laranex/laravel-biometric-auth:^4.0
```

The package no longer depends on `spatie/laravel-package-tools`. The publish tags `biometric-auth-config` and `biometric-auth-migrations` are unchanged, and the new `biometric-auth` tag publishes both.

## Database

No database changes: the `biometrics` table and its columns are unchanged. If you published the migration under v3, keep it. The package detects a published `*_create_biometrics_table.php` and no longer loads its own copy; without one, the package migration now runs automatically.

## RSA padding

phpseclib 4 is supported alongside phpseclib 3. phpseclib 4 moved to the `phpseclib4` namespace and renumbered the RSA signature constants, so `rsa.encryption_padding` now takes a name. If you published `config/biometric-auth.php`, update it:

```php
// Before
'encryption_padding' => \phpseclib3\Crypt\RSA::SIGNATURE_PKCS1,

// After
'encryption_padding' => 'pkcs1', // or 'pss'
```

The old constant keeps working while you stay on phpseclib 3, but it is a fatal error on phpseclib 4 (the class no longer exists). Unknown names throw `InvalidArgumentException`.

## Single-use challenges

`verifyBiometric()` now clears the challenge after a successful verification, so a captured signature cannot be replayed. Clients must request a new challenge with `getBiometric()` after every successful verification. Failed attempts keep the challenge so the device can retry, up to `challenge.max_attempts` (5 by default, `BIOMETRIC_AUTH_CHALLENGE_MAX_ATTEMPTS`); then the challenge is cleared and the client must request a new one. Attempts are counted in the default cache store. Set the option to `0` to keep v3's unlimited retries.

## Revoking

`revokeBiometric()` throws `BiometricNotFoundException` when the biometric does not exist, is already revoked or belongs to another model. It previously failed with a PHP error on `null`. Catch the exception where you previously checked for a failure:

```php
use Laranex\LaravelBiometricAuth\Exceptions\BiometricNotFoundException;

try {
    $user->revokeBiometric($biometricId);
} catch (BiometricNotFoundException) {
    abort(404);
}
```

## Service class

`LaravelBiometricAuth` now takes the config repository through its constructor. If you create it with `new`, resolve it instead:

```php
app(\Laranex\LaravelBiometricAuth\LaravelBiometricAuth::class);
```

The `LaravelBiometricAuth` facade works as before.

## Exceptions

The exceptions extend the new `BiometricException` base class and their constructors are typed: `string $message`, `?int $code`, `?Throwable $previous`.

The default code is now an HTTP status instead of `500`: `404` for `BiometricNotFoundException`, `422` for `BiometricChallengeNotFoundException` and `InvalidPublicKeyException`. They are renderable, so an uncaught exception in a JSON request returns `{"message": "..."}` with that status instead of a `500` server error. If you relied on the `500` code or response, catch the exceptions yourself. See [Exceptions](/laravel-biometric-auth/usage#exceptions).

## Morph map

`authenticable_type` is now stored through `getMorphClass()`. If your app uses a morph map, new rows store the alias instead of the class name. Existing rows with the class name keep resolving through the `instance` relation.

## New

- `HasBiometrics::biometrics()` morph-many relation.
- `Biometric::active()` scope.
- The migration and the model read the table name from `biometric-auth.table`.
