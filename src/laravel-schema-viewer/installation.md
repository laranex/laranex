---
title: Installation
description: Install Laravel Schema Viewer, build the schema snapshot, open the viewer and choose who may see it.
---

# Installation

```bash
composer require laranex/laravel-schema-viewer --dev
```

The service provider registers itself. Build the schema snapshot, then open `/schema-viewer` in your local environment:

```bash
php artisan schema-viewer:build
```

The page loads the built viewer from the package, so there is no `npm install` and nothing to publish.

Install it as a dev dependency unless your team wants the viewer on a server; see [Access](#access).

## The schema snapshot

`schema-viewer:build` reads the database and your Eloquent models and writes `schema-viewer.json` in the project root: the schema document plus each connection's Mermaid, DBML and Markdown downloads, as readable JSON. The viewer's page, its API and its downloads only read that file. No model code runs in a web request, in any environment.

In the `local` environment the build runs again by itself whenever `php artisan migrate` (or `migrate:fresh`, `migrate:rollback` and the others) finishes, so the viewer follows your migrations. A table you alter by hand, or a model you edit, shows after the next build. Elsewhere, run the build yourself, for example in your deploy script after `migrate`:

```bash
php artisan migrate --force
php artisan schema-viewer:build
```

Without a snapshot, the viewer shows what to run instead of a diagram.

Building runs your models: each one is constructed, and every relation method is called. While it runs, every database connection pretends (queries are logged, never sent), model events are off, and jobs, mail, notifications, HTTP calls, events and the cache are faked; see [Relationships](./relationships#what-runs-when-the-snapshot-is-built).

### Commit it or ignore it

Both work; pick one for the team.

- **Commit `schema-viewer.json`.** Every clone and every server has the viewer without a database, and pull requests show schema changes as a diff of one readable file. Rebuild it with your migrations, as you would update a schema dump.
- **Ignore it.** Add `/schema-viewer.json` to `.gitignore` and let each machine build its own: locally after `migrate`, on a server in the deploy script.

To keep it somewhere else, set `snapshot` (`SCHEMA_VIEWER_SNAPSHOT`), e.g. `storage/app/schema-viewer.json`; see [Configuration](./configuration).

## Access

The viewer is on in the `local` environment and off everywhere else. To open it on a staging or production server, turn it on and say who may see it with the `viewSchema` gate, for example in `AppServiceProvider::boot()`:

```php
use Illuminate\Support\Facades\Gate;

Gate::define('viewSchema', fn ($user) => $user->isAdmin());
```

```ini
SCHEMA_VIEWER_ENABLED=true
```

Without the gate, the viewer answers 403 outside `local`. Schema details help an attacker, so keep the gate strict.

To decide yourself, in every environment, call `SchemaViewer::auth()` in a service provider's `boot()`. Its callback replaces both checks (local and the gate), like `Telescope::auth()`:

```php
use Illuminate\Http\Request;
use Laranex\LaravelSchemaViewer\SchemaViewer;

SchemaViewer::auth(fn (Request $request): bool => $request->user()?->isAdmin() ?? false);
```

The callback receives each request; keep request and user state out of the closure itself.

::: warning Local means anyone who can reach the app
In `local`, without `SchemaViewer::auth()`, the viewer skips the gate. If the app is reachable from outside, through Herd Share, Expose, ngrok, `artisan serve --host=0.0.0.0`, Docker ports or a server misconfigured as `local`, anyone with the link sees the full schema. Set `SCHEMA_VIEWER_ENABLED=false` while sharing the app, or decide who may open it with `SchemaViewer::auth()`.
:::

Every setting has a default; see [Configuration](./configuration) to change one. Coming from v1? See [Upgrading](./upgrading).
