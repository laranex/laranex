---
title: Configuration
description: Configure Goravel Myanmar Payments with environment variables or config/myanmar_payments.go. Every setting of the gateways you use is required; endpoints default to production.
---

# Configuration

## Environment Variables

Add the keys of the gateways you use. Every setting of those gateways is required except the URL overrides and Yoma's webhook secret: there are no defaults. A gateway is configured the first time you request it, and a missing or blank setting returns a `*myanmarpayments.ConfigurationError` naming it, e.g. `myanmarpayments: The kbz_pay configuration is missing [app_key].` The time settings must be whole numbers greater than 0; any other value returns the same error with `Invalid` set and the message `myanmarpayments: The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.`

The variable names are the ones the [Go SDK](/go-myanmar-payments/configuration) reads and the same as [Laravel Myanmar Payments](/laravel-myanmar-payments/configuration), so one `.env` works for both. The values after `=` are examples:

```env
# Every gateway that calls an API (all but CyberSource)
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

# CyberSource Secure Acceptance
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional override
```

## Settings

| Variable | Config key | Required | Description |
|---|---|---|---|
| `MYANMAR_PAYMENTS_HTTP_TIMEOUT` | `http.timeout` | Yes | Seconds before a gateway call gives up. Given to every gateway except CyberSource as its `timeout_in_seconds` |
| `MYANMAR_PAYMENTS_FORM_TTL_MINUTES` | `form_route.ttl_minutes` | Yes | Minutes an auto-submit form link stays valid. Needed by AYA Pay and CyberSource while the form route is enabled |
| `MYANMAR_PAYMENTS_HTTP_CLIENT` | `http.client` | No | An entry of `http.clients` in `config/http.go`; empty means the default client |
| `MYANMAR_PAYMENTS_CACHE_STORE` | `cache_store` | No | Cache store for Yoma MMQR access tokens; empty means the default store |
| `KBZ_PAY_APP_ID` | `kbz_pay.app_id` | Yes | `appid` issued by KBZ |
| `KBZ_PAY_APP_KEY` | `kbz_pay.app_key` | Yes | Secret key used to sign requests |
| `KBZ_PAY_MERCHANT_CODE` | `kbz_pay.merchant_code` | Yes | `merch_code` issued by KBZ |
| `KBZ_PAY_BASE_URL` | `kbz_pay.api_url` | No | Override the API base URL |
| `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbz_pay.pwa_url` | No | Override the PWA checkout URL |
| `WAVE_MONEY_MERCHANT_ID` | `wave_money.merchant_id` | Yes | Merchant ID issued by Wave |
| `WAVE_MONEY_SECRET_KEY` | `wave_money.secret_key` | Yes | Hash secret key issued by Wave |
| `WAVE_MONEY_MERCHANT_NAME` | `wave_money.merchant_name` | Yes | Shown on Wave's payment page |
| `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` | `wave_money.time_to_live_in_seconds` | Yes | Seconds the customer has to pay |
| `WAVE_MONEY_BASE_URL` | `wave_money.base_url` | No | Override the API base URL |
| `WAVE_MONEY_AUTHENTICATE_URL` | `wave_money.authenticate_url` | No | Override the host the customer is redirected to |
| `AYA_PAY_APP_KEY` | `aya_pay.app_key` | Yes | Public application key |
| `AYA_PAY_APP_SECRET` | `aya_pay.app_secret` | Yes | Secret used for checksums |
| `AYA_PAY_BASE_URL` | `aya_pay.base_url` | No | Override the gateway base URL |
| `YOMA_MMQR_MERCHANT_ID` | `yoma_mmqr.merchant_id` | Yes | Merchant ID issued by Yoma |
| `YOMA_MMQR_CLIENT_ID` | `yoma_mmqr.client_id` | Yes | OAuth client ID |
| `YOMA_MMQR_CLIENT_SECRET` | `yoma_mmqr.client_secret` | Yes | OAuth client secret |
| `YOMA_MMQR_WEBHOOK_HASHKEY` | `yoma_mmqr.webhook_hashkey` | Yes | Hash key issued by Yoma for verifying callbacks |
| `YOMA_MMQR_API_VERSION` | `yoma_mmqr.api_version` | Yes | The `{version}` segment of Yoma's API paths, e.g. `v1rc` |
| `YOMA_MMQR_WEBHOOK_SECRET` | `yoma_mmqr.webhook_secret` | No | When set, callbacks must carry it in `X-Webhook-Secret` |
| `YOMA_MMQR_BASE_URL` | `yoma_mmqr.base_url` | No | Override the API base URL |
| `CYBER_SOURCE_PROFILE_ID` | `cyber_source.profile_id` | Yes | Secure Acceptance profile ID |
| `CYBER_SOURCE_ACCESS_KEY` | `cyber_source.access_key` | Yes | Profile access key |
| `CYBER_SOURCE_SECRET_KEY` | `cyber_source.secret_key` | Yes | Profile secret key used to sign fields |
| `CYBER_SOURCE_BASE_URL` | `cyber_source.base_url` | No | Override the Secure Acceptance base URL |

