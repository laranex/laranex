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

Install it as a dev dependency unless your team wants the viewer on a server; see [Access](#access).

## The schema snapshot

`schema-viewer:build` reads the database and your Eloquent models and writes `schema-viewer.json` in the project root: the schema document plus each connection's Mermaid, DBML and Markdown downloads, as readable JSON. It is always written there, never under `public/`. The viewer has no API: its page carries the schema and the downloads from that file, the way a [standalone export](./exports#standalone-viewer) does, and is sent compressed. No model code runs in a web request, in any environment.

Run the build again after you migrate or change a model; the viewer shows the snapshot it last wrote. On a server, run it in your deploy script after `migrate`:

```bash
php artisan migrate --force
php artisan schema-viewer:build
```

Without a snapshot, the viewer shows what to run instead of a diagram.

Building runs your models: each one is constructed, and every relation method is called. While it runs, every database connection pretends (queries are logged, never sent), model events are off, and jobs, mail, notifications, HTTP calls, events and the cache are faked; see [Relationships](./relationships#what-runs-when-the-snapshot-is-built).

### Commit it or ignore it

The file lists every table and column, the models' details (fillable, hidden, casts, scopes) and the source file paths, so commit it only when the repository is private.

- **Commit `schema-viewer.json`** (private repositories only). Every clone and every server has the viewer without a database, and pull requests show schema changes as a diff of one readable file. Rebuild it with your migrations, as you would update a schema dump.
- **Ignore it.** Add `/schema-viewer.json` to `.gitignore` and let each machine build its own: locally after migrating, on a server in the deploy script.

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

Every setting has a default; see [Configuration](./configuration) to change one.
