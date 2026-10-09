---
title: Usage
description: Configure the newrelic log channel, the Logs API host and the Octane transaction listeners, and see how queue jobs are reported.
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
| `app_name` | `NEW_RELIC_APP_NAME` | `null` | APM application that Octane transactions are reported to. Falls back to the agent's `newrelic.appname` INI value. |
| `transactions.octane` | `NEW_RELIC_OCTANE_TRANSACTIONS` | `true` | One web transaction per Octane request, named after its route. Cast to a boolean. |
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

Records below `level` are dropped. Requests are sent with cURL, a 5 second timeout (for both the connection and the whole request) and up to 3 attempts by default (at least one attempt is always made). Tune them with `NEW_RELIC_LOG_TIMEOUT` and `NEW_RELIC_LOG_RETRIES`. A batch bigger than the Logs API's 1 MB payload limit is split into several requests.

Logging never breaks your app: when the Logs API cannot be reached after the last attempt or answers with an HTTP error status (for example `403` for a wrong license key), the failure is written to PHP's error log (`error_log`, without the payload or the key) and the request or job carries on.

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

An Octane worker would otherwise report as one endless transaction. The package splits it per request. The listeners are registered automatically whether or not Octane is installed (events that never fire cost nothing), and every agent call does nothing when the agent is not loaded:

| Event | Listener | Effect |
|---|---|---|
| Octane `RequestReceived` | `Listeners\StartWebTransaction` | Start a new transaction and mark it as a web transaction |
| Octane `RequestTerminated` | `Listeners\NameWebTransaction`, then `Listeners\EndTransaction` | Name the transaction after the request's route, then end it |
| Octane `WorkerStarting` | `Listeners\EndTransaction` | End the transaction the worker booted in |

::: warning New Relic does not officially support Octane yet
The New Relic PHP agent supports [Apache with mod_php and PHP-FPM](https://docs.newrelic.com/docs/apm/agents/php-agent/getting-started/php-agent-compatibility-requirements/) as web servers. Octane servers are not on that list: thread-safe (ZTS) PHP builds such as FrankenPHP are not supported, and Swoole support is [on New Relic's roadmap](https://github.com/newrelic/newrelic-php-agent/issues/1041). The Octane listeners make the agent report one transaction per request in a long-running worker, but results depend on your server and agent version, so check them in New Relic before you rely on them.
:::

### Octane transactions

An Octane worker boots Laravel once and then serves many requests, so without these listeners the agent records the whole worker as a single transaction. The package ends the boot transaction when the worker starts, starts a web transaction when a request arrives, and ends it when the request terminates.

Before ending it, `NameWebTransaction` names the transaction with `newrelic_name_transaction()`. Under Octane the agent's own Laravel route naming often never runs (its hooks are installed when the application boots inside a recorded transaction, which an Octane worker often doesn't have), so transactions would otherwise all be named after the worker script. The name follows the agent's Laravel order (route name, then controller action) and falls back to the route's pattern, never the request URL, so URLs with IDs don't create a separate name each:

| Matched route | Transaction name |
|---|---|
| Named route (`->name('blogs.show')`) | `blogs.show` |
| Unnamed controller route | `App\Http\Controllers\BlogController@show` |
| Unnamed closure route | The HTTP method and the route URI pattern, for example `GET /blogs/{blog}` |
| No route (a 404, an `Octane::route()` route, or a response sent by middleware before routing) | `unknown` |

Route names that Laravel generates for cached unnamed routes (`generated::...`) are skipped. Only Octane requests are named: PHP-FPM and other classic requests keep the agent's own naming, and turning `transactions.octane` off turns naming off as well.

### Queue jobs

Queue jobs need nothing from the package. The New Relic PHP agent instruments Laravel's queue worker itself (it wraps `Illuminate\Queue\Worker::process()`): for every job it ends the worker's idle transaction, starts a background transaction named `JobClass (connection)` (for example `App\Jobs\SendInvoice (redis)`), records the job's exception on it when the job fails, and ends it when the job is done. Time spent waiting for the next job goes into a separate transaction that the agent discards.

The package still sends the buffered log records after every queue job (`JobProcessed` and `JobExceptionOccurred`), so a worker doesn't hold its logs until it exits.

::: tip Don't restart transactions around queue jobs
Queue event listeners and job middleware run inside the agent's job transaction. Ending or starting a transaction there (as v1 of this package did) cuts the job's named transaction short and leaves a duplicate, unnamed one.
:::

### Application name and switch

New Octane transactions are reported to `newrelic.app_name`, or to the agent's `newrelic.appname` INI value when it is empty. With neither set, no transaction is started.

Turn the Octane listeners off with `NEW_RELIC_OCTANE_TRANSACTIONS=false`, or in `config/newrelic.php`:

```php
'transactions' => [
    'octane' => false,
],
```

The switch only controls these listeners. The buffered log records are still sent after each Octane request and queue job.

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
