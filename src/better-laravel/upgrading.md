---
title: Upgrading
description: Upgrade Better Laravel from v2 to v4. Version 3 was skipped; the base classes, commands and config keys are unchanged.
---

# Upgrading to v4

v4 follows v2.0.0 directly. Version 3 was skipped so that every Laranex package shares the same major version. The base classes (`Cores\Controller`, `Feature`, `Operation`, `Job`, `QueueableJob`, `Request`), the `serve()`, `run()` and `runInQueue()` methods, the command signatures, the config keys and the generated file locations are the same as in v2.

## Requirements

PHP 8.1+ (the floor was 8.2 in v2) and Laravel 10 to 13.

```bash
composer require laranex/better-laravel:^4.0
```

The package no longer depends on `spatie/laravel-package-tools`; it requires only the `illuminate/*` components it uses. If your application relied on the package to pull in `spatie/laravel-package-tools`, require it yourself.

## Commands

The `better:*` commands now exit with code `1` when generation fails (for example when the file exists and `--force` was not given). In v2 they always returned `0`. Update scripts or CI steps that check the exit code.

Names containing `/` or `\` (for example `better:feature Blog/CreatePost Blog`) are now rejected with an error and exit code `1`; v2 wrote a file whose class name contained the slash.

## Stubs

The queueable job stub declared `__construct(): void`, a fatal error in every job generated with `--queue`. If you published the stubs, republish them to pick up the fix:

```bash
php artisan vendor:publish --tag="better-laravel-stubs" --force
```

Republishing also brings the other stub changes: generated route files import the `Route` facade and use a prefix without a leading slash (`'prefix' => 'v1/blogs'`), the feature stub's `handle` method declares a `mixed` return type instead of `int` and returns `null` until you fill it in (a feature generated from the old stub threw a `TypeError` when served unchanged), and the request stub documents its `rules()` return type. Fix any job already generated from the old queueable stub by removing `: void` from its constructor.

## Publish tags

The tags `better-laravel-config`, `better-laravel-views` and `better-laravel-stubs` are unchanged. A new `better-laravel` tag publishes all three at once.

## Route registration

Route files under `routes/web` and `routes/api` are now registered during the service provider's `boot()` method instead of `register()`, so host configuration (including cached config) is honored. Files are loaded in sorted order. Routes are still skipped when the route cache is in use.

## Extending the package

- `Commands\BaseCommand` is now abstract. Extend it from a concrete command instead of instantiating it.
- `Laranex\BetterLaravel\Str` no longer overrides `studly()`; the Laravel method is inherited. If you called `Str::studly()` with a second argument, pass only the value. All other `Str` helpers take `string` parameters.
- `Bus\UnitDispatcher::runInQueue()` now declares a `Illuminate\Foundation\Bus\PendingDispatch` return type.
- `JobGenerator::getStubContents()` defaults to the synchronous job stub when called without arguments.
- `BetterLaravel::getAllFilesOfADirectory()` returns the files sorted.
- Every source file declares `strict_types=1`.
