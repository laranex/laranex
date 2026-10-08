---
title: Configuration
description: Configure each gateway through config/myanmar_payments.go or the Go SDK's environment variables, plus the HTTP client, the Yoma token cache store and the auto-submit form route.
---

# Configuration

`config/myanmar_payments.go` maps environment variables onto the `myanmar_payments` config. The variable names are the ones the [Go SDK](/go-myanmar-payments/configuration) reads and the same as [Laravel Myanmar Payments](/laravel-myanmar-payments/introduction), so one `.env` works for all three.

A published value wins; when a value is empty or the file is not published, the package falls back to the SDK's environment variable. Only the gateways you call need credentials: a gateway with a missing credential returns a `*myanmarpayments.ConfigurationError` when you first request it.

## Gateways

Every gateway has `sandbox` (default `true`), which selects its UAT endpoints. Set it to `false` together with production credentials when you go live. URL overrides are optional.

### KBZ Pay

| Key | Environment variable |
|---|---|
| `kbz_pay.sandbox` | `KBZ_PAY_SANDBOX` |
| `kbz_pay.app_id` | `KBZ_PAY_APP_ID` |
| `kbz_pay.app_key` | `KBZ_PAY_APP_KEY` |
| `kbz_pay.merchant_code` | `KBZ_PAY_MERCHANT_CODE` |
| `kbz_pay.api_url` | `KBZ_PAY_BASE_URL` |
| `kbz_pay.pwa_url` | `KBZ_PAY_PWA_BASE_REDIRECT_URL` |

### Wave Money

| Key | Environment variable |
|---|---|
| `wave_money.sandbox` | `WAVE_MONEY_SANDBOX` |
| `wave_money.merchant_id` | `WAVE_MONEY_MERCHANT_ID` |
| `wave_money.secret_key` | `WAVE_MONEY_SECRET_KEY` |
| `wave_money.merchant_name` | `WAVE_MONEY_MERCHANT_NAME`, falling back to `APP_NAME` (`app.name`) |
| `wave_money.time_to_live_in_seconds` | `WAVE_MONEY_TIME_TO_LIVE_IN_SECONDS` (default 300) |
| `wave_money.base_url` | `WAVE_MONEY_BASE_URL` |
| `wave_money.authenticate_url` | `WAVE_MONEY_AUTHENTICATE_URL` |

### AYA Pay

| Key | Environment variable |
|---|---|
| `aya_pay.sandbox` | `AYA_PAY_SANDBOX` |
| `aya_pay.app_key` | `AYA_PAY_APP_KEY`, falling back to `AYA_PGW_APP_KEY` |
| `aya_pay.app_secret` | `AYA_PAY_APP_SECRET`, falling back to `AYA_PGW_APP_SECRET` |
| `aya_pay.base_url` | `AYA_PAY_BASE_URL`, falling back to `AYA_PGW_BASE_URL` |

### Yoma MMQR

| Key | Environment variable |
|---|---|
| `yoma_mmqr.sandbox` | `YOMA_MMQR_SANDBOX` |
| `yoma_mmqr.merchant_id` | `YOMA_MMQR_MERCHANT_ID` |
| `yoma_mmqr.client_id` | `YOMA_MMQR_CLIENT_ID` |
| `yoma_mmqr.client_secret` | `YOMA_MMQR_CLIENT_SECRET` |
| `yoma_mmqr.webhook_hashkey` | `YOMA_MMQR_WEBHOOK_HASHKEY` |
| `yoma_mmqr.webhook_secret` | `YOMA_MMQR_WEBHOOK_SECRET` (optional; when set, callbacks must carry it in `X-Webhook-Secret`) |
| `yoma_mmqr.base_url` | `YOMA_MMQR_BASE_URL` |
| `yoma_mmqr.api_version` | `YOMA_MMQR_API_VERSION` (default `v1rc`) |

### CyberSource

| Key | Environment variable |
|---|---|
| `cyber_source.sandbox` | `CYBER_SOURCE_SANDBOX` |
| `cyber_source.profile_id` | `CYBER_SOURCE_PROFILE_ID` |
| `cyber_source.access_key` | `CYBER_SOURCE_ACCESS_KEY` |
| `cyber_source.secret_key` | `CYBER_SOURCE_SECRET_KEY` |
| `cyber_source.base_url` | `CYBER_SOURCE_BASE_URL` |

Each gateway's credentials, endpoints and limits are described in the SDK's driver pages: [KBZ Pay](/go-myanmar-payments/drivers/kbz-pay), [Wave Money](/go-myanmar-payments/drivers/wave-money), [AYA Pay](/go-myanmar-payments/drivers/aya-pay), [Yoma MMQR](/go-myanmar-payments/drivers/yoma-mmqr) and [CyberSource](/go-myanmar-payments/drivers/cyber-source).

## HTTP

```go
"http": map[string]any{
	"client":  config.Env("MYANMAR_PAYMENTS_HTTP_CLIENT", ""),
	"timeout": config.Env("MYANMAR_PAYMENTS_HTTP_TIMEOUT", 30),
},
```

Gateway calls go through Goravel's HTTP client. `client` names an entry of `http.clients` in `config/http.go` (empty means the default client), so its transport settings (connection pool, telemetry) apply. `timeout` is in seconds and overrides the client's own timeout for gateway calls only. Because every request uses the Goravel client's transport, `facades.Http().Fake()` intercepts gateway calls in tests; see [Testing](/goravel-myanmar-payments/testing).

## Cache

```go
"cache_store": config.Env("MYANMAR_PAYMENTS_CACHE_STORE", ""),
```

Yoma MMQR uses OAuth access tokens. They are kept in this Goravel cache store (empty means your default store), so every process that shares the store also shares the token. Use a shared store such as Redis when you run more than one instance.

## Auto-submit form route

```go
"form_route": map[string]any{
	"enabled":     true,
	"path":        "myanmar-payments/form",
	"middleware":  []contractshttp.Middleware{},
	"ttl_minutes": 30,
	"base_url":    config.Env("APP_URL", "http://localhost"),
},
```

AYA Pay and CyberSource need the customer's browser to POST a signed form. When `enabled` is true the provider registers `GET /myanmar-payments/form` (named `myanmar-payments.form`), which renders such a form and submits it. `payments.AutoSubmitURL(form)` builds links to it; see [Form payments](/goravel-myanmar-payments/usage#form-payments-aya-pay-and-cybersource).

| Key | Meaning |
|---|---|
| `enabled` | Register the route. When false, `AutoSubmitURL` returns `payments.ErrFormRouteDisabled` |
| `path` | The route path |
| `middleware` | Middleware for the route, e.g. rate limiting. Don't add authentication: the customer may be redirected from a gateway or another device |
| `ttl_minutes` | How long a link stays valid |
| `base_url` | The scheme and host links start with. Falls back to `http.url`, then `APP_URL` |
