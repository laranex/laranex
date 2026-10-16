---
title: Configuration
description: Configure Laravel Myanmar Payments with environment variables. Every setting of the gateways you use is required except the HTTP timeout (30 seconds by default), URLs and time to live included.
---

# Configuration

## Environment Variables

Add the keys of the gateways you use. Every setting of those gateways is required and has no default, except the HTTP timeout (30 seconds by default): that includes the URLs, the time to live (`KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` and `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS`) and Yoma's webhook secret. A gateway is configured the first time you call it, and a missing or blank setting throws a `ConfigurationException` naming it, e.g. `The kbz_pay configuration is missing [app_key].`

```env
# optional, every gateway that calls an API (all but CyberSource), defaults to 30 seconds
# MYANMAR_PAYMENTS_HTTP_TIMEOUT=30
# AYA Pay and CyberSource, while the form route is enabled
MYANMAR_PAYMENTS_FORM_TTL_MINUTES=30
# optional, store for Yoma access tokens, empty = default store
MYANMAR_PAYMENTS_CACHE_STORE=

# KBZ Pay
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=
KBZ_PAY_PWA_BASE_REDIRECT_URL=
KBZ_PAY_TIME_TO_LIVE_IN_MINUTES=15    # 1 to 120

# Wave Pay
WAVE_PAY_MERCHANT_ID=
WAVE_PAY_SECRET_KEY=
WAVE_PAY_MERCHANT_NAME=
WAVE_PAY_BASE_URL=
WAVE_PAY_BASE_REDIRECT_URL=
WAVE_PAY_TIME_TO_LIVE_IN_SECONDS=900   # greater than 0

# AYA Payment Gateway
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=

# Yoma MMQR
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_API_VERSION=v1rc
YOMA_MMQR_WEBHOOK_SECRET=             # every callback carries it in X-Webhook-Secret
YOMA_MMQR_BASE_URL=

# CyberSource Secure Acceptance
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=
```

## Settings

