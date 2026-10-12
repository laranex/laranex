---
title: Installation
description: Install Laravel Schema Viewer, open the viewer and review the configuration.
---

# Installation

```bash
composer require laranex/laravel-schema-viewer:^1.0@alpha --dev
```

Until v1.0.0 is stable, the `^1.0@alpha` constraint is needed: a plain `composer require` looks for a stable release and finds none.

The service provider registers itself. Open `/schema-viewer` in your local environment; the page loads the built viewer from the package, so there is no `npm install` and nothing to publish.

Install it as a dev dependency unless your team wants the viewer on a server; see [Access](#access).

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

## Configuration

Every setting has a default. Publish the config file only to change one:

```bash
php artisan vendor:publish --tag="laravel-schema-viewer-config"
```

| Key | Default | What it does |
|---|---|---|
| `enabled` | `SCHEMA_VIEWER_ENABLED`, unset | Unset: on in `local`, off elsewhere. `true` or `false` decides for every environment. |
| `path` | `SCHEMA_VIEWER_PATH`, `schema-viewer` | The URL path of the viewer. |
| `domain` | `SCHEMA_VIEWER_DOMAIN`, unset | Serves the viewer on its own domain. |
| `middleware` | `['web']` | Route middleware. The `viewSchema` check is always added. |
| `connections` | `null` | `null` reads the default connection and every connection a model uses. A list reads exactly those, e.g. `['mysql', 'analytics']`. |
| `default_connection` | `SCHEMA_VIEWER_DEFAULT_CONNECTION`, `all` | What the viewer opens on: `all` puts every connection on one diagram, or name one, e.g. `mysql`. An unknown name opens on all. The HTML export keeps it. |
| `editor` | `SCHEMA_VIEWER_EDITOR`, `null` | Opens models and relations in your editor at their line: `phpstorm`, `vscode`, `cursor`, `zed`, `sublime` and the other names Laravel's `app.editor` takes, or `['href' => 'myeditor://open?file={file}&line={line}']`. Add `'base_path'` when the editor sees the project at another path (Docker, Sail, WSL). `null` uses `app.editor`; without either there are no editor links. |
| `models` | `null` | Folders scanned for models. `null` scans `app/Models`. |
| `exclude_tables` | `[]` | Tables never shown. Wildcards allowed, e.g. `telescope_*`. |
| `framework_tables` | Laravel's own tables, `telescope_*`, `pulse_*` | Shown and tagged, so one toggle hides them. They get no hints. |
| `package_tables` | `true` | Tags the tables of installed packages (Passport, spatie/laravel-permission, Filament Breezy), so one toggle hides them. They still get hints. |
| `hints.ignore` | `[]` | Rules for the hints you have accepted, such as `['connection' => 'mysql', 'table' => 'audit_logs']`; see [Ignoring hints](./hints#ignoring-hints). |
| `hints.fail_on` | `foreign_key_without_index`, `unresolved_relation`, `model_without_table` | Kinds that make `schema-viewer:check` fail. |
