---
title: Configuration
description: Configure Goravel Myanmar Payments with environment variables or config/myanmar_payments.go. Each gateway has a sandbox switch that selects its UAT endpoints; only the gateways you use need credentials.
---

# Configuration

## Environment Variables

Add only the keys of the gateways you use. A gateway is configured the first time you request it, and a missing credential returns a `*myanmarpayments.ConfigurationError` naming the key.

Every gateway has a `*_SANDBOX` switch (default `true`) that selects its UAT endpoints. It accepts `true`, `1`, `t`, `yes`, `on` or `false`, `0`, `f`, `no`, `off` in any case; anything else keeps the sandbox. A `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` of zero or less falls back to `300`. Set it to `false` together with production credentials when you go live. The `*_BASE_URL` style variables are optional overrides.

The variable names are the ones the [Go SDK](/go-myanmar-payments/configuration) reads and the same as [Laravel Myanmar Payments](/laravel-myanmar-payments/configuration), so one `.env` works for both.

```env
# KBZ Pay
KBZ_PAY_SANDBOX=true
KBZ_PAY_APP_ID=
KBZ_PAY_APP_KEY=
KBZ_PAY_MERCHANT_CODE=
KBZ_PAY_BASE_URL=                     # optional API URL override
KBZ_PAY_PWA_BASE_REDIRECT_URL=        # optional PWA URL override

# Wave Money
WAVE_MONEY_SANDBOX=true
WAVE_MONEY_MERCHANT_ID=
WAVE_MONEY_SECRET_KEY=
WAVE_MONEY_MERCHANT_NAME=             # defaults to APP_NAME
WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS=300
WAVE_MONEY_BASE_URL=                  # optional
WAVE_MONEY_AUTHENTICATE_URL=          # optional customer redirect host override

# AYA Payment Gateway (AYA_PGW_* names are accepted as fallbacks)
AYA_PAY_SANDBOX=true
AYA_PAY_APP_KEY=
AYA_PAY_APP_SECRET=
AYA_PAY_BASE_URL=                     # optional

# Yoma MMQR
YOMA_MMQR_SANDBOX=true
YOMA_MMQR_MERCHANT_ID=
YOMA_MMQR_CLIENT_ID=
YOMA_MMQR_CLIENT_SECRET=
YOMA_MMQR_WEBHOOK_HASHKEY=
# optional, checks the X-Webhook-Secret header
YOMA_MMQR_WEBHOOK_SECRET=
YOMA_MMQR_BASE_URL=                   # optional override
YOMA_MMQR_API_VERSION=v1rc

# CyberSource Secure Acceptance
CYBER_SOURCE_SANDBOX=true
CYBER_SOURCE_PROFILE_ID=
CYBER_SOURCE_ACCESS_KEY=
CYBER_SOURCE_SECRET_KEY=
CYBER_SOURCE_BASE_URL=                # optional

# Package
MYANMAR_PAYMENTS_HTTP_TIMEOUT=30
# an http.clients entry, empty = default client
MYANMAR_PAYMENTS_HTTP_CLIENT=
# store for Yoma access tokens, empty = default store
MYANMAR_PAYMENTS_CACHE_STORE=
```

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

