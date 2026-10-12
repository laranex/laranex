---
title: Downloads & Commands
description: Download the database schema as Mermaid, DBML, Markdown or JSON, export the viewer as a standalone HTML file, and check the schema in CI.
aside: false
---

# Downloads & Commands

## Downloads

The Download menu saves the selected connection's database schema: tables, columns, keys, indexes and foreign keys. The files describe the database only, without models or relations, so any tool can read them.

<LiveDemo title="The live demo with its Download menu open" open="download" />

| Format | File | For |
|---|---|---|
| Mermaid | `schema-<connection>.mmd` | An ER diagram in a README, an issue or a pull request (GitHub renders ` ```mermaid ` blocks) |
| DBML | `schema-<connection>.dbml` | [dbdiagram.io](https://dbdiagram.io) and other DBML tools |
| Markdown | `schema-<connection>.md` | A readable reference of every table |
| JSON | `schema-<connection>.json` | Scripts and tools |

The server builds each file, so a large schema downloads the same as a small one.

**This page as HTML**, under **Use it offline**, saves the whole viewer with every connection as one HTML file that opens in any current browser, offline, the same file as [`--format=html`](#standalone-viewer). Your browser builds it from the page it is on.

## `schema-viewer:export`

The same formats from the command line, plus the full document:

```bash
php artisan schema-viewer:export --format=markdown
php artisan schema-viewer:export --format=dbml --connection=analytics --output=docs/analytics.dbml
php artisan schema-viewer:export --format=json
```

`--format=json` on the command line writes everything the viewer knows, for every connection: the tables, plus `models`, `relations`, `links` and `hints`. Each model and relation carries its `source`: the file, relative to the app's root, and the line that declares it. Use it when a script or an AI agent needs the Laravel side too.

## Standalone viewer

Export the whole viewer as one HTML file and host it anywhere, without the Laravel app or its API:

```bash
php artisan schema-viewer:export --format=html
php artisan schema-viewer:export --format=html --output=build/schema-viewer
php artisan schema-viewer:export --format=html --output=docs/schema.html
```

`--output` takes a folder, written as `index.html` (default `schema-viewer`), or a `.html` file. The file carries everything: the viewer, its fonts, every connection's tables, models, relations and hints, and the Mermaid, DBML, Markdown and JSON downloads. The viewer and the data are stored compressed, so a large schema stays small; the file needs a current browser (Safari 16.4 or later). Open it from disk, or upload it to GitHub Pages, Netlify, an S3 bucket or any static host, for example as a CI step after migrations.

**Copy link** works in the file too: a link such as `schema.html#connection=all&table=mysql:orders&focus=1` opens it on the `orders` table with focus mode on, so a pull request can point at the tables it changes. Editor links are left out, since the file may be opened anywhere.

It shows the schema as it was when exported, so export again after a migration. Anyone who can open the file can read the schema: host it where only your team can.

## `schema-viewer:check`

Lists the hints and exits with an error when a hint of a failing kind remains:

```bash
php artisan schema-viewer:check
php artisan schema-viewer:check --fail-on=foreign_key_without_index
```

The failing kinds come from `hints.fail_on` unless you pass `--fail-on`. Add it to CI to keep the schema and the models in step.
