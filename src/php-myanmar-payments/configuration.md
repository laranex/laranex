---
title: Configuration
description: Configure PHP Myanmar Payments with one config class per gateway or from environment variables. Sandbox is the default; pass your own PSR-18 client and PSR-16 cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WaveMoneyConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes named arguments. Gateways take the config object or an array of its snake_case keys, and a missing or blank credential throws a `ConfigurationException` naming it:

```php
use Laranex\PhpMyanmarPayments\Exceptions\ConfigurationException;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;

try {
    $config = new KbzPayConfig(
        appId: '...',
        appKey: '',
        merchantCode: '...',
    );
} catch (ConfigurationException $e) {
    // e.g. kbz_pay "app_key"
    error_log("missing {$e->gateway} setting \"{$e->key}\"");
    throw $e;
}

$kbz = new KbzPay($config);
```

`$e->getMessage()` reads `The kbz_pay configuration is missing [app_key].`

## Sandbox and Production

Every config has a `sandbox` argument that defaults to `true`, so a forgotten setting never sends real payments. Pass `sandbox: false` together with production credentials when you go live.

URL arguments are optional overrides; leave them unset (or blank) to use the endpoint matching `sandbox`. Each config object exposes the URL actually used as a read-only property (`$config->apiUrl`, `$config->baseUrl`, …).

## Config Options

### KbzPayConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `sandbox` | `bool` | No | `true` (default) uses UAT |
| `apiUrl` | `?string` | No | Override the API base URL |
| `pwaUrl` | `?string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### WaveMoneyConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page |
| `timeToLiveSeconds` | `int` | No | Seconds the customer has to pay. Unset, zero or less means 300 |
| `sandbox` | `bool` | No | `true` (default) uses the test host |
| `baseUrl` | `?string` | No | Override the API base URL |
| `authenticateUrl` | `?string` | No | Override the host the customer is redirected to |

### AyaPayConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `sandbox` | `bool` | No | `true` (default) uses UAT |
| `baseUrl` | `?string` | No | Override the gateway base URL |

### YomaMmqrConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Yoma |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `webhookSecret` | `?string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `sandbox` | `bool` | No | `true` (default) uses UAT |
| `baseUrl` | `?string` | No | Override the API base URL |
| `apiVersion` | `string` | No | The `{version}` path segment, default `v1rc` |

### CyberSourceConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `sandbox` | `bool` | No | `true` (default) uses the test environment |
| `baseUrl` | `?string` | No | Override the Secure Acceptance base URL |

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

The URLs are class constants on the config classes, e.g. `KbzPayConfig::SANDBOX_API_URL`, `KbzPayConfig::PRODUCTION_PWA_URL`, `WaveMoneyConfig::SANDBOX_AUTHENTICATE_URL`, `YomaMmqrConfig::PRODUCTION_URL`.

## From Environment Variables

Every config class and gateway has `fromEnv($env = null)`, which reads `getenv()` merged with `$_ENV` by default and takes any array instead, such as one in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;

$kbz = KbzPay::fromEnv();
// or
$config = KbzPayConfig::fromEnv();
$kbz = new KbzPay($config);
```

```env
# KBZ Pay
KBZ_PAY_SANDBOX=true
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional override

# Wave Money
WAVE_MONEY_SANDBOX=true
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=             # falls back to APP_NAME
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional override
WAVE_MONEY_AUTHENTICATE_URL=          # optional override

# AYA Payment Gateway (AYA_PGW_* names are read too)
AYA_PAY_SANDBOX=true
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional override

# Yoma MMQR
YOMA_MMQR_SANDBOX=true
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_WEBHOOK_SECRET=             # optional
YOMA_MMQR_BASE_URL=                   # optional override
YOMA_MMQR_API_VERSION=v1rc

