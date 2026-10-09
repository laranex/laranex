---
title: Configuration
description: Configure the biometrics table, challenge expiry and attempt limits, and RSA signature settings.
---

# Configuration

```bash
php artisan vendor:publish --tag="biometric-auth-config"
```

```php
return [
    'table' => env('BIOMETRIC_AUTH_TABLE', 'biometrics'),

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
| `challenge.ttl` | `300` (`BIOMETRIC_AUTH_CHALLENGE_TTL`) | Seconds a challenge stays valid after it was issued. An expired challenge is replaced by the next `getBiometric()` call and `verifyBiometric()` refuses it. `0` or `null` disables expiry |
| `challenge.max_attempts` | `5` (`BIOMETRIC_AUTH_CHALLENGE_MAX_ATTEMPTS`) | Failed verifications allowed per challenge. When the limit is reached the challenge is cleared and the client must request a new one. `0` or `null` disables the limit |
| `rsa.encryption_padding` | `pkcs1` | RSA signature padding: `pkcs1` (RSASSA-PKCS1-v1_5) or `pss` (RSASSA-PSS). `relaxed_pkcs1` works on phpseclib 3 only |
| `rsa.hash_algorithm` | `sha256` | RSA signature hash |

Failed attempts are counted in the application's default cache store, keyed by biometric and challenge, and kept for a day. Use a shared store (Redis, database, ...) when you run more than one server; with the `array` store the count does not survive between requests.

The `rsa` options apply to RSA keys only and must match how your mobile apps sign the challenge. Other key types (EC, Ed25519, DSA) are detected automatically by phpseclib.

The padding name works on phpseclib 3 and 4. A raw `RSA::SIGNATURE_*` integer from the installed phpseclib is still accepted, but the values differ between the two majors. An unknown name throws `InvalidArgumentException` when a signature is verified.

Supported public key formats: [phpseclib public keys](https://phpseclib.com/docs/publickeys).
