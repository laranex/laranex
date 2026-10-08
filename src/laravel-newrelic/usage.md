---
title: Usage
description: Configure the newrelic log channel, the Logs API host and the Octane and queue transaction listeners.
---

# Usage

Log as usual once `LOG_CHANNEL=newrelic` is set, or log to the channel explicitly or in a stack:

```php
use Illuminate\Support\Facades\Log;

Log::info('Order placed', ['order_id' => $order->id]);

Log::channel('newrelic')->error('Payment failed', ['exception' => $e]);
```

## Configuration

| Key | Env | Default | Description |
|---|---|---|---|
| `license_key` | `NEW_RELIC_LICENSE_KEY` (or `NEW_RELIC_API_KEY`) | `null` | License (ingest) key for the Logs API. Falls back to the agent's `newrelic.license` INI value. |
| `host` | `NEW_RELIC_LOG_HOST` | `null` | Logs API host. When empty, it is picked from the license key's region. |
| `app_name` | `NEW_RELIC_APP_NAME` | `null` | APM application that Octane and queue transactions are reported to. Falls back to the agent's `newrelic.appname` INI value. |
| `transactions.octane` | `NEW_RELIC_OCTANE_TRANSACTIONS` | `true` | One web transaction per Octane request. Cast to a boolean. |
| `transactions.queue` | `NEW_RELIC_QUEUE_TRANSACTIONS` | `true` | One background transaction per processed queue job. Cast to a boolean. |
| `transport.timeout` | `NEW_RELIC_LOG_TIMEOUT` | `5` | Seconds to wait for the Logs API, for both the connection and the whole request. |
| `transport.retries` | `NEW_RELIC_LOG_RETRIES` | `3` | Attempts before a failed Logs API request is given up. |

## License key and region

Logs are posted to `https://{host}/log/v1` with `Content-Type: application/json` and the license key in the `X-License-Key` header. When `host` is empty, it is derived from the key: a key starting with a region prefix such as `eu01x` uses `log-api.eu.newrelic.com`, and any other key (US keys have no prefix) uses `log-api.newrelic.com`. Set `NEW_RELIC_LOG_HOST` to override it, for example for FedRAMP.

If no license key is found in the config or the agent's `newrelic.license` INI value, building the channel throws an `InvalidArgumentException` and Laravel falls back to its emergency logger (`storage/logs/laravel.log`).

## The log channel

The package registers this channel unless your `config/logging.php` already defines a `newrelic` channel. Define it yourself to change its options:

```php
'newrelic' => [
    'driver' => 'custom',
    'via' => Laranex\LaravelNewrelic\Logging\NewRelicLogger::class,
    'level' => env('LOG_LEVEL', 'debug'),
    'buffer' => true,
],
```

| Option | Default | Description |
|---|---|---|
| `level` | `debug` | Minimum level shipped to New Relic. |
| `bubble` | `true` | Whether records bubble up to the next handler. |
| `buffer` | `true` | Buffer records and send them as one batch (a JSON array) after each Octane request, task or tick, after each queue job (processed or failed), and when the process exits. `false` sends each record immediately. |
| `name` | `newrelic` | The Monolog channel name, sent as `channel`. |

Records below `level` are dropped. Requests are sent with cURL, a 5 second timeout (for both the connection and the whole request) and up to 3 attempts by default. Tune them with `NEW_RELIC_LOG_TIMEOUT` and `NEW_RELIC_LOG_RETRIES`.

## What gets logged

Each record is sent as a JSON object with the `message`, the numeric Monolog `level` (for example `200`) and its `level_name` (`INFO`), the `channel`, the `context`, the remaining `extra` (an empty `context` or `extra` is sent as `{}`) and a `timestamp` in milliseconds since the UNIX epoch, plus these attributes:

| Field | Value |
|---|---|
| `service` | `config('app.name')` |
| `hostname` | The server's hostname (the agent's `hostname` linking metadata wins when the agent is loaded) |
| `extra.ip` | The client IP, when a request is bound in the container |
| `user` | The authenticated user's `id` (`getAuthIdentifier()`) and `email` from the default guard, when a request is bound and a user is logged in (`email` is `null` when the user has none or reading it throws) |
| `entity.guid`, `trace.id`, `span.id`, ... | The agent's linking metadata at the top level (`trace.id` left-padded with zeros to 32 characters), when the agent is loaded |

The request and user are resolved per record, so they stay correct on Octane.

## Transactions

Long-running processes would otherwise report as one endless transaction. The package splits them per unit of work. The listeners are registered automatically whether or not Octane or Horizon is installed (events that never fire cost nothing), and every agent call does nothing when the agent is not loaded:

| Event | Listener | Effect |
|---|---|---|
| Octane `WorkerStarting`, `RequestTerminated` | `Listeners\EndTransaction` | End the current transaction |
| Octane `RequestReceived` | `Listeners\StartWebTransaction` | Start a new transaction and mark it as a web transaction |
| Queue `JobProcessed`, Horizon `JobReleased` | `Listeners\RestartBackgroundTransaction` | End the transaction, start a new one and mark it as a background job |

New transactions are reported to `newrelic.app_name`, or to the agent's `newrelic.appname` INI value when it is empty. With neither set, no transaction is started.

Turn either group off with `NEW_RELIC_OCTANE_TRANSACTIONS=false` / `NEW_RELIC_QUEUE_TRANSACTIONS=false`, or in `config/newrelic.php`:

```php
'transactions' => [
    'octane' => true,
    'queue' => false,
],
```

The `transactions` switches only control these listeners. The buffered log records are still sent after each Octane request and queue job.

## Without the agent

Every agent call goes through the `Laranex\LaravelNewrelic\Contracts\Agent` singleton (`NewRelicAgent`), which does nothing when the `newrelic` extension is not loaded. Log delivery goes through the `Laranex\LaravelNewrelic\Contracts\LogTransport` singleton (`Logging\CurlTransport`). Bind your own implementations to fake either in tests:

```php
use Laranex\LaravelNewrelic\Contracts\LogTransport;

$this->app->instance(LogTransport::class, new class implements LogTransport {
    public array $sent = [];

    public function send(string $url, array $headers, string $body): void
    {
        $this->sent[] = compact('url', 'headers', 'body');
    }
});
```

## Why not the New Relic Monolog Enricher?

The [New Relic Monolog Enricher](https://github.com/newrelic/newrelic-monolog-logenricher-php) does not support Monolog 3, which current Laravel versions use. The handler, formatter and processor in this package are derived from it and built for Monolog 3.