# CyberSource
CYBER_SOURCE_SANDBOX=true
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional override
```

`*_SANDBOX=false` (or `0`, `f`, `no`, `off`, in any case) selects production. Unset or unrecognized values mean sandbox. The package never reads files itself: load the `.env` file with your framework or with [`vlucas/phpdotenv`](https://github.com/vlucas/phpdotenv) before calling `fromEnv()`.

Credentials from a config file go through `fromArray()`, which reads the same settings as snake_case keys:

| Config class | Keys |
|---|---|
| `KbzPayConfig` | `app_id`, `app_key`, `merchant_code`, `sandbox`, `api_url`, `pwa_url` |
| `WaveMoneyConfig` | `merchant_id`, `secret_key`, `merchant_name`, `time_to_live_in_seconds`, `sandbox`, `base_url`, `authenticate_url` |
| `AyaPayConfig` | `app_key`, `app_secret`, `sandbox`, `base_url` |
| `YomaMmqrConfig` | `merchant_id`, `client_id`, `client_secret`, `webhook_hashkey`, `webhook_secret`, `sandbox`, `base_url`, `api_version` |
| `CyberSourceConfig` | `profile_id`, `access_key`, `secret_key`, `sandbox`, `base_url` |

`sandbox` takes a `bool` or the same text as `*_SANDBOX`. A `time_to_live_in_seconds` that is not integer text means 300.

## One Object for Every Gateway

`MyanmarPayments` builds each gateway from its config, on first use, and reuses it. Only the gateways you call need to be configured:

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;
use Laranex\PhpMyanmarPayments\MyanmarPayments;

$payments = new MyanmarPayments([
    'kbz_pay' => new KbzPayConfig(
        appId: '...',
        appKey: '...',
        merchantCode: '...',
    ),
    'yoma_mmqr' => [
        'merchant_id' => '...',
        'client_id' => '...',
        'client_secret' => '...',
        'webhook_hashkey' => '...',
    ],
]);

$payments->kbzPay(); // KbzPay, the same instance on every call
// throws ConfigurationException:
// The wave_money configuration is missing [merchant_id].
$payments->waveMoney();

// reads each gateway's variables on first use
$fromEnv = MyanmarPayments::fromEnv();
```

The keys `kbz_pay`, `wave_money`, `aya_pay`, `yoma_mmqr` and `cyber_source` take a config object or the array `fromArray()` reads, and the facade also takes the `httpClient` and `cache` arguments below, shared by every gateway it builds. `$payments->cyberSource()` returns the one `CyberSource` class.

## HTTP Client

Gateways that call an API take any PSR-18 client as their second argument:

| Argument | Type | Description |
|---|---|---|
| `httpClient` | `?Psr\Http\Client\ClientInterface` | Sends every request. Use it for proxies, tracing, retries, timeouts or test doubles. Without one, the gateway uses Guzzle with a 30 second timeout when Guzzle is installed, and otherwise discovers an installed PSR-18 client |

```php
use GuzzleHttp\Client;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;

$client = new Client([
    'timeout' => 10,
    'proxy' => 'http://proxy.internal:3128',
]);

$kbz = new KbzPay(KbzPayConfig::fromEnv(), $client);
```

`fromEnv()` takes the same client: `KbzPay::fromEnv(null, $client)`.

A client you pass owns the timeout: set it on that client. Request and stream objects are created with discovered PSR-17 factories, so a PSR-7 implementation such as `guzzlehttp/psr7` or `nyholm/psr7` must be installed. Guzzle ships one.

A failed request (connection error, timeout) throws an `ApiException` whose `getPrevious()` is the client's original exception.

`CyberSource` takes only its config: it only signs fields and makes no HTTP calls.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `YomaMmqr` keeps it in a [PSR-16](https://www.php-fig.org/psr/psr-16/) cache, its third argument:

```php
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqr;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrConfig;
use Symfony\Component\Cache\Adapter\RedisAdapter;
use Symfony\Component\Cache\Psr16Cache;

$cache = new Psr16Cache(new RedisAdapter(
    RedisAdapter::createConnection('redis://localhost'),
));

$yoma = new YomaMmqr(YomaMmqrConfig::fromEnv(), null, $cache);
```

The default is an in-memory `ArrayCache` that only lives for the current PHP process, so with PHP-FPM every request fetches a new token. Pass a shared cache (Redis, APCu, filesystem) in production. Pass `cache` to `MyanmarPayments` to share one cache with the Yoma gateway it builds. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseUrl|clientId)>`, the same key in every Laranex SDK, so services in different languages can share one cache. `$yoma->forgetToken()` drops a cached token, e.g. after rotating the client secret.
