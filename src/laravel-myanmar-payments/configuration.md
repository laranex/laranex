---
title: Configuration
description: Configure Laravel Myanmar Payments with environment variables. Each gateway has a sandbox switch that selects its UAT endpoints; only the gateways you use need credentials.
---

# Configuration

## Environment Variables

Add only the keys of the gateways you use. A gateway is configured the first time you call it, and a missing credential throws a `ConfigurationException` naming the key.

Every gateway has a `*_SANDBOX` switch (default `true`) that selects its UAT endpoints. It accepts `true`, `1`, `t`, `yes`, `on` or `false`, `0`, `f`, `no`, `off` in any case; anything else keeps the sandbox. A `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` of zero or less falls back to `300`. Set it to `false` together with production credentials when you go live. The `*_BASE_URL` style variables are optional overrides.

```env
# KBZ Pay
KBZ_PAY_SANDBOX=true
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional API URL override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional PWA URL override

# Wave Money
WAVE_MONEY_SANDBOX=true
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=             # defaults to APP_NAME
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional
WAVE_MONEY_AUTHENTICATE_URL=          # optional customer redirect host override

# AYA Payment Gateway (AYA_PGW_* names are accepted as fallbacks)
AYA_PAY_SANDBOX=true
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional

# Yoma MMQR
YOMA_MMQR_SANDBOX=true
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
# optional, checks the X-Webhook-Secret header
YOMA_MMQR_WEBHOOK_SECRET=
YOMA_MMQR_BASE_URL=                   # optional override
YOMA_MMQR_API_VERSION=v1rc

# CyberSource Secure Acceptance
CYBER_SOURCE_SANDBOX=true
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional

# Package
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30
# store for Yoma access tokens, null = default store
MYANMAR_PAYMENTS_CACHE_STORE=
```

## Default Endpoints

| Gateway | Sandbox | Production |
|---|---|---|
| KBZ Pay API | `http://api-uat.kbzpay.com/payment/gateway/uat` | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://static.kbzpay.com/pgw/uat/pwa/#/` | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://preprodpayments.wavemoney.io:8107` | `https://payments.wavemoney.io` |
| Wave Money authenticate redirect | `https://preprodpayments.wavemoney.io` | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://uat-pgw.ayainnovation.com` | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://devapi.yomabank.net` | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://testsecureacceptance.cybersource.com` | `https://secureacceptance.cybersource.com` |

Overriding a base URL (e.g. to go through a proxy) does not switch the environment: keep `*_SANDBOX` in line with the credentials and host you use, so the other endpoints of that gateway (such as Wave's authenticate redirect or KBZ's PWA page) match.

## Config Structure

```php
return [
    'kbz_pay' => [
        'sandbox'       => env('KBZ_PAY_SANDBOX', true),
        'app_id'        => env('KBZ_PAY_APP_ID'),
        'app_key'       => env('KBZ_PAY_APP_KEY'),
        'merchant_code' => env('KBZ_PAY_MERCHANT_CODE'),
        'api_url'       => env('KBZ_PAY_BASE_URL'),
        'pwa_url'       => env('KBZ_PAY_PWA_BASE_REDIRECT_URL'),
    ],

    'wave_money' => [
        'sandbox'                 => env('WAVE_MONEY_SANDBOX', true),
        'merchant_id'             => env('WAVE_MONEY_MERCHANT_ID'),
        'secret_key'              => env('WAVE_MONEY_SECRET_KEY'),
        'merchant_name'           => env(
            'WAVE_MONEY_MERCHANT_NAME',
            env('APP_NAME'),
        ),
        'time_to_live_in_seconds' => env(
            'WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS',
            300,
        ),
        'base_url'                => env('WAVE_MONEY_BASE_URL'),
        'authenticate_url'        => env('WAVE_MONEY_AUTHENTICATE_URL'),
    ],

    'aya_pay' => [
        'sandbox'    => env('AYA_PAY_SANDBOX', true),
        'app_key'    => env('AYA_PAY_APP_KEY', env('AYA_PGW_APP_KEY')),
        'app_secret' => env('AYA_PAY_APP_SECRET', env('AYA_PGW_APP_SECRET')),
        'base_url'   => env('AYA_PAY_BASE_URL', env('AYA_PGW_BASE_URL')),
    ],

    'yoma_mmqr' => [
        'sandbox'         => env('YOMA_MMQR_SANDBOX', true),
        'merchant_id'     => env('YOMA_MMQR_MERCHANT_ID'),
        'client_id'       => env('YOMA_MMQR_CLIENT_ID'),
        'client_secret'   => env('YOMA_MMQR_CLIENT_SECRET'),
        'webhook_hashkey' => env('YOMA_MMQR_WEBHOOK_HASHKEY'),
        'webhook_secret'  => env('YOMA_MMQR_WEBHOOK_SECRET'),
        'base_url'        => env('YOMA_MMQR_BASE_URL'),
        'api_version'     => env('YOMA_MMQR_API_VERSION', 'v1rc'),
    ],

    'cyber_source' => [
        'sandbox'    => env('CYBER_SOURCE_SANDBOX', true),
        'profile_id' => env('CYBER_SOURCE_PROFILE_ID'),
        'access_key' => env('CYBER_SOURCE_ACCESS_KEY'),
        'secret_key' => env('CYBER_SOURCE_SECRET_KEY'),
        'base_url'   => env('CYBER_SOURCE_BASE_URL'),
    ],

    'http' => [
        'timeout' => env('MYANMAR_PAYMENTS_HTTP_TIMEOUT', 30),
    ],

    'cache_store' => env('MYANMAR_PAYMENTS_CACHE_STORE'),

    'form_route' => [
        'enabled'     => true,
        'path'        => 'myanmar-payments/form',
        'middleware'  => ['web'],
        'ttl_minutes' => 30,
    ],
];
```

## Auto-submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The package registers a `GET myanmar-payments/form` route (named `myanmar-payments.form`) that renders that form and submits it, and sets `FormPayment::$autoSubmitUrl` to an encrypted link to it. Links expire after `ttl_minutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store`.

Set `form_route.enabled` to `false` to drop the route and build the form yourself, see [Form Payments](/laravel-myanmar-payments/payment-flows#form-payments).

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. They are kept in your default cache store, or in `cache_store` when set. Use a shared store (Redis, database) when you run more than one server.
