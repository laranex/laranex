---
title: Route
description: Generate route files with Better Laravel's artisan command. Routes are loaded automatically from routes/api and routes/web.
---

# Route

You can generate a route by running the following command.

```bash
php artisan better:route blog v1 --api
```

::: info
Generated route will be at `routes/api/v1/blog.php`
:::

### Arguments

- `route` — name of the generated route file
- `versionOrDirectory` _(optional)_ — version or subdirectory where the route file will be generated

### Options

- `--api` — generated route file will be stored in `routes/api`. See more at:
  - [Configuration](/better-laravel/configuration.html#config)
  - [BetterLaravelServiceProvider.php](https://github.com/laranex/better-laravel/blob/master/src/BetterLaravelServiceProvider.php#L46)
  - [RouteMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/RouteMakeCommand.php)
- `--force` — overwrites an existing file at the same path

### Calling a Controller Action

```php
Route::group(['prefix' => '/v1/blogs'], function () {
    Route::post('/', [BlogController::class, 'store']);
});
```
