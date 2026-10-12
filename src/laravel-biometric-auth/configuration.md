---
title: Configuration
description: Configure the biometrics table, the per-user device limit, challenge expiry and attempt limits, and RSA signature settings.
---

# Configuration

```bash
php artisan vendor:publish --tag="biometric-auth-config"
```

```php
return [
    'table' => env('BIOMETRIC_AUTH_TABLE', 'biometrics'),

    'max_per_user' => env('BIOMETRIC_AUTH_MAX_PER_USER', 10),

    'challenge' => [
        'ttl' => env('BIOMETRIC_AUTH_CHALLENGE_TTL', 300),
        'max_attempts' => env('BIOMETRIC_AUTH_CHALLENGE_MAX_ATTEMPTS', 5),
    ],

    'rsa' => [
        'encryption_padding' => 'pkcs1',
        'hash_algorithm' => 'sha256',
    ],
];
```

| Option | Default | Description |
|---|---|---|
| `table` | `biometrics` (`BIOMETRIC_AUTH_TABLE`) | Table that stores device public keys and pending challenges. The migration and the model both follow it |
| `max_per_user` | `10` (`BIOMETRIC_AUTH_MAX_PER_USER`) | Active (not revoked) biometrics one model may register. `createBiometric()` throws `TooManyBiometricsException` once the limit is reached, so a stolen session cannot enroll devices without bound. `0` or `null` allows any number |
| `challenge.ttl` | `300` (`BIOMETRIC_AUTH_CHALLENGE_TTL`) | Seconds a challenge stays valid after it was issued. An expired challenge is replaced by the next `getBiometric()` call and `verifyBiometric()` refuses it. `0` or `null` disables expiry |
| `challenge.max_attempts` | `5` (`BIOMETRIC_AUTH_CHALLENGE_MAX_ATTEMPTS`) | Failed verifications allowed per challenge. When the limit is reached the challenge is cleared and the client must request a new one. `0` or `null` disables the limit |
| `rsa.encryption_padding` | `pkcs1` | RSA signature padding: `pkcs1` (RSASSA-PKCS1-v1_5) or `pss` (RSASSA-PSS). phpseclib 3 also accepts `relaxed_pkcs1`, which tolerates malformed PKCS#1 signature encodings and is therefore weaker; use `pkcs1` or `pss` |
| `rsa.hash_algorithm` | `sha256` | RSA signature hash |

Failed attempts are counted in the application's default cache store, keyed by biometric and challenge, and kept for a day. Use a shared store (Redis, database, ...) when you run more than one server; with the `array` store the count does not survive between requests.

The `rsa` options apply to RSA keys only and must match how your mobile apps sign the challenge. EC and Ed25519 keys need no settings.

The padding name works on phpseclib 3 and 4. A raw `RSA::SIGNATURE_*` integer from the installed phpseclib is still accepted, but the values differ between the two majors. An unknown name throws `InvalidArgumentException` when a signature is verified.

## Accepted public keys

`createBiometric()` accepts only these key types, given as strict base64 of a PEM or DER key (see [phpseclib public keys](https://phpseclib.com/docs/publickeys) for the formats):

| Key type | Accepted |
|---|---|
| EC | P-256 and P-384 |
| Ed25519 | Yes |
| RSA | 2048 to 4096-bit modulus |

DSA keys, other curves, other RSA sizes, invalid base64 and values longer than 8192 characters throw `InvalidPublicKeyException`. The same check runs when a stored key is verified, so a device registered earlier with a weaker key (for example RSA 1024 or DSA) fails verification and must register again.