Only the gateways you call need their settings: an app that only uses KBZ Pay never reads the Wave Money keys.

## Endpoints

Every gateway uses its production endpoints. There is no switch between test and production: to test against a gateway's UAT environment, or to go through a proxy, set the URL overrides (see [Testing Against UAT](#testing-against-uat)). A blank override means unset.

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

## Testing Against UAT

Each gateway issues separate UAT credentials. To use them, set the URL overrides to the gateway's UAT endpoints together with the UAT credentials:

| Gateway | Variable | Config key | UAT value |
|---|---|---|---|
| KBZ Pay | `KBZ_PAY_BASE_URL` | `kbz_pay.api_url` | `http://api-uat.kbzpay.com/payment/gateway/uat` |
| KBZ Pay | `KBZ_PAY_PWA_BASE_REDIRECT_URL` | `kbz_pay.pwa_url` | `https://static.kbzpay.com/pgw/uat/pwa/#/` |
| Wave Money | `WAVE_MONEY_BASE_URL` | `wave_money.base_url` | `https://preprodpayments.wavemoney.io:8107` |
| Wave Money | `WAVE_MONEY_AUTHENTICATE_URL` | `wave_money.authenticate_url` | `https://preprodpayments.wavemoney.io` |
| AYA Payment Gateway | `AYA_PAY_BASE_URL` | `aya_pay.base_url` | `https://uat-pgw.ayainnovation.com` |
| Yoma MMQR | `YOMA_MMQR_BASE_URL` | `yoma_mmqr.base_url` | `https://devapi.yomabank.net` |
| CyberSource | `CYBER_SOURCE_BASE_URL` | `cyber_source.base_url` | `https://testsecureacceptance.cybersource.com` |

Wave serves its API on port `8107` and the page the customer is redirected to on the same host without the port. Remove the overrides, and switch to the production credentials, when you go live. Quote the KBZ PWA URL in `.env`, because of its `#`:

