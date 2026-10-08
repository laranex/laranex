---
title: Installation
description: Install Laravel New Relic, set your license key and switch your log channel to newrelic.
---

# Installation

```bash
composer require laranex/laravel-newrelic
```

The service provider is auto-discovered and registers a `newrelic` log channel. Point your logs at it and give it a license (ingest) key:

```env
LOG_CHANNEL=newrelic
NEW_RELIC_LICENSE_KEY=your-ingest-license-key
```

`NEW_RELIC_API_KEY` is still accepted when `NEW_RELIC_LICENSE_KEY` is not set. When neither is set, the New Relic PHP agent's `newrelic.license` INI value is used.

Publish the config file (optional):

```bash
php artisan vendor:publish --tag="newrelic-config"
```

This writes `config/newrelic.php`. The `newrelic` tag publishes the same file.

## New Relic PHP agent

The [New Relic PHP agent](https://docs.newrelic.com/docs/apm/agents/php-agent/getting-started/introduction-new-relic-php/) is optional. Without it, logs are still shipped to New Relic Logs. With it, logs are linked to their APM transaction (logs in context) and Octane requests and queue jobs are reported as separate transactions.
