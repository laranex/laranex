---
title: Configuration
description: Publish and configure Next Laravel's config file, views and stubs to customize route loading, prefixes and generated files.
---

# Configuration

## Publishable assets

:::info Note
Publishing the package assets is optional and you are not required to do this if you don't need to.
:::

| Tag | Publishes |
|---|---|
| `next-laravel-config` | `config/next-laravel.php` |
| `next-laravel-views` | `resources/views/vendor/next-laravel` |
| `next-laravel-stubs` | `resources/stubs/vendor/next-laravel` |
| `next-laravel` | All of the above |

### Config

You may run the following command to publish the configuration file.

```bash
php artisan vendor:publish --tag=next-laravel-config
```

Following is the default configuration file, and you are free to update the values as per your need.

```php
return [
    'enable_routes' => env('NEXT_LARAVEL_ENABLE_ROUTES', true),
    'web_routes_prefix' => env('NEXT_LARAVEL_WEB_ROUTES_PREFIX', ''),
    'api_routes_prefix' => env('NEXT_LARAVEL_API_ROUTES_PREFIX', 'api'),
];
```

| Option | Env | Default | Action |
|---|---|:---:|---|
| `enable_routes` | `NEXT_LARAVEL_ENABLE_ROUTES` | `true` | Should the package load routes from `routes/api` & `routes/web`? |
| `web_routes_prefix` | `NEXT_LARAVEL_WEB_ROUTES_PREFIX` | `''` | Prefix for routes registered under `routes/web` |
| `api_routes_prefix` | `NEXT_LARAVEL_API_ROUTES_PREFIX` | `'api'` | Prefix for routes registered under `routes/api` |

When `enable_routes` is on, the service provider loads every `.php` file under `routes/web` (recursively, in sorted order) with the `web` middleware group and every `.php` file under `routes/api` with the `api` middleware group. Routes are registered in the provider's `boot()` method and are skipped when the application's routes are cached (`php artisan route:cache`), since the cache already contains them.

### Views

```bash
php artisan vendor:publish --tag=next-laravel-views
```

The package ships a single `next-laravel::welcome` view, which generated route files return as a placeholder.

### Stubs

```bash
php artisan vendor:publish --tag=next-laravel-stubs
```

The generator commands read their stubs from `resources/stubs/vendor/next-laravel` when a published copy exists and fall back to the package stubs otherwise. The stubs are `controller.php.stub`, `feature.php.stub`, `operation.php.stub`, `request.php.stub`, `job.php.stub`, `job.queueable.php.stub` and `route.php.stub`. `route.php.stub` receives `{{prefix}}` (for example `v1/blogs`, without a leading slash) plus `{{route}}` and `{{versionOrDirectory}}` (with a leading slash), so route stubs published before v4 keep working.
