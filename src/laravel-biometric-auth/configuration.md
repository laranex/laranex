---
title: Configuration
description: Configure the biometrics table and RSA verification settings.
---

# Configuration

```bash
php artisan vendor:publish --tag="biometric-auth-config"
```

```php
return [
    'table' => env('BIOMETRIC_AUTH_TABLE', 'biometrics'),

    'rsa' => [
        'encryption_padding' => \phpseclib3\Crypt\RSA::SIGNATURE_PKCS1,
        'hash_algorithm' => 'sha256',
    ],
];
```

| Option | Description |
|---|---|
| `table` | Table that stores biometric public keys |
| `rsa.encryption_padding`, `rsa.hash_algorithm` | Used for RSA keys only. Other key types are detected automatically by phpseclib |

Supported public key formats: [phpseclib public keys](https://phpseclib.com/docs/publickeys).
