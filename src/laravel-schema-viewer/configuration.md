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
| `framework_tables` | Laravel's own tables, below | Shown and tagged, so one toggle hides them. They get no hints. |
| `package_tables` | Laravel's own packages, below | Table patterns by Composer package name. While a package is installed, its tables are tagged with its name, so one toggle hides them; they still get hints. Add your own packages, or set `false` to tag nothing. |
| `notes` | none | Your own notes on the project, tables and columns, shown in the viewer and written into the exports; see [Notes](#notes). |
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
    'laravel/pulse' => ['pulse_*'],
    'laravel/sanctum' => ['personal_access_tokens'],
    'laravel/telescope' => ['telescope_*'],

    // Your own, for example:
    'spatie/laravel-permission' => ['permissions', 'roles', 'model_has_permissions', 'model_has_roles', 'role_has_permissions'],
],
```

### Notes

Explain what the schema does not say: what a table holds, which values a column takes, who to ask. Notes show in the viewer beside the database's own comments, and go into the Markdown and DBML downloads and the JSON.

```php
'notes' => [
    'project' => 'The shop and its analytics. Orders are placed by users and paid through Stripe.',
    'tables' => [
        'orders' => 'One row per checkout, kept after a refund.',
        // Only the events table of the analytics connection
        'analytics:events' => 'Raw tracking events, cleared after 90 days.',
    ],
    'columns' => [
        'orders' => ['status' => 'pending, paid, shipped or refunded.'],
    ],
],
```

A table name without a connection applies on every connection that has that table; `connection:table` picks one, and wins over the plain name. Both the database comment and the note are kept: the viewer shows the comment, then the note, and formats with one place for it (Markdown's Comment column, DBML's `note`) write `comment · note`. The project note shows in the Details tab before anything is picked, under the title of the Markdown download and in a DBML `Project` block.

Every note must be a string; anything else stops `schema-viewer:build` with an error. A note on a table or column that does not exist is not an error: the build warns, for example `2 notes match nothing: orders.stauts, invoices.`. Notes are part of the snapshot and of an HTML export, so they are seen by everyone who can open them.

### Framework tables

`framework_tables` is a plain list of table patterns: the tables Laravel itself creates (`migrations`, `jobs`, `job_batches`, `failed_jobs`, `cache`, `cache_locks`, `sessions`, `password_reset_tokens`, `notifications`). Framework tables get no hints. Tables of Laravel's packages, such as Telescope, Pulse and Sanctum, are package tables.
