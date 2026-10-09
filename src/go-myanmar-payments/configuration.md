---
title: Configuration
description: Configure Go Myanmar Payments with one Config struct per gateway or from environment variables. Sandbox is the default; pass your own HTTP client and token cache.
---

# Configuration

Each gateway package has a config struct (`kbzpay.Config`, `wavemoney.Config`, `ayapay.Config`, `yomammqr.Config`, `cybersource.Config`) and a `New` constructor that takes it. A missing credential returns a `*myanmarpayments.ConfigurationError` naming it:

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
		AppID:        "...",
		AppKey:       "",
		MerchantCode: "...",
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

## Sandbox and Production

Every config has a `Production` field whose zero value, `false`, selects the sandbox, so a forgotten setting never sends real payments. Set `Production: true` together with production credentials when you go live.

URL fields are optional overrides; leave them empty to use the endpoint matching `Production`. Each config has `Resolved…()` methods that return the value actually used: `ResolvedAPIURL()` and `ResolvedPWAURL()` (KBZ Pay), `ResolvedBaseURL()`, `ResolvedAuthenticateURL()` and `ResolvedTimeToLive()` (Wave Money), `ResolvedBaseURL()` (AYA, Yoma, CyberSource) and `ResolvedAPIVersion()` (Yoma). A gateway's `Config()` method returns the config it was created with.

## Config Options

### kbzpay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppID` | `string` | Yes | `appid` issued by KBZ |
| `AppKey` | `string` | Yes | Secret key used to sign requests |
| `MerchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `Production` | `bool` | No | `false` (default) uses UAT |
| `APIURL` | `string` | No | Override the API base URL |
| `PWAURL` | `string` | No | Override the PWA checkout URL. Normalized to end with `/`, e.g. `…/pwa/#/` |

### wavemoney.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Wave |
| `SecretKey` | `string` | Yes | Hash secret key issued by Wave |
| `MerchantName` | `string` | Yes | Shown on Wave's payment page |
| `TimeToLiveSeconds` | `int` | No | Seconds the customer has to pay. `0` or less means 300 |
| `Production` | `bool` | No | `false` (default) uses the test host |
| `BaseURL` | `string` | No | Override the API base URL |
| `AuthenticateURL` | `string` | No | Override the host the customer is redirected to |

### ayapay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppKey` | `string` | Yes | Public application key |
| `AppSecret` | `string` | Yes | Secret used for checksums |
| `Production` | `bool` | No | `false` (default) uses UAT |
| `BaseURL` | `string` | No | Override the gateway base URL |

### yomammqr.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant ID issued by Yoma |
| `ClientID` | `string` | Yes | OAuth client ID |
| `ClientSecret` | `string` | Yes | OAuth client secret |
| `WebhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks. A missing one is reported as `webhook_hashkey` |
| `WebhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `Production` | `bool` | No | `false` (default) uses UAT |
| `BaseURL` | `string` | No | Override the API base URL |
| `APIVersion` | `string` | No | The `{version}` path segment, default `v1rc` (`yomammqr.DefaultAPIVersion`) |

### cybersource.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `ProfileID` | `string` | Yes | Secure Acceptance profile ID |
| `AccessKey` | `string` | Yes | Profile access key |
| `SecretKey` | `string` | Yes | Profile secret key used to sign fields |
| `Production` | `bool` | No | `false` (default) uses the test environment |
| `BaseURL` | `string` | No | Override the Secure Acceptance base URL |

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

The URLs are exported constants in the gateway packages, e.g. `kbzpay.SandboxAPIURL`, `kbzpay.ProductionPWAURL`, `wavemoney.SandboxAuthenticateURL`, `yomammqr.ProductionURL`.

## From Environment Variables

Every gateway package has `ConfigFromEnv(getenv)`, which takes a lookup function: `os.Getenv`, or any `func(string) string` instead, such as a map lookup in tests. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

```go
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
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

`*_SANDBOX=false` (or `0`, `f`, `no`, `off`, in any case) selects production. Unset or unrecognized values mean sandbox. The package never reads files itself: load the `.env` file with your framework or with a package such as [`godotenv`](https://github.com/joho/godotenv) before calling `ConfigFromEnv`.

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
			AppID:        "...",
			AppKey:       "...",
			MerchantCode: "...",
		},
		YomaMMQR: &yomammqr.Config{
			MerchantID:     "...",
			ClientID:       "...",
			ClientSecret:   "...",
			WebhookHashKey: "...",
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
| `nil` | Uses `myanmarpayments.DefaultHTTPClient()`, an `*http.Client` with a 30 second timeout |
| your `HTTPDoer` | Sends every request. Use it for proxies, tracing, retries or test doubles |

```go
client := &http.Client{Timeout: 10 * time.Second}
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), client)
```

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
