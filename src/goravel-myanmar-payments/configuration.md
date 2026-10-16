---
title: Configuration
description: Configure Goravel Myanmar Payments with environment variables or config/myanmar_payments.go. Every setting of the gateways you use is required except the HTTP timeout (30 seconds by default), URLs and time to live included.
---

# Configuration

## Environment Variables

Add the keys of the gateways you use. Every setting of those gateways is required and has no default, except the HTTP timeout (`MYANMAR_PAYMENTS_HTTP_TIMEOUT`, 30 seconds by default): that includes the URLs, the time to live (`KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` and `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS`) and Yoma's webhook secret. A gateway is configured the first time you request it, and a missing or blank setting returns a `*myanmarpayments.ConfigurationError` naming it, e.g. `myanmarpayments: The kbz_pay configuration is missing [app_key].`

```env
# optional, every gateway that calls an API (all but CyberSource), default 30
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30
# AYA Pay and CyberSource, while the form route is enabled
MYANMAR_PAYMENTS_FORM_TTL_MINUTES=30
# optional, an http.clients entry, empty = default client
MYANMAR_PAYMENTS_HTTP_CLIENT=
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
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `http.timeout` | No | Seconds before a gateway call gives up; missing or blank means 30. Given to every gateway except CyberSource as its `timeout_in_seconds` |
| `MYANMAR_PAYMENTS_FORM_TTL_MINUTES` | `form_route.ttl_minutes` | Yes | Minutes an auto-submit form link stays valid. Needed by AYA Pay and CyberSource while the form route is enabled |
| `MYANMAR_PAYMENTS_HTTP_CLIENT` | `http.client` | No | An entry of `http.clients` in `config/http.go`; empty means the default client |
| `MYANMAR_PAYMENTS_CACHE_STORE` | `cache_store` | No | Cache store for Yoma MMQR access tokens; empty means the default store |
| `KBZ_PAY_APP_ID` | `kbz_pay.app_id` | Yes | `appid` issued by KBZ |
| `KBZ_PAY_APP_KEY` | `kbz_pay.app_key` | Yes | Secret key used to sign requests |
| `KBZ_PAY_MERCHANT_CODE` | `kbz_pay.merchant_code` | Yes | `merch_code` issued by KBZ |
| `KBZ_PAY_BASE_URL` | `kbz_pay.api_url` | Yes | The API base URL |
| `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbz_pay.pwa_url` | Yes | The PWA checkout URL |
| `KBZ_PAY_TIME_TO_LIVE_IN_MINUTES` | `kbz_pay.time_to_live_in_minutes` | Yes | Minutes the customer has to pay each order, 1 to 120. A payment can override it with `kbzpay.PaymentData`'s `TimeToLiveMinutes` |
| `WAVE_PAY_MERCHANT_ID` | `wave_pay.merchant_id` | Yes | Merchant ID issued by Wave |
| `WAVE_PAY_SECRET_KEY` | `wave_pay.secret_key` | Yes | Hash secret key issued by Wave |
| `WAVE_PAY_MERCHANT_NAME` | `wave_pay.merchant_name` | Yes | Shown on Wave's payment page. A payment can override it with `wavepay.PaymentData`'s `MerchantName` |
| `WAVE_PAY_BASE_URL` | `wave_pay.base_url` | Yes | The API base URL. Payments are requested at its `/payment` |
| `WAVE_PAY_BASE_REDIRECT_URL` | `wave_pay.base_redirect_url` | Yes | The host the customer is sent to. The customer approves the payment at its `/authenticate` |
| `WAVE_PAY_TIME_TO_LIVE_IN_SECONDS` | `wave_pay.time_to_live_in_seconds` | Yes | Seconds the customer has to pay, greater than 0. A payment can override it with `wavepay.PaymentData`'s `TimeToLiveSeconds` |
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

## Endpoints

Every gateway URL is a required setting with no default. There is no switch between test and production: set production's URLs (see [Production Endpoints](#production-endpoints)) or the gateway's UAT ones (see [UAT Endpoints](#uat-endpoints)), or a proxy's.

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

`config/myanmar_payments.go` maps the environment variables onto the `myanmar_payments` config. A published value wins; when a value is empty or the file is not published, the package falls back to the SDK's environment variable.

```go
package config

import (
	contractshttp "github.com/goravel/framework/contracts/http"
	"yourapp/app/facades"
)

