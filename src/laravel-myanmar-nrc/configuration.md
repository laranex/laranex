---
title: Configuration
description: Configure the locale, NRC data file, whether NRCs are validated against the database or the JSON file, and the cache for the NRC tables.
---

# Configuration

Publish the config file (optional):

```bash
php artisan vendor:publish --tag="laravel-myanmar-nrc-config"
```

```php
return [
    'locale' => 'en',
    'json_file' => null,
    'db_driven' => true,
    'cache' => [
        'enabled' => true,
        'store' => null,
        'key' => 'laravel-myanmar-nrc',
        'ttl' => null,
    ],
];
```

| Option | Default | Description |
|---|---|---|
| `locale` | `en` | Language used when parsing: `en` or `my`. Only `parse()` reads it; `isValid()` and the validation rule ignore it |
| `json_file` | `null` | NRC data file. `null` uses the bundled file. Use your own (e.g. `storage_path('nrc.json')`) and re-run `php artisan mm-nrc:seed` |
| `db_driven` | `true` | Validate and parse against the database (`true`) or the JSON file (`false`). Can be overridden per call |
| `cache.enabled` | `true` | Store the NRC tables in a Laravel cache. `false` keeps them in memory only |
| `cache.store` | `null` | Cache store to use. `null` uses the default store |
| `cache.key` | `laravel-myanmar-nrc` | Cache key the tables are stored under |
| `cache.ttl` | `null` | Seconds to keep the tables. `null` keeps them forever |

A custom JSON file must contain a `types` array and a `states` array. Each state has a `townships` array. Every row has `id`, `code`, `code_my`, `name` and `name_my`.

## Cache

The database backend reads the `nrc_states`, `nrc_townships` and `nrc_types` tables once, keeps them in memory for the rest of the process, and stores them in the configured cache so other requests and workers skip the queries. The JSON backend doesn't use the cache.

`php artisan mm-nrc:seed` clears the cache for you. After changing the tables any other way, clear it yourself:

```bash
php artisan mm-nrc:clear-cache
```

::: tip Long-running workers
Octane and queue workers keep their in-memory copy of the tables until they restart, even after the cache is cleared. Restart them (`php artisan octane:reload`, `php artisan queue:restart`) after changing the NRC data.
:::

## Publish tags

| Tag | Publishes |
|---|---|
| `laravel-myanmar-nrc-config` | `config/laravel-myanmar-nrc.php` |
| `laravel-myanmar-nrc-lang` | `lang/vendor/laravel-myanmar-nrc` (validation messages in `en` and `my`) |
| `laravel-myanmar-nrc-migrations` | The three NRC migrations into `database/migrations`, timestamped |
| `laravel-myanmar-nrc` | All of the above |
