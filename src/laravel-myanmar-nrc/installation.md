---
title: Installation
description: Install Laravel Myanmar NRC, run its migrations and seed the NRC data.
---

# Installation

```bash
composer require laranex/laravel-myanmar-nrc
```

The service provider and the `MyanmarNrc` facade alias are registered automatically.

## Database

The package loads its migrations automatically. Run them to create the `nrc_states`, `nrc_townships` and `nrc_types` tables:

```bash
php artisan migrate
```

Seed them from the bundled [NRC data](https://github.com/laranex/laravel-myanmar-nrc/blob/master/resources/data/nrc.json), or from your own file (see [Configuration](/laravel-myanmar-nrc/configuration)):

```bash
php artisan mm-nrc:seed
```

:::warning
`mm-nrc:seed` empties the three NRC tables before inserting. It works on every database driver and throws `InvalidJsonFileException` when the data file is missing or malformed.
:::

To change the table definitions, publish the migrations before running them:

```bash
php artisan vendor:publish --tag="laravel-myanmar-nrc-migrations"
```

Once a migration is published, the package stops loading its own copy, so the tables are never created twice. Publishing again reuses the copies you already have. Don't publish them in an application that already ran the package migrations: the published files have new names, so `migrate` would try to create the existing tables again.

The database is only needed when `db_driven` is `true` (the default). With `db_driven` set to `false`, NRCs are read from the JSON file and you can skip the migration and seeding.
