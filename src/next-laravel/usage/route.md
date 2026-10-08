---
title: Route
description: Generate route files with Next Laravel's artisan command. Routes are loaded automatically from routes/api and routes/web.
---

# Route

You can generate a route by running the following command.

```bash
php artisan next:route blog v1 --api
```

::: info
Generated route will be at `routes/api/v1/blogs.php`. The route name is pluralized and kebab-cased (`blog` becomes `blogs`) and the version or directory is lower-cased.
:::

### Arguments

- `route` — name of the generated route file. It must not contain `/` or `\`; put the file in a subdirectory with `versionOrDirectory` instead
- `versionOrDirectory` _(optional)_ — version or subdirectory where the route file will be generated

### Options

- `--api` — generated route file will be stored in `routes/api` instead of `routes/web`. See more at:
  - [Configuration](/next-laravel/configuration.html#config)
  - [NextLaravelServiceProvider.php](https://github.com/laranex/next-laravel/blob/master/src/NextLaravelServiceProvider.php)
  - [RouteMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/RouteMakeCommand.php)
- `--force` — overwrites an existing file at the same path

The command exits with `1` when the file already exists and `--force` was not given. When `next-laravel.enable_routes` is disabled, the command still generates the file but warns that it will not be loaded.

### Generated file

The generated file groups its routes under the `{versionOrDirectory}/{route}` prefix (`{route}` alone without a version or directory) and returns the package's welcome view. Files under `routes/api` also get the `api_routes_prefix` (`api` by default), so the example above answers on `/api/v1/blogs`.

```php
use Illuminate\Support\Facades\Route;

Route::prefix('v1/blogs')->group(function () {
    Route::get('/', function () {
        return view('next-laravel::welcome');
    });
});
```

### Calling a controller action

```php
use App\Modules\BlogModule\Http\Controllers\BlogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/blogs')->group(function () {
    Route::post('/', [BlogController::class, 'store']);
});
```
