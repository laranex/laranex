---
title: Configuration
description: Configure Go Myanmar Payments with one Config struct per gateway or from environment variables. Every setting is required except the HTTP timeout (30 seconds by default), URLs and time to live included. Pass your own HTTP client and token cache.
---

# Configuration

Each gateway package has a config struct and a `New` constructor. Every setting is required and has no default except `TimeoutSeconds` (30 seconds); a missing or blank one returns a `*myanmarpayments.ConfigurationError` naming it:

```go
package main

import (
	"errors"
	"log"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

func main() {
	kbz, err := kbzpay.New(kbzpay.Config{
		AppID:             "...",
		AppKey:            "",
		MerchantCode:      "...",
		APIURL:            kbzpay.ProductionAPIURL,
		PWAURL:            kbzpay.ProductionPWAURL,
		TimeToLiveMinutes: 15,
	}, nil)

	var configErr *myanmarpayments.ConfigurationError
	if errors.As(err, &configErr) {
		// e.g. kbz_pay "app_key"
		log.Fatalf("missing %s setting %q", configErr.Gateway, configErr.Key)
	}
	_ = kbz
}
```

`err.Error()` reads `myanmarpayments: The kbz_pay configuration is missing [app_key].`

`0` is unset: `TimeoutSeconds` then uses 30 (`myanmarpayments.DefaultTimeoutSeconds`), while a time to live of 0 is missing.

## Endpoints

