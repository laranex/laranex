---
title: Upgrading
description: Upgrade Laravel Schema Viewer from v1 to v2. The viewer serves the snapshot schema-viewer:build writes, the refresh button and cache settings are gone, and SchemaViewer::auth() decides who may open it.
---

# Upgrading to v2 from v1

## Requirements

Unchanged: PHP 8.1+ and Laravel 10 (10.36 or later) to 13.

```bash
composer require laranex/laravel-schema-viewer:^2.0 --dev
```

## Build the snapshot

v1 read the database and the models inside each viewer request and kept the result in the cache. v2 never runs model code in a web request: `php artisan schema-viewer:build` writes `schema-viewer.json` in the project root, and the viewer's page, API and downloads only read it.

After upgrading, run it once:

```bash
php artisan schema-viewer:build
```

- **Locally**, run it again after migrating or changing a model.
- **On a server** where the viewer is enabled, add it to the deploy script after `migrate`, or commit the file. See [Commit it or ignore it](./installation#commit-it-or-ignore-it).

Until a snapshot exists, the page says what to run and `api/schema` and `api/export` answer 503 with the same message.

## Removed

| v1 | v2 |
|---|---|
| The **Read again** button and <kbd>Shift</kbd> <kbd>R</kbd> | Run `php artisan schema-viewer:build` and reload the page. |
| `api/schema?refresh=1` | Same: build, then read. `refresh` is ignored. |
| `cache.enabled`, `cache.store`, `cache.ttl` (`SCHEMA_VIEWER_CACHE`, `SCHEMA_VIEWER_CACHE_STORE`) | Gone; the snapshot replaces the cache. Leftover keys in a published config are ignored; delete them when convenient. |
| `Laranex\LaravelSchemaViewer\SchemaCache` | `Laranex\LaravelSchemaViewer\Snapshot`: `build()`, `json()`, `files()`, `path()`. |

## New settings

| Key | Default | What it does |
|---|---|---|
| `snapshot` | `SCHEMA_VIEWER_SNAPSHOT`, `null` | Where the snapshot lives; `null` is `schema-viewer.json` in the project root. |

If you published the config file, add both keys or publish it again.

## Who may open the viewer

The default is unchanged: everyone in `local`, the `viewSchema` gate elsewhere. `SchemaViewer::auth()` is new and replaces both checks when you set it:

```php
use Illuminate\Http\Request;
use Laranex\LaravelSchemaViewer\SchemaViewer;

SchemaViewer::auth(fn (Request $request): bool => $request->user()?->isAdmin() ?? false);
```

## What runs while building

The build constructs every model and calls its relation methods, as v1 did per request. It now keeps their side effects in: every configured connection pretends, model events are off, and jobs, mail, notifications, HTTP calls, events and the cache are faked while it runs. A model that cannot be constructed is reported as a hint instead of failing. See [What runs when the snapshot is built](./relationships#what-runs-when-the-snapshot-is-built).

## Hints and exports

`schema-viewer:export` and `schema-viewer:check` work as before, reading the database and the models when they run. Raw relation conditions (`whereRaw`) now show their literals as `?`.
