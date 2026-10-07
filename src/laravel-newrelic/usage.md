---
title: Usage
description: Configure the New Relic license key and understand what the log channel and transaction listeners do.
---

# Usage

## License Key

The channel sends logs to the New Relic Log API (`log-api.newrelic.com`). The license key is read from the PHP agent's `newrelic.license` INI setting, or from your environment:

```env
NEW_RELIC_API_KEY="your_license_key"
```

To publish the config file (optional):

```bash
php artisan vendor:publish --tag="laravel-newrelic"
```

## What Gets Logged

Logs are buffered and sent at the end of the request. Each record gets extra metadata:

| Field | Value |
|---|---|
| `service` | `config('app.name')` |
| `hostname` | The server's hostname |
| `ip` | The client IP, when there is a request |
| `user` | The authenticated user's `id` and `email`, when logged in |

## Transactions

When the `newrelic` extension is loaded, the package starts and ends transactions so long-running workers report per unit of work:

| Event | Effect |
|---|---|
| Octane `WorkerStarting`, `RequestTerminated` | End the current transaction |
| Octane `RequestReceived` | Start a new web transaction |
| Queue `JobProcessed`, Horizon `JobReleased` | End and restart the transaction |

## Why Not the New Relic Monolog Enricher?

The [New Relic Monolog Enricher](https://github.com/newrelic/newrelic-monolog-logenricher-php) does not support Monolog 3, which current Laravel versions use. This package provides a channel built for it.