```env
# UAT
KBZ_PAY_BASE_URL=http://api-uat.kbzpay.com/payment/gateway/uat
KBZ_PAY_PWA_BASE_REDIRECT_URL="https://static.kbzpay.com/pgw/uat/pwa/#/"
WAVE_MONEY_BASE_URL=https://preprodpayments.wavemoney.io:8107
WAVE_MONEY_AUTHENTICATE_URL=https://preprodpayments.wavemoney.io
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
		"kbz_pay": map[string]any{
			"app_id":        config.Env("KBZ_PAY_APP_ID", ""),
			"app_key":       config.Env("KBZ_PAY_APP_KEY", ""),
			"merchant_code": config.Env("KBZ_PAY_MERCHANT_CODE", ""),
			"api_url":       config.Env("KBZ_PAY_BASE_URL", ""),
			"pwa_url": config.Env(
				"KBZ_PAY_PWA_BASE_REDIRECT_URL", "",
			),
		},

		"wave_money": map[string]any{
			"merchant_id": config.Env("WAVE_MONEY_MERCHANT_ID", ""),
			"secret_key":  config.Env("WAVE_MONEY_SECRET_KEY", ""),
			"merchant_name": config.Env(
				"WAVE_MONEY_MERCHANT_NAME", "",
			),
			"time_to_live_in_seconds": config.Env(
				"WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS", "",
			),
			"base_url": config.Env("WAVE_MONEY_BASE_URL", ""),
			"authenticate_url": config.Env(
				"WAVE_MONEY_AUTHENTICATE_URL", "",
			),
		},

		"aya_pay": map[string]any{
			"app_key": config.Env(
				"AYA_PAY_APP_KEY", config.Env("AYA_PGW_APP_KEY", ""),
			),
			"app_secret": config.Env(
				"AYA_PAY_APP_SECRET", config.Env("AYA_PGW_APP_SECRET", ""),
			),
			"base_url": config.Env(
				"AYA_PAY_BASE_URL", config.Env("AYA_PGW_BASE_URL", ""),
			),
		},

		"yoma_mmqr": map[string]any{
			"merchant_id":   config.Env("YOMA_MMQR_MERCHANT_ID", ""),
			"client_id":     config.Env("YOMA_MMQR_CLIENT_ID", ""),
			"client_secret": config.Env("YOMA_MMQR_CLIENT_SECRET", ""),
			"webhook_hashkey": config.Env(
				"YOMA_MMQR_WEBHOOK_HASHKEY", "",
			),
			"webhook_secret": config.Env("YOMA_MMQR_WEBHOOK_SECRET", ""),
			"base_url":       config.Env("YOMA_MMQR_BASE_URL", ""),
			"api_version":    config.Env("YOMA_MMQR_API_VERSION", ""),
		},

		"cyber_source": map[string]any{
			"profile_id": config.Env("CYBER_SOURCE_PROFILE_ID", ""),
			"access_key": config.Env("CYBER_SOURCE_ACCESS_KEY", ""),
			"secret_key": config.Env("CYBER_SOURCE_SECRET_KEY", ""),
			"base_url":   config.Env("CYBER_SOURCE_BASE_URL", ""),
		},

		"http": map[string]any{
			"client":  config.Env("MYANMAR_PAYMENTS_HTTP_CLIENT", ""),
			"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", ""),
		},

		"cache_store": config.Env("MYANMAR_PAYMENTS_CACHE_STORE", ""),

		"form_route": map[string]any{
			"enabled":     true,
			"path":        "myanmar-payments/form",
			"middleware":  []contractshttp.Middleware{},
			"ttl_minutes": config.Env(
				"MYANMAR_PAYMENTS_FORM_TTL_MINUTES", "",
			),
			"base_url":    config.Env("APP_URL", "http://localhost"),
		},
	})
}
```

`yourapp/app/facades` is the `facades` package Goravel generates in your app; `package:install` fills in the right import.

## HTTP Client

```go
"http": map[string]any{
	"client":  config.Env("MYANMAR_PAYMENTS_HTTP_CLIENT", ""),
	"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", ""),
},
```

Gateway calls go through Goravel's HTTP client, so `Fake()` intercepts them in tests; see [Testing](/goravel-myanmar-payments/testing). `client` names an entry of `http.clients` in `config/http.go` (empty means the default client), so its transport settings (connection pool, telemetry) apply. `timeout` is in seconds, applies to gateway calls only and is required: the package passes it to KBZ Pay, Wave Money, AYA and Yoma MMQR as their `TimeoutSeconds`, so a missing one returns `myanmarpayments: The kbz_pay configuration is missing [timeout_in_seconds].` when you first request KBZ Pay. When a gateway can't be reached, the call returns an `*APIError` with `HTTPStatus` `0`.

## Auto-submit Form Route

```go
"form_route": map[string]any{
	"enabled":     true,
	"path":        "myanmar-payments/form",
	"middleware":  []contractshttp.Middleware{},
	"ttl_minutes": config.Env("MYANMAR_PAYMENTS_FORM_TTL_MINUTES", ""),
	"base_url":    config.Env("APP_URL", "http://localhost"),
},
```

AYA Pay and CyberSource need the customer's browser to POST a signed form. The package registers a `GET /myanmar-payments/form` route (named `myanmar-payments.form`) that renders that form and submits it, and `payments.AutoSubmitURL(form)` returns an encrypted link to it. Links expire after `ttl_minutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store`.

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
