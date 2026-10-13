---
title: Configuration
description: Every Laravel Schema Viewer setting, its default and what it does.
---

# Configuration

Every setting has a default. Publish the config file only to change one:

```bash
php artisan vendor:publish --tag="laravel-schema-viewer-config"
```

| Key | Default | What it does |
|---|---|---|
| `enabled` | `SCHEMA_VIEWER_ENABLED`, unset | Unset: on in `local`, off elsewhere. `true` or `false` decides for every environment. |
| `path` | `SCHEMA_VIEWER_PATH`, `schema-viewer` | The URL path of the viewer. |
| `domain` | `SCHEMA_VIEWER_DOMAIN`, unset | Serves the viewer on its own domain. |
| `middleware` | `['web']` | Route middleware. The access check (`SchemaViewer::auth()`, or open in `local` and the `viewSchema` gate elsewhere) is always added. |
| `connections` | `null` | `null` reads the default connection and every connection a model uses. A list reads exactly those, e.g. `['mysql', 'analytics']`. |
| `default_connection` | `SCHEMA_VIEWER_DEFAULT_CONNECTION`, `all` | What the viewer opens on: `all` puts every connection on one diagram, or name one, e.g. `mysql`. An unknown name opens on all. The HTML export keeps it. |
| `editor` | `SCHEMA_VIEWER_EDITOR`, `null` | Opens models and relations in your editor at their line: `phpstorm`, `vscode`, `cursor`, `zed`, `sublime` and the other names Laravel's `app.editor` takes, or `['href' => 'myeditor://open?file={file}&line={line}']`. Add `'base_path'` when the editor sees the project at another path (Docker, Sail, WSL). `null` uses `app.editor`, in `local` only; without either there are no editor links. Links with unsafe schemes such as `javascript:` are dropped. |
| `models` | `null` | Folders scanned for models. `null` scans `app/Models`. |
| `exclude_tables` | `[]` | Tables never shown. Wildcards allowed, e.g. `telescope_*`. |
| `framework_tables` | Laravel's own tables, `telescope_*`, `pulse_*` | Shown and tagged, so one toggle hides them. They get no hints. |
| `package_tables` | Laravel's own packages, below | Table patterns by Composer package name. While a package is installed, its tables are tagged with its name, so one toggle hides them; they still get hints. Add your own packages, or set `false` to tag nothing. |
| `hints.ignore` | `[]` | Rules for the hints you have accepted, such as `['connection' => 'mysql', 'table' => 'audit_logs']`; see [Ignoring hints](./hints#ignoring-hints). |
| `hints.fail_on` | `foreign_key_without_index`, `unresolved_relation`, `model_without_table` | Kinds that make `schema-viewer:check` fail. |

### Package tables

The default list holds Laravel's own packages that create tables. Add any other package by its Composer name; its tables are tagged only while it is installed. Wildcards are allowed.

```php
'package_tables' => [
    'laravel/passport' => ['oauth_*'],
    'laravel/cashier' => ['subscriptions', 'subscription_items'],
    'laravel/cashier-paddle' => ['customers', 'subscriptions', 'subscription_items', 'transactions'],
    'laravel/pennant' => ['features'],

    // Your own, for example:
    'spatie/laravel-permission' => ['permissions', 'roles', 'model_has_permissions', 'model_has_roles', 'role_has_permissions'],
],
```

`framework_tables` is a plain list in the same way: Laravel's own tables (`migrations`, `jobs`, `job_batches`, `failed_jobs`, `cache`, `cache_locks`, `sessions`, `password_reset_tokens`, `personal_access_tokens`, `notifications`), plus `telescope_*` and `pulse_*`. Framework tables get no hints.
