---
title: Upgrading
description: Upgrade Laravel New Relic from v1 to v4. New class names, config/newrelic.php, new publish tags and a required license key.
---

# Upgrading to v4 from v1

Versions 2 and 3 were never released; v4.0.0 follows v1.0.0 directly so every Laranex package shares the same major.

```bash
composer require laranex/laravel-newrelic:^4.0
```

## Requirements

PHP 8.1+ and Laravel 10 to 13 (v1 allowed PHP 7.4). Monolog `^3.6` is required (v1 allowed `^3.0`), and `ext-curl` is now a Composer requirement instead of a check when the handler is built. The New Relic PHP agent stays optional: without it, logs still ship and the transaction listeners do nothing.

## Renamed classes

| Before (v1) | After (v4) |
|---|---|
| `LaravelNewrelicServiceProvider` | `NewRelicServiceProvider` |
| `LaravelNewrelicLogger` | `Logging\NewRelicLogger` |
| `Handler` / `AbstractHandler` | `Logging\NewRelicHandler` |
| `Formatter` / `AbstractFormatter` | `Logging\NewRelicFormatter` |
| `Processor` | `Logging\NewRelicProcessor` |
| `Listeners\StartNewrelicWebTransaction` | `Listeners\StartWebTransaction` |
| `Listeners\StopNewrelicWebTransaction` | `Listeners\EndTransaction` |
| `Listeners\RestartNewrelicTransaction` | None: the New Relic agent names queue job transactions itself |

All classes are in the `Laranex\LaravelNewrelic` namespace. `EventMap` and `LaravelNewrelic` were removed.

- The service provider is auto-discovered; update it only if you registered it manually.
- In a custom channel, replace `'via' => Laranex\LaravelNewrelic\LaravelNewrelicLogger::class` with `'via' => Laranex\LaravelNewrelic\Logging\NewRelicLogger::class`.
- `NewRelicHandler` takes a `Contracts\LogTransport` and the license key in its constructor instead of `setLicenseKey()` / `setHost()`.
- The listeners depend on `Contracts\Agent` and no longer call `newrelic_*` functions directly.

## Configuration

The config file moved from `config/laravel-newrelic.php` to `config/newrelic.php`, and the publish tag changed from `laravel-newrelic` to `newrelic-config` (or `newrelic`).

- Rename a published `config/laravel-newrelic.php` to `config/newrelic.php`, or re-publish it with `php artisan vendor:publish --tag="newrelic-config"`.
- Replace `config('laravel-newrelic.*')` reads with `config('newrelic.*')`.
- `NEW_RELIC_API_KEY` still works, but `NEW_RELIC_LICENSE_KEY` is the new name.
- New keys: `host` (`NEW_RELIC_LOG_HOST`), `app_name` (`NEW_RELIC_APP_NAME`), `transactions.octane` (`NEW_RELIC_OCTANE_TRANSACTIONS`) and `transport.timeout` / `transport.retries` (`NEW_RELIC_LOG_TIMEOUT` / `NEW_RELIC_LOG_RETRIES`). See [Usage](./usage#configuration).

## Behavior changes

- **Missing license key.** v1 posted logs with a `NO_LICENSE_KEY_FOUND` key. v4 throws when the channel is built, and Laravel falls back to its emergency logger. Set `NEW_RELIC_LICENSE_KEY` or configure the agent's `newrelic.license`.
- **Logs API host.** As in v1, the host is picked from the license key's region (`log-api.eu.newrelic.com` for EU keys). v1 could only override it with `setHost()` on the handler; v4 reads `NEW_RELIC_LOG_HOST`.
- **Channel options.** v1 ignored the channel config. The default `newrelic` channel now has `'level' => 'debug'` and `'buffer' => true`, and the `level`, `bubble`, `buffer` and `name` options are honored.
- **Delivery failures.** When the Logs API cannot be reached or rejects a request, v4 writes the failure to PHP's error log instead of throwing from the log call, and splits batches bigger than the 1 MB payload limit.
- **Batches.** v1 always buffered and never flushed the buffer itself, so a queue worker held its logs until it exited. v4 sends the buffered batch (one JSON array) after each Octane request and queue job, and `'buffer' => false` sends each record immediately.
- **Metadata.** `service`, `hostname`, the client IP and the authenticated user are resolved per record, so they are correct on Octane. The agent's `hostname` now wins over the PHP hostname so logs link to the right host entity. A user without a readable email is logged with `email: null` instead of `'guest'`, and the user `id` comes from `getAuthIdentifier()`.
- **Queue transactions.** v4 no longer touches queue job transactions. v1 ended the transaction and started a new one after each processed job and Horizon release, but those listeners run inside the transaction the New Relic agent already opens for each job, so they cut the agent's job transaction short and left a duplicate, unnamed one. Each job is now reported only by the agent, as a background transaction named `JobClass (connection)` (for example `App\Jobs\SendInvoice (redis)`) that also records the job's exception when it fails. The package still sends the buffered logs after each job. If you upgrade from `v4.0.0-alpha.1`, remove `NEW_RELIC_QUEUE_TRANSACTIONS` from `.env` and `transactions.queue` from a published `config/newrelic.php`; the setting is gone.
- **Octane transactions.** Octane web transactions are reported to `NEW_RELIC_APP_NAME` when set (v1 always used the agent's `newrelic.appname`) and are named after the request's route (route name, controller action, or method and URI pattern; `unknown` without a route) instead of the worker script. The Octane listeners can be turned off with `newrelic.transactions.octane` (`NEW_RELIC_OCTANE_TRANSACTIONS`).
