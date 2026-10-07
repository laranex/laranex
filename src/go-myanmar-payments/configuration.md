---
title: Configuration
description: Configure Go Myanmar Payments with one Config struct per gateway or from environment variables. The zero value is the sandbox; inject your own HTTP client and token cache.
---

# Configuration

Each gateway package has a `Config` struct and a `New` constructor. `New` returns a `*myanmarpayments.ConfigurationError` naming the first missing credential:

```go
kbz, err := kbzpay.New(kbzpay.Config{
	AppID:        "...",
	AppKey:       "...",
	MerchantCode: "...",
}, nil)

var configErr *myanmarpayments.ConfigurationError
if errors.As(err, &configErr) {
	log.Fatalf("missing %s setting %q", configErr.Gateway, configErr.Key)
}
```

## Sandbox and Production

Every `Config` has a `Production bool` field. Its zero value, `false`, selects the gateway's sandbox endpoints, so a forgotten setting never sends real payments. Set `Production: true` together with production credentials when you go live.

URL fields are optional overrides; leave them empty to use the endpoint matching `Production`. The `Resolved…URL()` methods return the URL actually used.

## Config Structs

### kbzpay.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `AppID` | `string` | Yes | `appid` issued by KBZ |
| `AppKey` | `string` | Yes | Secret key used to sign requests |
| `MerchantCode` | `string` | Yes | `merch_code` issued by KBZ |
| `Production` | `bool` | No | `false` (default) uses UAT |
| `APIURL` | `string` | No | Override the API base URL |
| `PWAURL` | `string` | No | Override the PWA checkout URL. Normalised to end with `/`, e.g. `…/pwa/#/` |

### wavemoney.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `MerchantID` | `string` | Yes | Merchant id issued by Wave |
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
| `MerchantID` | `string` | Yes | Merchant id issued by Yoma |
| `ClientID` | `string` | Yes | OAuth client id |
| `ClientSecret` | `string` | Yes | OAuth client secret |
| `WebhookHashKey` | `string` | Yes | Hash key issued by Yoma for verifying callbacks |
| `WebhookSecret` | `string` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `Production` | `bool` | No | `false` (default) uses UAT |
| `BaseURL` | `string` | No | Override the API base URL |
| `APIVersion` | `string` | No | The `{version}` path segment, default `v1rc` (`yomammqr.DefaultAPIVersion`) |

### cybersource.Config

| Field | Type | Required | Description |
|---|---|---|---|
| `ProfileID` | `string` | Yes | Secure Acceptance profile id |
| `AccessKey` | `string` | Yes | Profile access key |
| `SecretKey` | `string` | Yes | Profile secret key used to sign fields |
| `Production` | `bool` | No | `false` (default) uses the test environment |
| `BaseURL` | `string` | No | Override the Secure Acceptance base URL |

## Default Endpoints

| Gateway | Sandbox | Production |
|---|---|---|
| KBZ Pay API | `http://api-uat.kbzpay.com/payment/gateway/uat` | `https://api.kbzpay.com/payment/gateway` |
| KBZ Pay PWA | `https://static.kbzpay.com/pgw/uat/pwa/#/` | `https://wap.kbzpay.com/pgw/pwa/#/` |
| Wave Money API | `https://testpayments.wavemoney.io:8107` | `https://payments.wavemoney.io` |
| Wave Money authenticate redirect | `https://testpayments.wavemoney.io` | `https://payments.wavemoney.io` |
| AYA Payment Gateway | `https://uat-pgw.ayainnovation.com` | `https://pgw.ayainnovation.com` |
| Yoma MMQR | `https://devapi.yomabank.net` | `https://paymenthubapi.yomabank.com` |
| CyberSource | `https://testsecureacceptance.cybersource.com` | `https://secureacceptance.cybersource.com` |

The URLs are exported constants, e.g. `kbzpay.SandboxAPIURL`, `kbzpay.ProductionPWAURL`, `wavemoney.SandboxAuthenticateURL`, `yomammqr.ProductionURL`.

::: warning Wave sandbox host
Wave's documented test host `testpayments.wavemoney.io` no longer resolves in DNS (checked October 2026). Set `BaseURL` if Wave gives you another test host.
:::

## From Environment Variables

Every gateway package has `ConfigFromEnv`, which takes a lookup function such as `os.Getenv`. The variable names match the [Laravel package](/laravel-myanmar-payments/configuration), so one `.env` file works for both.

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

`*_SANDBOX=false` (or `0`, `no`, `off`) sets `Production: true`. Unset or unrecognised values mean sandbox.

## HTTP Client

Gateways that call an API take a `myanmarpayments.HTTPDoer`, which `*http.Client` satisfies:

```go
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}
```

Pass `nil` to use `myanmarpayments.DefaultHTTPClient()`, an `*http.Client` with a 30 second timeout. Pass your own to add proxies, tracing or a test double:

```go
client := &http.Client{Timeout: 10 * time.Second}
kbz, err := kbzpay.New(config, client)
```

Every network method takes a `context.Context` first, so request deadlines and cancellation apply to gateway calls.

`cybersource.New` takes no client: CyberSource only signs fields and makes no HTTP calls.

## Token Cache

Yoma MMQR authenticates with an OAuth access token that lasts hours. `yomammqr.New` takes a `myanmarpayments.TokenCache` to keep it between calls:

```go
type TokenCache interface {
	Get(key string) (string, bool)
	Set(key, value string, ttl time.Duration)
	Delete(key string)
}
```

Pass `nil` to use `myanmarpayments.NewMemoryTokenCache()`, which lives for the life of the process. Share one `*yomammqr.Gateway` across requests, or implement `TokenCache` on top of Redis when you run several processes:

```go
yoma, err := yomammqr.New(yomammqr.ConfigFromEnv(os.Getenv), nil, myanmarpayments.NewMemoryTokenCache())
```
