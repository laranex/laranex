---
title: Installation
description: Install Laralog Client and point it at your Laralog server.
---

# Installation

Laralog Client sends logs to a [Laralog Server](https://github.com/naythukhant/laralog). Set up a server first.

```bash
composer require laranex/laralog-client
```

:::info
Monolog 3 support (the Monolog version every current Laravel release uses) is part of the upcoming release, which requires PHP 8.1+.
:::

Publish the config file (optional):

```bash
php artisan vendor:publish --tag="laralog-client"
```