Overriding a base URL (e.g. to go through a proxy) does not switch the environment: keep `*_SANDBOX` in line with the credentials and host you use, so the other endpoints of that gateway (such as Wave's authenticate redirect or KBZ's PWA page) match.

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
			"sandbox":       config.Env("KBZ_PAY_SANDBOX", true),
			"app_id":        config.Env("KBZ_PAY_APP_ID", ""),
			"app_key":       config.Env("KBZ_PAY_APP_KEY", ""),
			"merchant_code": config.Env("KBZ_PAY_MERCHANT_CODE", ""),
			"api_url":       config.Env("KBZ_PAY_BASE_URL", ""),
			"pwa_url": config.Env(
				"KBZ_PAY_PWA_BASE_REDIRECT_URL", "",
			),
		},

		"wave_money": map[string]any{
			"sandbox":     config.Env("WAVE_MONEY_SANDBOX", true),
			"merchant_id": config.Env("WAVE_MONEY_MERCHANT_ID", ""),
			"secret_key":  config.Env("WAVE_MONEY_SECRET_KEY", ""),
			"merchant_name": config.Env(
				"WAVE_MONEY_MERCHANT_NAME",
				config.Env("APP_NAME", ""),
			),
			"time_to_live_in_seconds": config.Env(
				"WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS",
				300,
			),
			"base_url": config.Env("WAVE_MONEY_BASE_URL", ""),
			"authenticate_url": config.Env(
				"WAVE_MONEY_AUTHENTICATE_URL", "",
			),
		},

		"aya_pay": map[string]any{
			"sandbox": config.Env("AYA_PAY_SANDBOX", true),
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
			"sandbox":       config.Env("YOMA_MMQR_SANDBOX", true),
			"merchant_id":   config.Env("YOMA_MMQR_MERCHANT_ID", ""),
			"client_id":     config.Env("YOMA_MMQR_CLIENT_ID", ""),
			"client_secret": config.Env("YOMA_MMQR_CLIENT_SECRET", ""),
			"webhook_hashkey": config.Env(
				"YOMA_MMQR_WEBHOOK_HASHKEY", "",
			),
			"webhook_secret": config.Env("YOMA_MMQR_WEBHOOK_SECRET", ""),
			"base_url":       config.Env("YOMA_MMQR_BASE_URL", ""),
			"api_version":    config.Env("YOMA_MMQR_API_VERSION", "v1rc"),
		},

		"cyber_source": map[string]any{
			"sandbox":    config.Env("CYBER_SOURCE_SANDBOX", true),
			"profile_id": config.Env("CYBER_SOURCE_PROFILE_ID", ""),
			"access_key": config.Env("CYBER_SOURCE_ACCESS_KEY", ""),
			"secret_key": config.Env("CYBER_SOURCE_SECRET_KEY", ""),
			"base_url":   config.Env("CYBER_SOURCE_BASE_URL", ""),
		},

		"http": map[string]any{
			"client":  config.Env("MYANMAR_PAYMENTS_HTTP_CLIENT", ""),
			"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", 30),
		},

		"cache_store": config.Env("MYANMAR_PAYMENTS_CACHE_STORE", ""),

		"form_route": map[string]any{
			"enabled":     true,
			"path":        "myanmar-payments/form",
			"middleware":  []contractshttp.Middleware{},
			"ttl_minutes": 30,
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
	"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", 30),
},
```

Gateway calls go through Goravel's HTTP client, so `Fake()` intercepts them in tests; see [Testing](/goravel-myanmar-payments/testing). `client` names an entry of `http.clients` in `config/http.go` (empty means the default client), so its transport settings (connection pool, telemetry) apply. `timeout` is in seconds and applies to gateway calls only. When a gateway can't be reached, the call returns an `*APIError` with `HTTPStatus` `0`.

## Auto-submit Form Route

```go
"form_route": map[string]any{
	"enabled":     true,
	"path":        "myanmar-payments/form",
	"middleware":  []contractshttp.Middleware{},
	"ttl_minutes": 30,
	"base_url":    config.Env("APP_URL", "http://localhost"),
},
```

AYA Pay and CyberSource need the customer's browser to POST a signed form. The package registers a `GET /myanmar-payments/form` route (named `myanmar-payments.form`) that renders that form and submits it, and `payments.AutoSubmitURL(form)` returns an encrypted link to it. Links expire after `ttl_minutes`; an invalid or expired link answers `410 Gone`. The page is sent with `Cache-Control: no-store`.

| Key | Meaning |
|---|---|
| `enabled` | Register the route. When `false`, `AutoSubmitURL` returns `payments.ErrFormRouteDisabled`; build the form yourself, see [Form Payments](/goravel-myanmar-payments/payment-flows#form-payments) |
| `path` | The route path |
| `middleware` | Middleware for the route, e.g. rate limiting. Don't add authentication: the customer may arrive from a gateway or another device |
| `ttl_minutes` | How long a link stays valid |
| `base_url` | The scheme and host links start with. Falls back to `http.url`, then `APP_URL` |

Links are encrypted with Goravel's crypt facade (`APP_KEY`); without it, `AutoSubmitURL` returns `payments.ErrCryptNotAvailable`.

## Cache

Yoma MMQR access tokens last several hours and are reused until they expire. They are kept in your default cache store, or in `cache_store` when set. Use a shared store (Redis, database) when you run more than one server. The token is stored under `myanmar-payments.yoma-mmqr.token.<sha256(baseURL|clientID)>`, the same key in every Laranex SDK, so services written in different languages can share one store. Without the cache facade, each process keeps its own token in memory.
