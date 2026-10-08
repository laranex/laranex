---
title: Upgrading
description: Upgrade Laravel Myanmar NRC from v2 to v4. New facade and method names, typed exceptions, renamed relations and split publish tags.
---

# Upgrading to v4 from v2

There is no v3: every Laranex package moved to v4.0.0 together, so this release follows v2.0.0 directly.

## Requirements

PHP 8.1+ and Laravel 10 to 13.

```bash
composer require laranex/laravel-myanmar-nrc:^4.0
```

## Facade and methods

The parser is `Laranex\LaravelMyanmarNRC\MyanmarNrc`, bound as a singleton under its class name. The `laravel-myanmar-nrc` container binding is gone.

| Before | After |
|---|---|
| `Laranex\LaravelMyanmarNRC\LaravelMyanmarNrcFacade` (alias `LaravelMyanmarNrc`) | `Laranex\LaravelMyanmarNRC\Facades\MyanmarNrc` (alias `MyanmarNrc`) |
| `LaravelMyanmarNrc::parseNRC($nrc, $dbDriven, $lang)` | `MyanmarNrc::parse($nrc, $dbDriven, $lang)` |
| `(new LaravelMyanmarNrc)->isValidMyanmarNRC($nrc)` | `MyanmarNrc::isValid($nrc)` |
| `LaravelMyanmarNrcServiceProvider` | `MyanmarNrcServiceProvider` (auto-discovered) |
| `Console\SeedMyanmarNRCCommand` | `Console\Commands\SeedMyanmarNrcCommand` (still `mm-nrc:seed`) |
| `Data\MyanmarNRCJsonHandler` | `Repositories\JsonNrcRepository` (resolve it from the container) |

If you registered the provider manually, point it at `Laranex\LaravelMyanmarNRC\MyanmarNrcServiceProvider`.

`JsonNrcRepository`'s `types()`, `states()` and `townships()` return the rows as arrays.

## Backend selection

Passing `$dbDriven = false` now really selects the JSON backend. Before, `db_driven => true` in the config could not be overridden per call.

## Exceptions

Invalid NRCs throw `InvalidNrcException` and an unknown language throws `UnsupportedLocaleException` (both extend `InvalidArgumentException`) instead of a bare `Exception`. Update your catch blocks:

```php
use Laranex\LaravelMyanmarNRC\Exceptions\InvalidNrcException;

try {
    MyanmarNrc::parse($nrc);
} catch (InvalidNrcException) {
    // ...
}
```

An NRC must now have exactly four `-` separated parts.

`isValid()` only turns `InvalidNrcException` into `false`. v2's `isValidMyanmarNRC()` swallowed every exception, so errors such as a missing NRC table now surface instead of failing validation. `isValid()` no longer depends on the `locale` config, so an unsupported value there only affects `parse()`.

## Models

| Before | After |
|---|---|
| `State::nrcTownships()` | `State::townships()` |
| `Township::nrcTownship()` | `Township::state()` |

`id`, `code` (on `State`) and `nrc_state_id` are cast to integers.

## Configuration

The config file is now published with `--tag="laravel-myanmar-nrc-config"` and the translations with `--tag="laravel-myanmar-nrc-lang"`. The migrations can now be published with `--tag="laravel-myanmar-nrc-migrations"`. `--tag="laravel-myanmar-nrc"` publishes all three.

`json_file` defaults to `null` (the bundled file). The old `'nrc.json'` value still means the bundled file, which moved to `resources/data/nrc.json`.

## Validation rule

`MyanmarNRC` is now a `ValidationRule`. It accepts an optional `dbDriven` constructor argument, and its message can be overridden through the custom messages array (`'nrc.'.MyanmarNRC::class`).

## Database

The migrations keep their file names, so existing installations do not need to migrate again. `mm-nrc:seed` no longer uses MySQL-only `SET FOREIGN_KEY_CHECKS`. Re-run it once to refresh the data:

```bash
php artisan mm-nrc:seed
```