Every gateway URL is a required setting with no default. There is no switch between test and production: set production's URLs (see [Production Endpoints](#production-endpoints)) or the gateway's UAT ones (see [UAT Endpoints](#uat-endpoints)), or a proxy's. Each config has `Resolved…()` methods that return the URL as used, without its trailing slash: `ResolvedAPIURL()` and `ResolvedPWAURL()` (KBZ Pay; the PWA URL always ends in `/`), `ResolvedBaseURL()` and `ResolvedBaseRedirectURL()` (Wave Pay), and `ResolvedBaseURL()` (AYA, Yoma, CyberSource). A gateway's `Config()` method returns the config it was created with.

## Config Options

### kbzpay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppID` | `string` | Yes | `appid` issued by KBZ |
| `AppKey` | `string` | Yes | Secret key used to sign requests |
| `MerchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `APIURL` | `string` | Yes | The API base URL, e.g. `kbzpay.ProductionAPIURL` |
| `PWAURL` | `string` | Yes | The PWA checkout URL, e.g. `kbzpay.ProductionPWAURL`. Normalized to end with `/`, e.g. `…/pwa/#/` |
| `TimeToLiveMinutes` | `int` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment's own `TimeToLiveMinutes` overrides it. Outside 1 to 120 returns `The kbz_pay configuration [time_to_live_in_minutes] must be a whole number from 1 to 120.` |
| `TimeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. `0` (unset) means 30 (`myanmarpayments.DefaultTimeoutSeconds`); a negative one is reported as `timeout_in_seconds` |

### wavepay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Wave |
| `SecretKey` | `string` | Yes | Hash secret key issued by Wave |
| `MerchantName` | `string` | Yes | Shown on Wave's payment page. A payment can override it with `wavepay.PaymentData`'s `MerchantName` |
| `BaseURL` | `string` | Yes | The API base URL, e.g. `wavepay.ProductionURL`. Payments are requested at its `/payment` |
| `BaseRedirectURL` | `string` | Yes | The host the customer is sent to, e.g. `wavepay.ProductionURL`. The customer approves the payment at its `/authenticate` |
| `TimeToLiveSeconds` | `int` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `wavepay.PaymentData`'s `TimeToLiveSeconds` |
| `TimeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. `0` (unset) means 30 (`myanmarpayments.DefaultTimeoutSeconds`); a negative one is reported as `timeout_in_seconds` |

### ayapay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppKey` | `string` | Yes | Public application key |
| `AppSecret` | `string` | Yes | Secret used for checksums |
| `BaseURL` | `string` | Yes | The gateway base URL, e.g. `ayapay.ProductionURL` |
| `TimeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. `0` (unset) means 30 (`myanmarpayments.DefaultTimeoutSeconds`); a negative one is reported as `timeout_in_seconds` |

### yomammqr.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Yoma |
| `ClientID` | `string` | Yes | OAuth client ID |
| `ClientSecret` | `string` | Yes | OAuth client secret |
| `WebhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks |
| `APIVersion` | `string` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `WebhookSecret` | `string` | Yes | Every callback must carry it in the `X-Webhook-Secret` header, compared in constant time |
| `BaseURL` | `string` | Yes | The API base URL, e.g. `yomammqr.ProductionURL` |
| `TimeoutSeconds` | `int` | No | Seconds before the default HTTP client gives up. `0` (unset) means 30 (`myanmarpayments.DefaultTimeoutSeconds`); a negative one is reported as `timeout_in_seconds` |

### cybersource.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `ProfileID` | `string` | Yes | Secure Acceptance profile ID |
| `AccessKey` | `string` | Yes | Profile access key |
| `SecretKey` | `string` | Yes | Profile secret key used to sign fields |
| `BaseURL` | `string` | Yes | The Secure Acceptance base URL, e.g. `cybersource.ProductionURL` |

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

The `Production*` constants in each gateway package name these values; they are not defaults.

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

Every gateway package has `ConfigFromEnv(getenv)`, which takes a lookup function: `os.Getenv`, or any `func(string) string` instead, such as a map lookup in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```go
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
```

Every variable is required unless it is marked optional. Set the URLs to [production's](#production-endpoints) or the gateway's [UAT ones](#uat-endpoints). The values after `=` are examples:

```env
# Every gateway that calls an API
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30      # optional, defaults to 30

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

`ConfigFromEnv` never fails: `New` returns the error. A missing variable gives the `is missing` error, and a time variable that is out of range gives the `must be …` error (`a whole number from 1 to 120` for KBZ Pay's time to live, `a whole number greater than 0` otherwise). The package never reads files itself: load the `.env` file with your framework or with a package such as [`godotenv`](https://github.com/joho/godotenv) before calling `ConfigFromEnv`.

## One Object for Every Gateway

The `payments` package builds each gateway from its config, on first use, and reuses it. Only the gateways you call need to be configured:

```go
package main

import (
	"log"
	"os"

	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	"github.com/laranex/go-myanmar-payments/v4/payments"
	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
)

func main() {
	gateways := payments.New(payments.Config{
		KBZPay: &kbzpay.Config{
			AppID:             "...",
			AppKey:            "...",
			MerchantCode:      "...",
			APIURL:            kbzpay.ProductionAPIURL,
			PWAURL:            kbzpay.ProductionPWAURL,
			TimeToLiveMinutes: 15,
		},
		YomaMMQR: &yomammqr.Config{
			MerchantID:     "...",
			ClientID:       "...",
			ClientSecret:   "...",
			WebhookHashKey: "...",
			APIVersion:     "v1rc",
			WebhookSecret:  "...",
			BaseURL:        yomammqr.ProductionURL,
		},
	}, payments.Options{})

	// *kbzpay.Gateway, the same instance on every call
	kbz, err := gateways.KBZPay()
	if err != nil {
		log.Fatal(err)
	}
	_ = kbz

	// returns a *myanmarpayments.ConfigurationError:
	// The wave_pay configuration is missing [merchant_id].
	_, err = gateways.WavePay()

	// reads each gateway's variables on first use
	fromEnv := payments.FromEnv(os.Getenv, payments.Options{})
	_ = fromEnv
}
```

The fields `KBZPay`, `WavePay`, `AYAPay`, `YomaMMQR` and `CyberSource` take a pointer to each config (`nil` leaves that gateway unconfigured), and `payments.Options` takes the `HTTPClient` and `TokenCache` described below, shared by every gateway it builds. Each method returns the gateway and an error; a failed build is not cached, so a later call tries again.

## HTTP Client

Gateways that call an API take a `myanmarpayments.HTTPDoer` after the config, which `*http.Client` satisfies:

```go
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}
```

| Argument | Description |
|---|---|
| `nil` | Uses an `*http.Client` with the config's `TimeoutSeconds` (30 by default) |
| your `HTTPDoer` | Sends every request. Use it for proxies, tracing, retries or test doubles |

```go
proxy, _ := url.Parse("http://proxy.internal:3128")
client := &http.Client{
	Timeout:   10 * time.Second,
	Transport: &http.Transport{Proxy: http.ProxyURL(proxy)},
}
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), client)
```

A client you pass keeps its own timeout; `TimeoutSeconds` is still validated, so a negative value returns the `ConfigurationError`.

Every network method takes a `context.Context` first, so request deadlines and cancellation apply to gateway calls:

```go
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()

result, err := kbz.Status(ctx, "ORDER_1")
```

A failed request (connection error, timeout, canceled context) returns an `*myanmarpayments.APIError` whose `Err` is the original error, so `errors.Is(err, context.DeadlineExceeded)` works.

`cybersource.New` takes no client: CyberSource only signs fields and makes no HTTP calls.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `yomammqr.New` takes a `myanmarpayments.TokenCache` as its third argument, an interface with three methods. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseURL|clientID)>`, the same key in every Laranex SDK, so services in different languages can share one cache:

```go
type TokenCache interface {
	Get(key string) (string, bool)
	// a ttl of 0 or less never expires
	Set(key, value string, ttl time.Duration)
	Delete(key string)
}
```

Pass `nil` to use `myanmarpayments.NewMemoryTokenCache()`, which is safe for concurrent use and lives as long as the process. When you run several processes, implement the interface on top of Redis:

```go
package shop

import (
	"context"
	"os"
	"time"

	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
	"github.com/redis/go-redis/v9"
)

type RedisTokenCache struct {
	Client *redis.Client
}

func (c RedisTokenCache) Get(key string) (string, bool) {
	value, err := c.Client.Get(context.Background(), key).Result()
	return value, err == nil
}

func (c RedisTokenCache) Set(key, value string, ttl time.Duration) {
	// Redis treats 0 as "never expires" too
	c.Client.Set(context.Background(), key, value, max(ttl, 0))
}

func (c RedisTokenCache) Delete(key string) {
	c.Client.Del(context.Background(), key)
}

func NewYoma(client *redis.Client) (*yomammqr.Gateway, error) {
	config := yomammqr.ConfigFromEnv(os.Getenv)
	return yomammqr.New(config, nil, RedisTokenCache{Client: client})
}
```

`yoma.ForgetToken()` drops a cached token, e.g. after rotating the client secret. A token request already in flight when you call it is not cached, so later calls fetch a new token.
