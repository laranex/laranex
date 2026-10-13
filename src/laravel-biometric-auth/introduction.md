---
title: Introduction
---

<PackageIntroduction />

## Why Laravel Biometric Auth

Signing in with Face ID or a fingerprint should not mean storing a password or a long-lived secret on the phone. With Laravel Biometric Auth the device keeps its private key, your API stores only the public key, and every sign-in is the device signing a fresh, one-time challenge.

- **The private key never leaves the device.** Your database holds public keys only, so a leaked table cannot be used to sign in.
- **Single-use, expiring challenges.** Each challenge is random, expires after 5 minutes by default and is cleared once verified, so a captured signature cannot be replayed, even when two requests race.
- **Guessing is capped.** A challenge is cleared after 5 failed signatures by default, and each user can enroll at most 10 devices.
- **Only strong keys.** EC P-256 and P-384, Ed25519 and 2048 to 4096-bit RSA, checked when a device enrolls and again at every verification.
- **One trait on your model.** `createBiometric()`, `revokeBiometric()` and `revokeAllBiometrics()` on any Eloquent model, with morph map support.
- **API-ready errors.** Unknown devices, missing challenges and rejected keys become JSON errors with a 404 or 422 status.
- **Your tokens, your choice.** Once `verifyBiometric()` returns `true`, issue whatever your API already uses, such as Sanctum or [Laravel Refresh Token](/laravel-refresh-token/introduction).

```php
use Laranex\LaravelBiometricAuth\Facades\LaravelBiometricAuth;

// Enroll: store the device's public key
$biometric = $user->createBiometric($publicKeyBase64);

// Sign in: hand out a challenge, then verify the device's signature
$challenge = LaravelBiometricAuth::getBiometric($biometric->id)->challenge;

LaravelBiometricAuth::verifyBiometric($biometric->id, $signatureBase64); // true or false
```
