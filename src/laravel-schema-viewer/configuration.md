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
| `middleware` | `['web']` | Route middleware. The `viewSchema` check is always added. |
| `connections` | `null` | `null` reads the default connection and every connection a model uses. A list reads exactly those, e.g. `['mysql', 'analytics']`. |
| `default_connection` | `SCHEMA_VIEWER_DEFAULT_CONNECTION`, `all` | What the viewer opens on: `all` puts every connection on one diagram, or name one, e.g. `mysql`. An unknown name opens on all. The HTML export keeps it. |
| `editor` | `SCHEMA_VIEWER_EDITOR`, `null` | Opens models and relations in your editor at their line: `phpstorm`, `vscode`, `cursor`, `zed`, `sublime` and the other names Laravel's `app.editor` takes, or `['href' => 'myeditor://open?file={file}&line={line}']`. Add `'base_path'` when the editor sees the project at another path (Docker, Sail, WSL). `null` uses `app.editor`, in `local` only; without either there are no editor links. Links with unsafe schemes such as `javascript:` are dropped. |
| `cache.enabled` | `SCHEMA_VIEWER_CACHE`, `true` | Keeps the schema the viewer read until a model file, this config, a connection's migrations or an SQLite database file changes. The refresh button (<kbd>Shift</kbd> <kbd>R</kbd>) reads it again, e.g. after altering a table by hand. The artisan commands never cache. |
| `cache.store` | `SCHEMA_VIEWER_CACHE_STORE`, `null` | The cache store; `null` uses the default. |
| `cache.ttl` | `3600` | Seconds before the schema is read again anyway. |
| `models` | `null` | Folders scanned for models. `null` scans `app/Models`. |
| `exclude_tables` | `[]` | Tables never shown. Wildcards allowed, e.g. `telescope_*`. |
| `framework_tables` | Laravel's own tables, `telescope_*`, `pulse_*` | Shown and tagged, so one toggle hides them. They get no hints. |
| `package_tables` | `true` | Tags the tables of installed packages (Passport, spatie/laravel-permission, Filament Breezy), so one toggle hides them. They still get hints. |
| `hints.ignore` | `[]` | Rules for the hints you have accepted, such as `['connection' => 'mysql', 'table' => 'audit_logs']`; see [Ignoring hints](./hints#ignoring-hints). |
| `hints.fail_on` | `foreign_key_without_index`, `unresolved_relation`, `model_without_table` | Kinds that make `schema-viewer:check` fail. |