func init() {
	config := facades.Config()
	config.Add("myanmar_payments", map[string]any{
		// Gateways
		//
		// Only the gateways you call need settings, and every setting of a
		// gateway you call is required, URLs included: set production's URLs,
		// or the gateway's UAT URLs to test. The environment variable names
		// are the ones the Go SDK reads.
		"kbz_pay": map[string]any{
			"app_id":                  config.Env("KBZ_PAY_APP_ID", ""),
			"app_key":                 config.Env("KBZ_PAY_APP_KEY", ""),
			"merchant_code":           config.Env("KBZ_PAY_MERCHANT_CODE", ""),
			"api_url":                 config.Env("KBZ_PAY_BASE_URL", ""),
			"pwa_url":                 config.Env("KBZ_PAY_PWA_BASE_REDIRECT_URL", ""),
			"time_to_live_in_minutes": config.Env("KBZ_PAY_TIME_TO_LIVE_IN_MINUTES", ""),
		},

		"wave_pay": map[string]any{
			"merchant_id":             config.Env("WAVE_PAY_MERCHANT_ID", ""),
			"secret_key":              config.Env("WAVE_PAY_SECRET_KEY", ""),
			"merchant_name":           config.Env("WAVE_PAY_MERCHANT_NAME", ""),
			"time_to_live_in_seconds": config.Env("WAVE_PAY_TIME_TO_LIVE_IN_SECONDS", ""),
			"base_url":                config.Env("WAVE_PAY_BASE_URL", ""),
			"base_redirect_url":       config.Env("WAVE_PAY_BASE_REDIRECT_URL", ""),
		},

		"aya_pay": map[string]any{
			"app_key":    config.Env("AYA_PAY_APP_KEY", ""),
			"app_secret": config.Env("AYA_PAY_APP_SECRET", ""),
			"base_url":   config.Env("AYA_PAY_BASE_URL", ""),
		},

		"yoma_mmqr": map[string]any{
			"merchant_id":     config.Env("YOMA_MMQR_MERCHANT_ID", ""),
			"client_id":       config.Env("YOMA_MMQR_CLIENT_ID", ""),
			"client_secret":   config.Env("YOMA_MMQR_CLIENT_SECRET", ""),
			"webhook_hashkey": config.Env("YOMA_MMQR_WEBHOOK_HASHKEY", ""),
			"webhook_secret":  config.Env("YOMA_MMQR_WEBHOOK_SECRET", ""),
			"api_version":     config.Env("YOMA_MMQR_API_VERSION", ""),
			"base_url":        config.Env("YOMA_MMQR_BASE_URL", ""),
		},

		"cyber_source": map[string]any{
			"profile_id": config.Env("CYBER_SOURCE_PROFILE_ID", ""),
			"access_key": config.Env("CYBER_SOURCE_ACCESS_KEY", ""),
			"secret_key": config.Env("CYBER_SOURCE_SECRET_KEY", ""),
			"base_url":   config.Env("CYBER_SOURCE_BASE_URL", ""),
		},

		// HTTP
		//
		// Gateway calls go through Goravel's HTTP client, so facades.Http().Fake()
		// intercepts them in tests. "client" names an entry of http.clients
		// (empty means the default client). "timeout" is the seconds KBZ Pay,
		// Wave Pay, AYA Pay and Yoma MMQR calls may take (30 when empty).
		"http": map[string]any{
			"client":  config.Env("MYANMAR_PAYMENTS_HTTP_CLIENT", ""),
			"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", 30),
		},

		// Cache
		//
		// The cache store that keeps Yoma MMQR access tokens between requests
		// and processes. Empty uses your default store.
		"cache_store": config.Env("MYANMAR_PAYMENTS_CACHE_STORE", ""),

		// Auto-submit Form Route
		//
		// AYA Pay and CyberSource need the customer's browser to POST a signed
		// form. This route renders that form and submits it, so a handler can
		// redirect to payments.AutoSubmitURL(form). Links are encrypted with
		// APP_KEY and expire after "ttl_minutes" (required to create a link).
		// "base_url" starts the links.
		"form_route": map[string]any{
			"enabled":     true,
			"path":        "myanmar-payments/form",
			"middleware":  []contractshttp.Middleware{},
			"ttl_minutes": config.Env("MYANMAR_PAYMENTS_FORM_TTL_MINUTES", ""),
			"base_url":    config.Env("APP_URL", "http://localhost"),
		},
	})
}
```

## HTTP Client

Gateway calls go through Goravel's HTTP client, so `Fake()` intercepts them in tests; see [Testing](/goravel-myanmar-payments/testing). `client` names an entry of `http.clients` in `config/http.go` (empty means the default client), so its transport settings (connection pool, telemetry) apply. `timeout` is in seconds, applies to gateway calls only and defaults to 30 (`payments.DefaultHTTPTimeoutSeconds`) when it is missing or blank; a value that is not a whole number greater than 0 returns `myanmarpayments: The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` when you first request KBZ Pay.

## Auto-submit Form Route

AYA Pay and CyberSource need the customer's browser to POST a signed form. The package registers a `GET /myanmar-payments/form` route (named `myanmar-payments.form`) that renders that form and submits it, and `payments.AutoSubmitURL(form)` returns an encrypted link to it. Links expire after `ttl_minutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store` and `Referrer-Policy: strict-origin`, so the gateway sees only your origin, never the encrypted link.

| Key | Meaning |
|---|---|
| `enabled` | Register the route. When `false`, `AutoSubmitURL` returns `payments.ErrFormRouteDisabled`; build the form yourself, see [Form Payments](/goravel-myanmar-payments/payment-flows#form-payments) |
| `path` | The route path |
| `middleware` | Middleware for the route, e.g. rate limiting. Don't add authentication: the customer may arrive from a gateway or another device |
| `ttl_minutes` | Minutes a link stays valid. Required to create a link: without it `AutoSubmitURL` returns a `*myanmarpayments.ConfigurationError` with `form_route` and `ttl_minutes` (`The form_route configuration is missing [ttl_minutes].`), with `Invalid` set for a value that is not a whole number greater than 0 |
| `base_url` | The scheme and host links start with. Falls back to `http.url`, then `APP_URL` |

Links are encrypted with Goravel's crypt facade (`APP_KEY`); without it, `AutoSubmitURL` returns `payments.ErrCryptNotAvailable`.

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. They are kept in your default cache store, or in `cache_store` when set. Use a shared store (Redis, database) when you run more than one server. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseURL|clientID)>`, the same key in every Laranex SDK, so services written in different languages can share one store. Without the cache facade, each process keeps its own token in memory.