| Variable | Config key | Required | Description |
|---|---|---|---|
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `http.timeout` | No | Seconds before a gateway call gives up, 30 by default. Given to every gateway except CyberSource as its `timeout_in_seconds` |
| `MYANMAR_PAYMENTS_FORM_TTL_MINUTES` | `form_route.ttl_minutes` | Yes | Minutes an auto-submit form link stays valid. Needed by AYA Pay and CyberSource while the form route is enabled |
| `MYANMAR_PAYMENTS_CACHE_STORE` | `cache_store` | No | Cache store for Yoma MMQR access tokens; empty means the default store |
| `KBZ_PAY_APP_ID` | `kbz_pay.app_id` | Yes | `appid` issued by KBZ |
| `KBZ_PAY_APP_KEY` | `kbz_pay.app_key` | Yes | Secret key used to sign requests |
| `KBZ_PAY_MERCHANT_CODE` | `kbz_pay.merchant_code` | Yes | `merch_code` issued by KBZ |
| `KBZ_PAY_BASE_URL` | `kbz_pay.api_url` | Yes | The API base URL |
| `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbz_pay.pwa_url` | Yes | The PWA checkout URL |
| `KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` | `kbz_pay.time_to_live_in_minutes` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment can override it with `KbzPayPaymentData`'s `timeToLiveMinutes` |
| `WAVE_PAY_MERCHANT_ID` | `wave_pay.merchant_id` | Yes | Merchant ID issued by Wave |
| `WAVE_PAY_SECRET_KEY` | `wave_pay.secret_key` | Yes | Hash secret key issued by Wave |
| `WAVE_PAY_MERCHANT_NAME` | `wave_pay.merchant_name` | Yes | Shown on Wave's payment page. A payment can override it with `WavePayPaymentData`'s `merchantName` |
| `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS` | `wave_pay.time_to_live_in_seconds` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WavePayPaymentData`'s `timeToLiveSeconds` |
| `WAVE_PAY_BASE_URL` | `wave_pay.base_url` | Yes | The API base URL. Payments are requested at its `/payment` |
| `WAVE_PAY_BASE_REDIRECT_URL` | `wave_pay.base_redirect_url` | Yes | The host the customer is sent to. The customer approves the payment at its `/authenticate` |
| `AYA_PAY_APP_KEY` | `aya_pay.app_key` | Yes | Public application key |
| `AYA_PAY_APP_SECRET` | `aya_pay.app_secret` | Yes | Secret used for checksums |
| `AYA_PAY_BASE_URL` | `aya_pay.base_url` | Yes | The gateway base URL |
| `YOMA_MMQR_MERCHANT_ID` | `yoma_mmqr.merchant_id` | Yes | Merchant ID issued by Yoma |
| `YOMA_MMQR_CLIENT_ID` | `yoma_mmqr.client_id` | Yes | OAuth client ID |
| `YOMA_MMQR_CLIENT_SECRET` | `yoma_mmqr.client_secret` | Yes | OAuth client secret |
| `YOMA_MMQR_WEBHOOK_HASHKEY` | `yoma_mmqr.webhook_hashkey` | Yes | Hash key issued by Yoma for verifying callbacks |
| `YOMA_MMQR_API_VERSION` | `yoma_mmqr.api_version` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `YOMA_MMQR_WEBHOOK_SECRET` | `yoma_mmqr.webhook_secret` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `YOMA_MMQR_BASE_URL` | `yoma_mmqr.base_url` | Yes | The API base URL |
| `CYBER_SOURCE_PROFILE_ID` | `cyber_source.profile_id` | Yes | Secure Acceptance profile ID |
| `CYBER_SOURCE_ACCESS_KEY` | `cyber_source.access_key` | Yes | Profile access key |
| `CYBER_SOURCE_SECRET_KEY` | `cyber_source.secret_key` | Yes | Profile secret key used to sign fields |
| `CYBER_SOURCE_BASE_URL` | `cyber_source.base_url` | Yes | The Secure Acceptance base URL |

## Production Endpoints

```env
KBZ_PAY_BASE_URL=https://api.kbzpay.com/payment/gateway
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://wap.kbzpay.com/pgw/pwa/#/"
WAVE_PAY_BASE_URL=https://payments.wavemoney.io
WAVE_PAY_BASE_REDIRECT_URL=https://payments.wavemoney.io
AYA_PAY_BASE_URL=https://pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://paymenthubapi.yomabank.com
CYBER_SOURCE_BASE_URL=https://secureacceptance.cybersource.com
```

## UAT Endpoints

```env
KBZ_PAY_BASE_URL=http://api-uat.kbzpay.com/payment/gateway/uat
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://static.kbzpay.com/pgw/uat/pwa/#/"
WAVE_PAY_BASE_URL=https://preprodpayments.wavemoney.io:8107
WAVE_PAY_BASE_REDIRECT_URL=https://preprodpayments.wavemoney.io:8107
AYA_PAY_BASE_URL=https://uat-pgw.ayainnovation.com
YOMA_MMQR_BASE_URL=https://devapi.yomabank.net
CYBER_SOURCE_BASE_URL=https://testsecureacceptance.cybersource.com
```

## Config Structure

Publish it only to change it (see [Installation](/laravel-myanmar-payments/installation#publish-the-config)):

```php
return [
    'kbz_pay' => [
        'app_id' => env('KBZ_PAY_APP_ID'),
        'app_key' => env('KBZ_PAY_APP_KEY'),
        'merchant_code' => env('KBZ_PAY_MERCHANT_CODE'),
        'api_url' => env('KBZ_PAY_BASE_URL'),
        'pwa_url' => env('KBZ_PAY_PWA_BASE_REDIRECT_URL'),
        'time_to_live_in_minutes' => env('KBZ_PAY_TIME_TO_LIVE_IN_MINUTES'),
    ],

    'wave_pay' => [
        'merchant_id' => env('WAVE_PAY_MERCHANT_ID'),
        'secret_key' => env('WAVE_PAY_SECRET_KEY'),
        'merchant_name' => env('WAVE_PAY_MERCHANT_NAME'),
        'time_to_live_in_seconds' => env('WAVE_PAY_TIME_TO_LIVE_IN_SECONDS'),
        'base_url' => env('WAVE_PAY_BASE_URL'),
        'base_redirect_url' => env('WAVE_PAY_BASE_REDIRECT_URL'),
    ],

    'aya_pay' => [
        'app_key' => env('AYA_PAY_APP_KEY'),
        'app_secret' => env('AYA_PAY_APP_SECRET'),
        'base_url' => env('AYA_PAY_BASE_URL'),
    ],

    'yoma_mmqr' => [
        'merchant_id' => env('YOMA_MMQR_MERCHANT_ID'),
        'client_id' => env('YOMA_MMQR_CLIENT_ID'),
        'client_secret' => env('YOMA_MMQR_CLIENT_SECRET'),
        'webhook_hashkey' => env('YOMA_MMQR_WEBHOOK_HASHKEY'),
        'webhook_secret' => env('YOMA_MMQR_WEBHOOK_SECRET'),
        'base_url' => env('YOMA_MMQR_BASE_URL'),
        'api_version' => env('YOMA_MMQR_API_VERSION'),
    ],

    'cyber_source' => [
        'profile_id' => env('CYBER_SOURCE_PROFILE_ID'),
        'access_key' => env('CYBER_SOURCE_ACCESS_KEY'),
        'secret_key' => env('CYBER_SOURCE_SECRET_KEY'),
        'base_url' => env('CYBER_SOURCE_BASE_URL'),
    ],

    'http' => [
        'timeout' => env('MYANMAR_PAYMENTS_HTTP_TIMEOUT', 30),
    ],

    'cache_store' => env('MYANMAR_PAYMENTS_CACHE_STORE'),

    'form_route' => [
        'enabled' => true,
        'path' => 'myanmar-payments/form',
        'middleware' => [],
        'ttl_minutes' => env('MYANMAR_PAYMENTS_FORM_TTL_MINUTES'),
    ],
];
```

The time settings take an `int` or integer text such as `'30'`. Without the env variables, set the values in the published file instead, e.g. `'timeout' => 45`.

## HTTP Client

`timeout` is in seconds, applies to gateway calls only and defaults to 30: the package passes it to KBZ Pay, Wave Pay, AYA and Yoma MMQR as their `timeout_in_seconds`, and a null or blank one also means 30 seconds. To give one gateway its own timeout, set `timeout_in_seconds` in its array, e.g. `'kbz_pay' => [..., 'timeout_in_seconds' => 10]`. Redirects are returned as they are, never followed.

## Auto-submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The package registers a `GET myanmar-payments/form` route (named `myanmar-payments.form`) that renders that form and submits it, and sets `FormPayment::$autoSubmitUrl` to an encrypted link to it. Links expire after `ttl_minutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store` and `Referrer-Policy: strict-origin`, so the gateway sees only your origin, never the encrypted link. It needs no session or cookies, so the route runs without middleware by default. When your app sets a Content-Security-Policy nonce with `Vite::useCspNonce()`, the page's inline script carries it.

| Key | Meaning |
|---|---|
| `enabled` | Register the route. When `false`, `autoSubmitUrl` is `null`; build the form yourself, see [Form Payments](/laravel-myanmar-payments/payment-flows#form-payments) |
| `path` | The route path |
| `middleware` | Middleware for the route, `[]` by default, e.g. `['throttle:60,1']` or the middleware that calls `Vite::useCspNonce()`. Don't add authentication: the customer may arrive from a gateway or another device |
| `ttl_minutes` | Minutes a link stays valid. Required while the route is enabled: AYA Pay and CyberSource throw `The form_route configuration is missing [ttl_minutes].` without it, or `The form_route configuration [ttl_minutes] must be a whole number greater than 0.` for an invalid value |

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. They are kept in your default cache store, or in `cache_store` when set. Use a shared store (Redis, database) when you run more than one server.
