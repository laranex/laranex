---
title: Upgrading
description: Upgrade Next Laravel from v1.1 to v4. Versions 2 and 3 were never released; the base classes, commands and config keys are unchanged.
---

# Upgrading to v4

v4 follows v1.1.0 directly. Versions 2.x and 3.x were never released, so that every Laranex package shares the v4 line. The base classes (`Cores\Controller`, `Feature`, `Operation`, `Job`, `QueueableJob`, `Request`), the `serve()`, `run()` and `runInQueue()` methods, the command signatures, the config keys and the generated file locations are the same as in v1.1.

## Requirements

PHP 8.1+ and Laravel 10 to 13 (v1.1 supported Laravel 10 and 11).

```bash
composer require laranex/next-laravel:^4.0
```

The package no longer depends on `spatie/laravel-package-tools`; it requires only the `illuminate/*` components it uses. If your application relied on the package to pull in `spatie/laravel-package-tools`, require it yourself.

## Commands

The generator commands (`next:route`, `next:controller`, `next:request`, `next:feature`, `next:operation`, `next:job`) now exit with code `1` when generation fails (for example when the file already exists and `--force` was not given). In v1.1 they always returned `0`. Update scripts or CI steps that check the exit code.

Names containing `/` or `\` (for example `next:feature Blog/CreatePost Blog`) are now rejected with an error and exit code `1`; v1.1 wrote a file whose class name contained the slash.

The second argument of `next:operation` is now called `module` instead of `domain`, matching the other commands. Positional usage (`php artisan next:operation SlugifyTitle Blog`) is unchanged; only calls that pass the argument by name, such as `Artisan::call('next:operation', ['operation' => 'SlugifyTitle', 'domain' => 'Blog'])`, must use `'module'` instead.

## Config and publish tags

The config keys `enable_routes`, `web_routes_prefix` and `api_routes_prefix` and their env variables are unchanged, so a published `config/next-laravel.php` keeps working. The tags `next-laravel-config`, `next-laravel-views` and `next-laravel-stubs` are unchanged, and a new `next-laravel` tag publishes all three at once.

## Stubs

The queueable job stub declared `__construct(): void`, which is invalid PHP in every job generated with `--queue`. If you published the stubs, compare them with the package's `resources/stubs` or republish them:

```bash
php artisan vendor:publish --tag="next-laravel-stubs" --force
```

The other stubs keep the same shape: generated route files import the `Route` facade and use `Route::prefix()->group()`, route files use a prefix without a leading slash (`Route::prefix('v1/blogs')`), the feature stub's `handle` method declares a `mixed` return type instead of `int` and returns `null` until you fill it in (a feature generated from the old stub threw a `TypeError` when served unchanged), and unused imports were removed. Fix any job already generated from the old queueable stub by removing `: void` from its constructor.

## Route registration

Route files under `routes/web` and `routes/api` are now registered during the service provider's `boot()` method instead of `register()`, so host configuration (including cached config) is honored. Files are loaded in sorted order. Routes are still skipped when the route cache is in use.

## Extending the package

- `Commands\BaseCommand` is now abstract. Extend it from a concrete command instead of instantiating it.
- `Laranex\NextLaravel\Str` no longer overrides `studly()`; the Laravel method is inherited. If you passed a second argument to `Str::studly()`, drop it. All other `Str` helpers take `string` parameters.
- `Bus\Dispatcher::getDispatchableUnit()`, `serve()`, `run()` and `runInQueue()` declare native `string|object` unit and `array` argument types instead of `mixed`.
- `runInQueue()` no longer reads `composer.json` to build the "operation cannot be queued" error, which produced a broken message.
- `RouteGenerator::getStubContents()` is public like the other generators.
- `NextLaravel::getAllFilesOfADirectory()` returns the files sorted.
- Every source file declares `strict_types=1`.
