---
title: Configuration
description: Configure Laravel Myanmar Payments with environment variables. Only sandbox base URLs and time_to_live_in_seconds have defaults — all credentials must be set explicitly.
---

# Configuration


## Environment Variables

Add only the keys relevant to the gateways you use.

```env
# KBZ Pay
KBZ_PAY_BASE_URL=http://api.kbzpay.com/payment/gateway/uat
KBZ_PAY_MERCHANT_NAME=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_PWA_BASE_REDIRECT_URL=https://static.kbzpay.com/pgw/uat/pwa/#

# Wave Money
WAVE_MONEY_BASE_URL=https://testpayments.wavemoney.io:8107
WAVE_MONEY_MERCHANT_NAME=
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300

# AYA PGW
AYA_PGW_BASE_URL=
AYA_PGW_APP_KEY=
AYA_PGW_APP_SECRET=

# CyberSource
CYBER_SOURCE_BASE_URL=
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
```

## Config Structure

```php
return [
    'kbz_pay' => [
        'base_url'      => env('KBZ_PAY_BASE_URL', 'http://api.kbzpay.com/payment/gateway/uat'),
        'merchant_name' => env('KBZ_PAY_MERCHANT_NAME'),
        'merchant_code' => env('KBZ_PAY_MERCHANT_CODE'),
        'app_id'        => env('KBZ_PAY_APP_ID'),
        'app_key'       => env('KBZ_PAY_APP_KEY'),
        'pwa' => [
            'base_redirect_url' => env('KBZ_PAY_PWA_BASE_REDIRECT_URL', 'https://static.kbzpay.com/pgw/uat/pwa/#'),
        ],
    ],

    'wave_money' => [
        'base_url'              => env('WAVE_MONEY_BASE_URL', 'https://testpayments.wavemoney.io:8107'),
        'merchant_name'         => env('WAVE_MONEY_MERCHANT_NAME'),
        'merchant_id'           => env('WAVE_MONEY_MERCHANT_ID'),
        'secret_key'            => env('WAVE_MONEY_SECRET_KEY'),
        'time_to_live_in_seconds' => env('WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS', 300),
    ],

    'aya_pgw' => [
        'base_url'   => env('AYA_PGW_BASE_URL'),
        'app_key'    => env('AYA_PGW_APP_KEY'),
        'app_secret' => env('AYA_PGW_APP_SECRET'),
    ],

    'cyber_source' => [
        'base_url'   => env('CYBER_SOURCE_BASE_URL'),
        'profile_id' => env('CYBER_SOURCE_PROFILE_ID'),
        'access_key' => env('CYBER_SOURCE_ACCESS_KEY'),
        'secret_key' => env('CYBER_SOURCE_SECRET_KEY'),
    ],
];
```

## Defaults

Only `base_url` values and `time_to_live_in_seconds` have default values (pointing to sandbox/UAT endpoints). All credential keys have no fallback — the application will fail fast if a required key is missing.

## No Default Driver

There is no default driver. You must always specify one:

```php
// Correct
MyanmarPayments::driver('kbzpay.pwa')->initiate($data);

// Throws InvalidArgumentException
MyanmarPayments::driver()->initiate($data);
```
