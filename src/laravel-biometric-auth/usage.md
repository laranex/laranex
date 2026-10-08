---
title: Usage
description: Register a device public key, issue a challenge, verify the signed challenge and revoke biometrics.
---

# Usage

## How it works

The private key never leaves the device. Your API stores only the public key and proves the device holds the private key by asking it to sign a one-time challenge.

<SequenceDiagram
  title="Registering a biometric (the user is already signed in)"
  :participants="['Mobile app', 'Your API']"
  :steps="[
    { from: 'Mobile app', to: 'Mobile app', label: 'Create a key pair', detail: 'private key stays on the device' },
    { from: 'Mobile app', to: 'Your API', label: 'Register the biometric', detail: 'base64 public key' },
    { from: 'Your API', to: 'Your API', label: 'Store the public key', detail: 'createBiometric($publicKey)' },
    { from: 'Your API', to: 'Mobile app', label: 'Biometric ID', response: true },
    { from: 'Mobile app', to: 'Mobile app', label: 'Save the private key and ID', detail: 'Keychain / Keystore' },
  ]"
/>

<SequenceDiagram
  title="Signing in with a biometric"
  :participants="['Mobile app', 'Your API']"
  :steps="[
    { from: 'Mobile app', to: 'Your API', label: 'Ask for a challenge', detail: 'biometric ID' },
    { from: 'Your API', to: 'Your API', label: 'Issue a challenge', detail: 'getBiometric($id)' },
    { from: 'Your API', to: 'Mobile app', label: 'Challenge', response: true },
    { from: 'Mobile app', to: 'Mobile app', label: 'Unlock with Face ID', detail: 'sign with the private key' },
    { from: 'Mobile app', to: 'Your API', label: 'Send the signature', detail: 'biometric ID + base64 signature' },
    { from: 'Your API', to: 'Your API', label: 'Verify the signature', detail: 'verifyBiometric($id, $signature)' },
    { from: 'Your API', to: 'Mobile app', label: 'Signed in', detail: 'issue your token; challenge used up', response: true },
  ]"
/>

## Preparing the model

```php
use Laranex\LaravelBiometricAuth\Traits\HasBiometrics;

class User extends Authenticatable
{
    use HasBiometrics;
}
```

Biometrics are stored with the model's morph class (`getMorphClass()`), so `Relation::morphMap()` aliases are respected.

## Registering a biometric

Store the device's base64-encoded public key (PEM or DER). Invalid keys throw `InvalidPublicKeyException`.

```php
$biometric = $user->createBiometric($publicKeyBase64);

$biometric->id; // UUID the device keeps
```

Every biometric of a model, revoked ones included, is available through the `biometrics()` morph-many relation. The `active()` scope keeps only biometrics that are not revoked:

```php
$user->biometrics()->active()->get();
```

The `public_key` attribute is hidden when a `Biometric` is serialized.

## Issuing a challenge

```php
use Laranex\LaravelBiometricAuth\Facades\LaravelBiometricAuth;

$biometric = LaravelBiometricAuth::getBiometric($biometricId);

$biometric->challenge; // the device signs this
```

The challenge is kept until it is verified, so calling `getBiometric()` twice before the device answers returns the same challenge.

## Verifying the signature

The device signs the challenge with its private key and sends the base64-encoded signature:

```php
use Laranex\LaravelBiometricAuth\Models\Biometric;

$verified = LaravelBiometricAuth::verifyBiometric($biometricId, $signatureBase64);

if ($verified) {
    $user = Biometric::find($biometricId)->instance; // the model that registered the biometric
}
```

Challenges are single-use: a successful verification clears the challenge, so a captured signature cannot be replayed. The next `getBiometric()` call issues a fresh one. A failed verification keeps the challenge so the device can retry, up to `challenge.max_attempts` failed attempts (5 by default, see [Configuration](/laravel-biometric-auth/configuration)); after that the challenge is cleared, `verifyBiometric()` throws `BiometricChallengeNotFoundException` and the client must call `getBiometric()` for a new one.

To resolve the service without the facade, use the container: `app(\Laranex\LaravelBiometricAuth\LaravelBiometricAuth::class)`.

## Revoking

Revoke one of the model's active biometrics so it can no longer be challenged or verified:

```php
$user->revokeBiometric($biometricId);
```

## Exceptions

All exceptions live in `Laranex\LaravelBiometricAuth\Exceptions`.

| Exception | HTTP status | Thrown when |
|---|---|---|
| `BiometricNotFoundException` | `404` | `getBiometric()` / `verifyBiometric()` get an unknown or revoked biometric, or `revokeBiometric()` gets a biometric that does not exist, is already revoked or belongs to another model |
| `BiometricChallengeNotFoundException` | `422` | `verifyBiometric()` is called with no pending challenge: none was issued, it was consumed by a successful verification, or it was cleared after too many failed attempts |
| `InvalidPublicKeyException` | `422` | `createBiometric()` or `verifyBiometric()` cannot load the public key |

They extend `Laranex\LaravelBiometricAuth\Exceptions\BiometricException`. The status is also the exception code (`getCode()`) and is returned by `getStatusCode()`; passing a custom 4xx/5xx code to the constructor overrides it.

The exceptions are [renderable](https://laravel.com/docs/errors#renderable-exceptions): when the request expects JSON (an API call with `Accept: application/json`), an uncaught exception becomes a JSON error with that status:

```json
{ "message": "Biometric not found" }
```

Other requests fall through to your application's exception handler. Catch the exceptions, or register your own renderer with `$exceptions->render()` (Laravel 11+) or `$this->renderable()` in the exception handler (Laravel 10), to change the response.
