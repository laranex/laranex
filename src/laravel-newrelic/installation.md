---
title: Installation
description: Install Laravel New Relic and switch your log channel to newrelic.
---

# Installation

Install the [New Relic PHP agent](https://docs.newrelic.com/docs/agents/php-agent/getting-started/introduction-new-relic-php) on your server first, then:

```bash
composer require laranex/laravel-newrelic
```

The package registers a `newrelic` log channel. Use it in `.env`:

```env
LOG_CHANNEL=newrelic
```
