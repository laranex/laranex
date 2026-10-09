---
title: Configuration
description: Configure PHP Myanmar Payments with typed config objects or one configuration array. Each gateway has a sandbox switch; inject your own PSR-18 client and PSR-16 cache.
---

# Configuration

Each gateway is built from a typed config object. Only the gateways you use need credentials.

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;

$kbzPay = new KbzPay(new KbzPayConfig(
    appId: getenv('KBZ_PAY_APP_ID'),
    appKey: getenv('KBZ_PAY_APP_KEY'),
    merchantCode: getenv('KBZ_PAY_MERCHANT_CODE'),
    sandbox: true,
));
```

Every config has a `sandbox` flag (default `true`) that selects the gateway's UAT endpoints. Set it to `false` together with production credentials when you go live. URL parameters are optional overrides.

## Config Classes

### KbzPayConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `appId` | `string` | | The `appid` KBZ issued for your merchant app |
| `appKey` | `string` | | The secret key used to sign requests |
| `merchantCode` | `string` | | The `merch_code` KBZ issued |
| `sandbox` | `bool` | `true` | Use the UAT endpoints |
| `apiUrl` | `?string` | per `sandbox` | Override the API base URL, e.g. a proxy |
| `pwaUrl` | `?string` | per `sandbox` | Override the PWA checkout URL. A trailing `#` or `#/` is normalized to `#/` |

### WaveMoneyConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `merchantId` | `string` | | The merchant id Wave issued |
| `secretKey` | `string` | | The hash secret key Wave issued |
| `merchantName` | `string` | | Your business name, shown on Wave's payment page |
| `timeToLiveSeconds` | `int` | `300` | How long the customer has to pay. Zero or less falls back to `300` |
| `sandbox` | `bool` | `true` | Use the test environment |
| `baseUrl` | `?string` | per `sandbox` | Override the API base URL |
| `authenticateUrl` | `?string` | per `sandbox` | Override the host the customer is redirected to (`https://preprodpayments.wavemoney.io` / `https://payments.wavemoney.io`, without the API port) |

### AyaPayConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `appKey` | `string` | | The public application key |
| `appSecret` | `string` | | The secret used to sign requests and verify callbacks |
| `sandbox` | `bool` | `true` | Use the UAT environment |
| `baseUrl` | `?string` | per `sandbox` | Override the gateway base URL |

### YomaMmqrConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `merchantId` | `string` | | The merchant id Yoma issued |
| `clientId` | `string` | | OAuth client id |
| `clientSecret` | `string` | | OAuth client secret |
| `webhookHashKey` | `string` | | The hash key Yoma issued for verifying callbacks |
| `webhookSecret` | `?string` | `null` | When set, callbacks must carry it in `X-Webhook-Secret` |
| `sandbox` | `bool` | `true` | Use the UAT environment |
| `baseUrl` | `?string` | per `sandbox` | Override the API base URL |
| `apiVersion` | `string` | `v1rc` | The `{version}` segment of the API paths |

### CyberSourceConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `profileId` | `string` | | The Secure Acceptance profile id |
| `accessKey` | `string` | | The profile's access key |
| `secretKey` | `string` | | The profile's secret key, used to sign fields |
| `sandbox` | `bool` | `true` | Use the test environment |
| `baseUrl` | `?string` | per `sandbox` | Override the Secure Acceptance base URL |

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

The URLs are also available as constants, e.g. `KbzPayConfig::SANDBOX_API_URL`, `WaveMoneyConfig::PRODUCTION_URL`.

## From an Array

Every config class has `fromArray()`, which reads snake_case keys. It is convenient when credentials come from a config file or environment.

```php
$config = KbzPayConfig::fromArray([
    'app_id' => getenv('KBZ_PAY_APP_ID'),
    'app_key' => getenv('KBZ_PAY_APP_KEY'),
    'merchant_code' => getenv('KBZ_PAY_MERCHANT_CODE'),
    // "true"/"false" strings are accepted
    'sandbox' => getenv('KBZ_PAY_SANDBOX'),
]);
```

`sandbox` accepts booleans and the strings `true`, `1`, `t`, `yes`, `on` or `false`, `0`, `f`, `no`, `off` in any case. Anything else, including an empty or missing value, keeps the sandbox.

| Config class | Keys |
|---|---|
| `KbzPayConfig` | `app_id`, `app_key`, `merchant_code`, `sandbox`, `api_url`, `pwa_url` |
| `WaveMoneyConfig` | `merchant_id`, `secret_key`, `merchant_name`, `time_to_live_in_seconds`, `sandbox`, `base_url`, `authenticate_url` |
| `AyaPayConfig` | `app_key`, `app_secret`, `sandbox`, `base_url` |
| `YomaMmqrConfig` | `merchant_id`, `client_id`, `client_secret`, `webhook_hashkey`, `webhook_secret`, `sandbox`, `base_url`, `api_version` |
| `CyberSourceConfig` | `profile_id`, `access_key`, `secret_key`, `sandbox`, `base_url` |

A missing required key throws `ConfigurationException` naming it, e.g. `The kbz_pay configuration is missing [app_key].`

## One Entry Point

`MyanmarPayments` builds every gateway from one array, keyed by gateway. Gateways are created on first use, so only the ones you call need configuring.

```php
use Laranex\PhpMyanmarPayments\MyanmarPayments;

$payments = new MyanmarPayments([
    'kbz_pay' => [
        'app_id' => '...',
        'app_key' => '...',
        'merchant_code' => '...',
    ],
    'wave_money' => [
        'merchant_id' => '...',
        'secret_key' => '...',
        'merchant_name' => 'My Shop',
    ],
    'aya_pay' => ['app_key' => '...', 'app_secret' => '...'],
    'yoma_mmqr' => [
        'merchant_id' => '...',
        'client_id' => '...',
        'client_secret' => '...',
        'webhook_hashkey' => '...',
    ],
    'cyber_source' => [
        'profile_id' => '...',
        'access_key' => '...',
        'secret_key' => '...',
    ],
], httpClient: $httpClient, cache: $cache); // both optional

$payments->kbzPay();      // KbzPay
$payments->waveMoney();   // WaveMoney
$payments->ayaPay();      // AyaPay
$payments->yomaMmqr();    // YomaMmqr
$payments->cyberSource(); // CyberSource
```

## HTTP Client

Gateways that call an API accept any PSR-18 client as their second argument. Without one, an installed client is discovered.

```php
$kbzPay = new KbzPay($config, $httpClient);
$waveMoney = new WaveMoney($waveConfig, $httpClient);
$ayaPay = new AyaPay($ayaConfig, $httpClient);
```

Request and stream objects are created with discovered PSR-17 factories, so a PSR-7 implementation such as `guzzlehttp/psr7` or `nyholm/psr7` must be installed. Guzzle ships one.

`CyberSource` takes only its config: it signs a form and never calls an API.

## Cache

Yoma MMQR authenticates with an OAuth token that lasts hours. `YomaMmqr` keeps it in a PSR-16 cache, its third argument:

```php
$yomaMmqr = new YomaMmqr($yomaConfig, $httpClient, $cache);
```

Without a cache it falls back to an in-memory `ArrayCache` that only lives for the current PHP process, so every request fetches a new token. Pass a shared cache (Redis, APCu, filesystem) in production. `$yomaMmqr->forgetToken()` drops a cached token, e.g. after rotating the client secret.
