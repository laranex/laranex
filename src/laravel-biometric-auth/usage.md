---
title: Usage
description: Register a device public key, issue a challenge, verify the signed challenge and revoke biometrics.
---

# Usage

## Preparing the Model

```php
use Laranex\LaravelBiometricAuth\Traits\HasBiometrics;

class User extends Authenticatable
{
    use HasBiometrics;
}
```

## Registering a Biometric

Store the device's base64-encoded public key. Invalid keys throw `InvalidPublicKeyException`.

```php
$biometric = $user->createBiometric($publicKeyBase64);

$biometric->id; // UUID the device keeps
```

## Issuing a Challenge

```php
use Laranex\LaravelBiometricAuth\Facades\LaravelBiometricAuth;

$biometric = LaravelBiometricAuth::getBiometric($biometricId);

$biometric->challenge; // the device signs this
```

## Verifying the Signature

The device signs the challenge with its private key and sends the base64-encoded signature:

```php
$verified = LaravelBiometricAuth::verifyBiometric($biometricId, $signatureBase64);

$user = \Laranex\LaravelBiometricAuth\Models\Biometric::find($biometricId)->instance;
```

`getBiometric()` and `verifyBiometric()` throw `BiometricNotFoundException` for unknown or revoked biometrics; `verifyBiometric()` throws `BiometricChallengeNotFoundException` when no challenge was issued.

## Revoking

```php
$user->revokeBiometric($biometricId);
```
