---
title: Configuration
description: Configure Go Myanmar Payments with one Config struct per gateway or from environment variables. Every setting is required; endpoints default to production. Pass your own HTTP client and token cache.
---

# Configuration

Each gateway package has a config struct (`kbzpay.Config`, `wavemoney.Config`, `ayapay.Config`, `yomammqr.Config`, `cybersource.Config`) and a `New` constructor that takes it. Every setting is required except the URL overrides and Yoma's webhook secret: there are no defaults, and a missing or blank setting returns a `*myanmarpayments.ConfigurationError` naming it:

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
		AppID:          "...",
		AppKey:         "",
		MerchantCode:   "...",
		TimeoutSeconds: 30,
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

The time settings (`TimeoutSeconds`, and Wave Money's `TimeToLiveSeconds`) must be whole numbers greater than 0. `0` is the zero value, so it counts as missing. A negative value returns the same error with `Invalid` set and the message `myanmarpayments: The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

## Endpoints

Every gateway uses its production endpoints. There is no switch between test and production: to test against a gateway's UAT environment, or to go through a proxy, set the URL overrides (see [Testing Against UAT](#testing-against-uat)). An empty override means unset. Each config has `Resolved…()` methods that return the URL actually used: `ResolvedAPIURL()` and `ResolvedPWAURL()` (KBZ Pay), `ResolvedBaseURL()` and `ResolvedAuthenticateURL()` (Wave Money), and `ResolvedBaseURL()` (AYA, Yoma, CyberSource). A gateway's `Config()` method returns the config it was created with.

## Config Options

### kbzpay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppID` | `string` | Yes | `appid` issued by KBZ |
| `AppKey` | `string` | Yes | Secret key used to sign requests |
| `MerchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `TimeoutSeconds` | `int` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `APIURL` | `string` | No | Override the API base URL |
| `PWAURL` | `string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### wavemoney.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Wave |
| `SecretKey` | `string` | Yes | Hash secret key issued by Wave |
| `MerchantName` | `string` | Yes | Shown on Wave's payment page |
| `TimeToLiveSeconds` | `int` | Yes | Seconds the customer has to pay. A missing one is reported as `time_to_live_in_seconds` |
| `TimeoutSeconds` | `int` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `BaseURL` | `string` | No | Override the API base URL |
| `AuthenticateURL` | `string` | No | Override the host the customer is redirected to |

### ayapay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppKey` | `string` | Yes | Public application key |
| `AppSecret` | `string` | Yes | Secret used for checksums |
| `TimeoutSeconds` | `int` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `BaseURL` | `string` | No | Override the gateway base URL |

### yomammqr.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Yoma |
| `ClientID` | `string` | Yes | OAuth client ID |
| `ClientSecret` | `string` | Yes | OAuth client secret |
| `WebhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `APIVersion` | `string` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `TimeoutSeconds` | `int` | Yes | Seconds before the default HTTP client gives up. A missing one is reported as `timeout_in_seconds` |
| `WebhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `BaseURL` | `string` | No | Override the API base URL |

### cybersource.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `ProfileID` | `string` | Yes | Secure Acceptance profile ID |
| `AccessKey` | `string` | Yes | Profile access key |
| `SecretKey` | `string` | Yes | Profile secret key used to sign fields |
| `BaseURL` | `string` | No | Override the Secure Acceptance base URL |

## Production Endpoints

| Gateway | URL |
|---|---|
| KBZ Pay API | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://payments.wavemoney.io` |
| Wave Money authenticate redirect | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://secureacceptance.cybersource.com` |

The URLs are exported constants in the gateway packages: `kbzpay.ProductionAPIURL`, `kbzpay.ProductionPWAURL`, `wavemoney.ProductionURL`, `wavemoney.ProductionAuthenticateURL`, and `ProductionURL` in `ayapay`, `yomammqr` and `cybersource`.

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URL overrides to the gateway's UAT endpoints together with the UAT credentials:

| Gateway | Variable | Config field | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `APIURL` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `PWAURL` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `BaseURL` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_AUTHENTICATE_URL` | `AuthenticateURL` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `BaseURL` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `BaseURL` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `BaseURL` | `https://testsecureacceptance.cybersource.com` |

Wave serves its API on port `8107` and the page the customer is redirected to on the same host without the port. Remove the overrides, and switch to the production credentials, when you go live.

## From Environment Variables

Every gateway package has `ConfigFromEnv(getenv)`, which takes a lookup function: `os.Getenv`, or any `func(string) string` instead, such as a map lookup in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```go
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
```

Every variable is required unless it is marked optional. The values after `=` are examples:

```env
# Every gateway that calls an API
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30

# KBZ Pay
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional override

# Wave Money
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional override
WAVE_MONEY_AUTHENTICATE_URL=          # optional override

# AYA Payment Gateway (AYA_PGW_* names are read too)
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional override

# Yoma MMQR
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
YOMA_MMQR_API_VERSION=v1rc
YOMA_MMQR_WEBHOOK_SECRET=             # optional
YOMA_MMQR_BASE_URL=                   # optional override

# CyberSource
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional override
```

`MYANMAR_PAYMENTS_HTTP_TIMEOUT` sets `TimeoutSeconds` for KBZ Pay, Wave Money, AYA and Yoma MMQR. `ConfigFromEnv` never fails: `New` returns the error, and a time variable that is set but not a whole number greater than 0 gives the `must be a whole number greater than 0` error. The package never reads files itself: load the `.env` file with your framework or with a package such as [`godotenv`](https://github.com/joho/godotenv) before calling `ConfigFromEnv`.

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
			AppID:          "...",
			AppKey:         "...",
			MerchantCode:   "...",
			TimeoutSeconds: 30,
		},
		YomaMMQR: &yomammqr.Config{
			MerchantID:     "...",
			ClientID:       "...",
			ClientSecret:   "...",
			WebhookHashKey: "...",
			APIVersion:     "v1rc",
			TimeoutSeconds: 30,
		},
	}, payments.Options{})

	// *kbzpay.Gateway, the same instance on every call
	kbz, err := gateways.KBZPay()
	if err != nil {
		log.Fatal(err)
	}
	_ = kbz

	// returns a *myanmarpayments.ConfigurationError:
	// The wave_money configuration is missing [merchant_id].
	_, err = gateways.WaveMoney()

	// reads each gateway's variables on first use
	fromEnv := payments.FromEnv(os.Getenv, payments.Options{})
	_ = fromEnv
}
```

The fields `KBZPay`, `WaveMoney`, `AYAPay`, `YomaMMQR` and `CyberSource` take a pointer to each config (`nil` leaves that gateway unconfigured), and `payments.Options` takes the `HTTPClient` and `TokenCache` described below, shared by every gateway it builds. Each method returns the gateway and an error; a failed build is not cached, so a later call tries again. A `*payments.Gateways` is safe for concurrent use: create one at startup and share it.

## HTTP Client

Gateways that call an API take a `myanmarpayments.HTTPDoer` after the config, which `*http.Client` satisfies:

```go
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}
```

| Argument | Description |
|---|---|
| `nil` | Uses an `*http.Client` with the config's `TimeoutSeconds` |
| your `HTTPDoer` | Sends every request. Use it for proxies, tracing, retries or test doubles |

```go
proxy, _ := url.Parse("http://proxy.internal:3128")
client := &http.Client{
	Timeout:   10 * time.Second,
	Transport: &http.Transport{Proxy: http.ProxyURL(proxy)},
}
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), client)
```

A client you pass keeps its own timeout; `TimeoutSeconds` is still required.

Every network method takes a `context.Context` first, so request deadlines and cancellation apply to gateway calls:

```go
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()

result, err := kbz.Status(ctx, "ORDER_1")
```

Create gateways once at startup and share them: a `*Gateway` is safe for concurrent use. A failed request (connection error, timeout, canceled context) returns an `*myanmarpayments.APIError` whose `Err` is the original error, so `errors.Is(err, context.DeadlineExceeded)` works.

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

Pass `nil` to use `myanmarpayments.NewMemoryTokenCache()`, which is safe for concurrent use and lives as long as the process: create one `*yomammqr.Gateway` at startup and share it across requests. When you run several processes, implement the interface on top of Redis:

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

`yoma.ForgetToken()` drops a cached token, e.g. after rotating the client secret.
