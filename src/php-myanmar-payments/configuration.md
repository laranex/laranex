---
title: Configuration
description: Configure PHP Myanmar Payments with one config class per gateway or from environment variables. Every setting is required except the HTTP timeout (30 seconds by default), URLs and time to live included. Pass your own PSR-18 client and PSR-16 cache.
---

# Configuration

Each gateway has a config class (`KbzPayConfig`, `WavePayConfig`, `AyaPayConfig`, `YomaMmqrConfig`, `CyberSourceConfig`) that takes named arguments; gateways take the object or an array of its snake_case keys. Every setting is required except the HTTP timeout (`timeoutSeconds`, 30 seconds, `MyanmarPayments::DEFAULT_TIMEOUT_SECONDS`); a missing or blank one throws a `ConfigurationException` naming it:

```php
use Laranex\PhpMyanmarPayments\Exceptions\ConfigurationException;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;

try {
    $config = new KbzPayConfig(
        appId: '...',
        appKey: '',
        merchantCode: '...',
        apiUrl: KbzPayConfig::PRODUCTION_API_URL,
        pwaUrl: KbzPayConfig::PRODUCTION_PWA_URL,
        timeToLiveMinutes: 15,
    );
} catch (ConfigurationException $e) {
    // e.g. kbz_pay "app_key"
    error_log("missing {$e->gateway} setting \"{$e->key}\"");
    throw $e;
}

$kbz = new KbzPay($config);
```

`$e->getMessage()` reads `The kbz_pay configuration is missing [app_key].`

`timeoutSeconds` and Wave Pay's `timeToLiveSeconds` must be whole numbers from 1 to 2147483647, and KBZ Pay's `timeToLiveMinutes` from 1 to 120; anything else, such as `0`, `'thirty'` or `2147483648`, throws, e.g. `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

In `fromArray()`, text settings also take an integer (`'merchant_code' => 200123` is `'200123'`); floats and booleans count as missing. Only ASCII whitespace counts as blank, so a no-break space or a byte order mark is a value. When several settings are wrong, the first error is the same in every Laranex SDK: the text settings in the order listed below, then the time to live, then the timeout.

## Config Options

### KbzPayConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `appId` | `string` | Yes | `appid` issued by KBZ |
| `appKey` | `string` | Yes | Secret key used to sign requests |
| `merchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `apiUrl` | `string` | Yes | The API base URL, e.g. `KbzPayConfig::PRODUCTION_API_URL` |
| `pwaUrl` | `string` | Yes | The PWA checkout URL, e.g. `KbzPayConfig::PRODUCTION_PWA_URL`. Normalized to end with `/`, e.g. `…/pwa/#/` |
| `timeToLiveMinutes` | `int` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment's own `timeToLiveMinutes` overrides it. Anything else throws `The kbz_pay configuration [time_to_live_in_minutes] must be a whole number from 1 to 120.` |
| `timeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. Defaults to 30 (`MyanmarPayments::DEFAULT_TIMEOUT_SECONDS`); an invalid one is reported as `timeout_in_seconds` |

### WavePayConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Wave |
| `secretKey` | `string` | Yes | Hash secret key issued by Wave |
| `merchantName` | `string` | Yes | Shown on Wave's payment page. A payment can override it with `WavePayPaymentData`'s `merchantName` |
| `baseUrl` | `string` | Yes | The API base URL, e.g. `WavePayConfig::PRODUCTION_URL`. Payments are requested at its `/payment` |
| `baseRedirectUrl` | `string` | Yes | The host the customer is sent to, e.g. `WavePayConfig::PRODUCTION_URL`. The customer approves the payment at its `/authenticate` |
| `timeToLiveSeconds` | `int` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `WavePayPaymentData`'s `timeToLiveSeconds` |
| `timeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. Defaults to 30 (`MyanmarPayments::DEFAULT_TIMEOUT_SECONDS`); an invalid one is reported as `timeout_in_seconds` |

### AyaPayConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | Yes | Public application key |
| `appSecret` | `string` | Yes | Secret used for checksums |
| `baseUrl` | `string` | Yes | The gateway base URL, e.g. `AyaPayConfig::PRODUCTION_URL` |
| `timeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. Defaults to 30 (`MyanmarPayments::DEFAULT_TIMEOUT_SECONDS`); an invalid one is reported as `timeout_in_seconds` |

### YomaMmqrConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID issued by Yoma |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `webhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `apiVersion` | `string` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `webhookSecret` | `string` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `baseUrl` | `string` | Yes | The API base URL, e.g. `YomaMmqrConfig::PRODUCTION_URL` |
| `timeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. Defaults to 30 (`MyanmarPayments::DEFAULT_TIMEOUT_SECONDS`); an invalid one is reported as `timeout_in_seconds` |

### CyberSourceConfig

| Parameter | Type | Required | Description |
|---|---|---|---|
| `profileId` | `string` | Yes | Secure Acceptance profile ID |
| `accessKey` | `string` | Yes | Profile access key |
| `secretKey` | `string` | Yes | Profile secret key used to sign fields |
| `baseUrl` | `string` | Yes | The Secure Acceptance base URL, e.g. `CyberSourceConfig::PRODUCTION_URL` |

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

Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#uat-endpoints). The values after `=` are examples:

```env
# Every gateway that calls an API
# MYANMAR_PAYMENTS_HTTP_TIMEOUT=30    # optional, defaults to 30 seconds

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

# CyberSource
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=
```

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `timeout_in_seconds` for KBZ Pay, Wave Pay, AYA and Yoma MMQR. The package never reads files itself: load the `.env` file with your framework or with [`vlucas/phpdotenv`](https://github.com/vlucas/phpdotenv) before calling `fromEnv()`.

Credentials from a config file go through `fromArray()`, which reads the same settings as snake_case keys:

| Config class | Keys |
|---|---|
| `KbzPayConfig` | `app_id`, `app_key`, `merchant_code`, `api_url`, `pwa_url`, `time_to_live_in_minutes`, `timeout_in_seconds` |
| `WavePayConfig` | `merchant_id`, `secret_key`, `merchant_name`, `base_url`, `base_redirect_url`, `time_to_live_in_seconds`, `timeout_in_seconds` |
| `AyaPayConfig` | `app_key`, `app_secret`, `base_url`, `timeout_in_seconds` |
| `YomaMmqrConfig` | `merchant_id`, `client_id`, `client_secret`, `webhook_hashkey`, `api_version`, `webhook_secret`, `base_url`, `timeout_in_seconds` |
| `CyberSourceConfig` | `profile_id`, `access_key`, `secret_key`, `base_url` |

`time_to_live_in_minutes`, `time_to_live_in_seconds` and `timeout_in_seconds` take an `int` or integer text such as `'30'`.

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
        apiUrl: KbzPayConfig::PRODUCTION_API_URL,
        pwaUrl: KbzPayConfig::PRODUCTION_PWA_URL,
        timeToLiveMinutes: 15,
    ),
    'yoma_mmqr' => [
        'merchant_id' => '...',
        'client_id' => '...',
        'client_secret' => '...',
        'webhook_hashkey' => '...',
        'api_version' => 'v1rc',
        'webhook_secret' => '...',
        'base_url' => 'https://paymenthubapi.yomabank.com',
    ],
]);

$payments->kbzPay(); // KbzPay, the same instance on every call
// throws ConfigurationException:
// The wave_pay configuration is missing [merchant_id].
$payments->wavePay();

// reads each gateway's variables on first use
$fromEnv = MyanmarPayments::fromEnv();
```

The keys `kbz_pay`, `wave_pay`, `aya_pay`, `yoma_mmqr` and `cyber_source` take a config object or the array `fromArray()` reads, and the facade also takes the `httpClient` and `cache` arguments below, shared by every gateway it builds.

## HTTP Client

Gateways that call an API take any PSR-18 client as their second argument:

| Argument | Type | Description |
|---|---|---|
| `httpClient` | `?Psr\Http\Client\ClientInterface` | Sends every request. Use it for proxies, tracing, retries or test doubles |

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

Without a client, the gateway uses Guzzle with `timeoutSeconds` when Guzzle is installed, and otherwise a discovered PSR-18 client with its own timeout; a client you pass keeps its own timeout. Guzzle's PSR-18 `sendRequest()` never follows redirects: a 3xx answer is a failed request like any other non-2xx one. Request and stream objects are created with discovered PSR-17 factories, so a PSR-7 implementation such as `guzzlehttp/psr7` or `nyholm/psr7` must be installed. Guzzle ships one.

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

::: warning A shared cache is required in production
The default is an in-memory `ArrayCache` that only lives for the current PHP process, so with PHP-FPM or CGI every request fetches a new token: slower, and it may hit Yoma's token rate limits. Pass a shared cache (Redis, APCu, filesystem, your framework's cache) in production, with `new YomaMmqr($config, $client, $cache)` or `MyanmarPayments::fromEnv(cache: $cache)`. Long-running workers keep the token for their own lifetime, but several workers or servers should still share one cache.
:::

The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseUrl|clientId)>`, the same key in every Laranex SDK, so services in different languages can share one cache. `$yoma->forgetToken()` drops a cached token, e.g. after rotating the client secret.
