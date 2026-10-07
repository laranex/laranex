---
title: Installation
description: Install Laravel Myanmar NRC, run its migrations and seed the NRC data.
---

# Installation

```bash
composer require laranex/laravel-myanmar-nrc
```

Create the NRC tables (states, townships and types):

```bash
php artisan migrate
```

Seed them from the bundled [NRC data](https://github.com/laranex/laravel-myanmar-nrc/blob/master/src/Data/nrc.json):

```bash
php artisan mm-nrc:seed
```

:::warning
`mm-nrc:seed` empties the three NRC tables before inserting, and toggles `FOREIGN_KEY_CHECKS`, which is MySQL syntax.
:::

:::info
Laravel 12 and 13 support is part of the upcoming release.
:::
