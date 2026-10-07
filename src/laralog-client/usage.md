---
title: Usage
description: Send Laravel logs to Laralog by switching to the laralog channel.
---

# Usage

Set the channel and your Laralog credentials in `.env`:

```env
LOG_CHANNEL=laralog
LARALOG_CLIENT_BASE_URL=https://laralog.example.com
LARALOG_CLIENT_TEAM_SECRET_KEY=your-team-secret
```

The package registers the `laralog` channel. Every record is posted as JSON (`level`, `message`, `context`) to `{LARALOG_CLIENT_BASE_URL}/api/logs` with the `X-TEAM-SECRET-KEY` header. A failed request throws `Laranex\LaralogClient\Exceptions\LaralogClientHttpException`.

You can also log to it explicitly or in a stack, like any [Laravel log channel](https://laravel.com/docs/logging):

```php
Log::channel('laralog')->info('Order placed', ['order_id' => $order->id]);
```
