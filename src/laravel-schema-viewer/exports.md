---
title: Downloads & Commands
description: Download the database schema as Mermaid, DBML, Markdown or JSON, and check the schema in CI.
---

# Downloads & Commands

## Downloads

The Download menu saves the selected connection's database schema: tables, columns, keys, indexes and foreign keys. The files describe the database only, without models or relations, so any tool can read them.

<Screenshot src="/laravel-schema-viewer/download" alt="The Download menu with Mermaid, DBML, Markdown and JSON for the selected connection" />

| Format | File | For |
|---|---|---|
| Mermaid | `schema-<connection>.mmd` | An ER diagram in a README, an issue or a pull request (GitHub renders ` ```mermaid ` blocks) |
| DBML | `schema-<connection>.dbml` | [dbdiagram.io](https://dbdiagram.io) and other DBML tools |
| Markdown | `schema-<connection>.md` | A readable reference of every table |
| JSON | `schema-<connection>.json` | Scripts and tools |

The server builds each file, so a large schema downloads the same as a small one.

## `schema-viewer:export`

The same formats from the command line, plus the full document:

```bash
php artisan schema-viewer:export --format=markdown
php artisan schema-viewer:export --format=dbml --connection=analytics --output=docs/analytics.dbml
php artisan schema-viewer:export --format=json
```

`--format=json` on the command line writes everything the viewer knows, for every connection: the tables, plus `models`, `relations`, `links` and `hints`. Use it when a script or an AI agent needs the Laravel side too.

## `schema-viewer:check`

Lists the hints and exits with an error when a hint of a failing kind remains:

```bash
php artisan schema-viewer:check
php artisan schema-viewer:check --fail-on=foreign_key_without_index
```

The failing kinds come from `hints.fail_on` unless you pass `--fail-on`. Add it to CI to keep the schema and the models in step.
