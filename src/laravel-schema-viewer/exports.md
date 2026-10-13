---
title: Downloads & Commands
description: Download the database schema as Mermaid, DBML, Markdown or JSON, export the viewer as a standalone HTML file, and check the schema in CI.
aside: false
---

# Downloads & Commands

## Downloads

**Download** in the top bar (under **⋯** on a phone) opens a dialog: pick a connection, then save its database schema (tables, columns, keys, indexes and foreign keys) in one of the formats below, or the whole viewer as an offline page. The files describe the database only, without models or relations, so any tool can read them.

<LiveDemo title="The live demo with its Download dialog open" open="download" />

| Format | File | For |
|---|---|---|
| Mermaid | `schema-<connection>.mmd` | An ER diagram in a README, an issue or a pull request (GitHub renders ` ```mermaid ` blocks) |
| DBML | `schema-<connection>.dbml` | [dbdiagram.io](https://dbdiagram.io) and other DBML tools |
| Markdown | `schema-<connection>.md` | A readable reference of every table |
| JSON | `schema-<connection>.json` | Scripts and tools |

The Markdown and DBML files carry your [notes](./configuration#notes) next to the database's comments: the project note under the Markdown title and in a DBML `Project` block, table and column notes as `comment · note`.

The page carries every file, from the snapshot `schema-viewer:build` wrote, so a download needs no request to the app and matches the diagram on screen.

**This page as HTML**, under **Use it offline**, saves the whole viewer with every connection as one HTML file that opens in any current browser, offline, the same file as [`--format=html`](#standalone-viewer). Your browser builds it from the page it is on.

## `schema-viewer:build`

Reads the database and the models and writes the snapshot the viewer's page carries, always `schema-viewer.json` in the project root:

```bash
php artisan schema-viewer:build
```

`--check` builds the same file in memory and compares it with the one on disk, without writing anything:

```bash
php artisan schema-viewer:build --check
```

It exits with 0 and `Schema snapshot [schema-viewer.json] is up to date.` when they match, and with 1 when the file is missing or out of date, followed by up to ten lines on what differs (tables added, removed or changed, models, relations, hints) or that the file was written by another version of the package. A UTF-8 BOM and CRLF line endings do not count as a difference. See [Commit it](./installation#commit-it-or-ignore-it) for the CI step.

Run it again after migrating; on a server, run it in your deploy script. The file is readable JSON: `format`, the full `document` (the same as `--format=json` below) and the `downloads` of each connection. Scripts and AI agents read it directly; the viewer has no API. See [The schema snapshot](./installation#the-schema-snapshot).

## `schema-viewer:diff`

Shows what changed in the schema, as text, Markdown or JSON:

```bash
# What changed since the previous build that changed the schema, from the snapshot alone
php artisan schema-viewer:diff

# An older snapshot against the schema now (reads the database and the models, writes nothing)
php artisan schema-viewer:diff base.json

# Two snapshots, without the database or the models
php artisan schema-viewer:diff base.json --against=schema-viewer.json --format=markdown
```

Changes are grouped by table. Each one is a table, column, index or foreign key added, removed or changed with its old and new values, a model or relation, a relationship that gained or lost its foreign key, or a hint that appeared or went away. A renamed table or column shows as one removed and one added. `--format=json` prints `{"version": 1, "changes": [...]}`, each change with its `type`, `change` (added, removed or changed), `connection`, `table`, `name` and `fields` (`[before, after]`); `changes` is `null` when the snapshot has nothing to compare yet. It exits with 0, or with 2 when a file is missing, damaged or written by another version of the package.

In a pull request, compare with the base branch's committed snapshot and write the result to the job summary:

```bash
git show origin/main:schema-viewer.json > base.json
php artisan schema-viewer:diff base.json --against=schema-viewer.json --format=markdown >> "$GITHUB_STEP_SUMMARY"
```

## `schema-viewer:export`

The same formats from the command line, plus the full document, read from the database and the models now rather than from the snapshot:

```bash
php artisan schema-viewer:export --format=markdown
php artisan schema-viewer:export --format=dbml --connection=analytics --output=docs/analytics.dbml
php artisan schema-viewer:export --format=json
```

`--format=json` on the command line writes everything the viewer knows, for every connection: the tables, plus `models`, `relations`, `links` and `hints`. Each model and relation carries its `source`: the file, relative to the app's root, and the line that declares it. Use it when a script or an AI agent needs the Laravel side too.

## Standalone viewer

Export the whole viewer as one HTML file and host it anywhere, without the Laravel app:

```bash
php artisan schema-viewer:export --format=html
php artisan schema-viewer:export --format=html --output=build/schema-viewer
php artisan schema-viewer:export --format=html --output=docs/schema.html
```

`--output` takes a folder, written as `index.html` (default `schema-viewer`), or a `.html` file. The file carries everything: the viewer, its fonts, every connection's tables, models, relations and hints, and the Mermaid, DBML, Markdown and JSON downloads. The viewer and the data are stored compressed, so a large schema stays small; the file needs a current browser (Safari 16.4 or later). Open it from disk, or upload it to GitHub Pages, Netlify, an S3 bucket or any static host, for example as a CI step after migrations.

**Copy link** in the details panel (<kbd>Shift</kbd> <kbd>C</kbd>) copies a link to exactly what is on screen, and it works in the file too. A link such as `schema.html#connection=all&table=mysql:orders&focus=1` opens it on the `orders` table with focus mode on; `relationship=…` or `column=mysql:orders.user_id` opens a relationship or a column instead, and the copied link also keeps the zoom and the columns shown. A pull request can point at exactly what it changes. Editor links are left out, since the file may be opened anywhere.

It shows the schema as it was when exported, so export again after a migration. Anyone who can open the file can read the schema: host it where only your team can.

## `schema-viewer:check`

Lists the hints and exits with an error when a hint of a failing kind remains:

```bash
php artisan schema-viewer:check
php artisan schema-viewer:check --fail-on=foreign_key_without_index
```

The failing kinds come from `hints.fail_on` unless you pass `--fail-on`. Add it to CI to keep the schema and the models in step. Each hint prints as `FAIL` or `NOTE` with its connection, table and kind, followed by `· likely` when it is inferred from names or conventions (see [Hints](./hints)), its message and the narrowest rule that ignores it.

### JSON output

`--format=json` prints the same result as one JSON document, for scripts and AI agents:

```bash
php artisan schema-viewer:check --format=json
```

```json
{
    "version": 1,
    "passed": false,
    "failOn": ["foreign_key_without_index", "unresolved_relation", "model_without_table"],
    "summary": {
        "hints": 2,
        "failing": 1,
        "bySeverity": { "warning": 2 },
        "byCertainty": { "certain": 1, "likely": 1 },
        "byKind": { "foreign_key_without_index": 1, "morph_without_index": 1 }
    },
    "hints": [
        {
            "kind": "foreign_key_without_index",
            "severity": "warning",
            "certainty": "certain",
            "connection": "pgsql",
            "table": "role_user",
            "columns": "role_id",
            "relation": null,
            "message": "role_user.role_id has a foreign key but no index that starts with it, so deleting or updating a role row scans the whole table.",
            "fails": true,
            "ignore": { "hint": { "connection": "pgsql", "table": "role_user", "kind": "foreign_key_without_index", "columns": "role_id" }, "kindOnTable": { … }, "table": { … }, "kind": { … } },
            "ignorePhp": "['connection' => 'pgsql', 'table' => 'role_user', 'kind' => 'foreign_key_without_index', 'columns' => 'role_id'],"
        }
    ]
}
```

The hints come in the order the check lists them, `fails` follows `--fail-on` or `hints.fail_on`, and `ignorePhp` is the rule the text output prints. The exit codes stay the same: 0 when it passes, 1 when a failing hint remains or the schema cannot be read, 2 for an unknown kind or a bad `hints.ignore` rule. When it cannot run, the document is `{"version": 1, "passed": false, "error": "…"}`.
