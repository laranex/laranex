---
title: Hints
description: Where the database and the models disagree, where the database itself could be better, and how to act on each hint.
aside: false
---

# Hints

Hints point at places where the database and the models disagree, and where the database itself could be better. They are informational: the Hints tab (<kbd>H</kbd>) lists them, the table card shows a count, and `schema-viewer:check` can fail your CI on the kinds you choose. Framework tables never get hints.

Each hint has a **severity** (warning or info) and a **certainty**. A *certain* hint states a fact read from the database or the models. A *likely* hint is inferred from names or conventions, such as a column called `user_id` or a pair of `_type` and `_id` columns; the viewer marks it **likely** and `schema-viewer:check` prints `· likely` after its kind, so check it against your code and queries before changing anything. When both are listed, the Hints tab filters them with **All**, **Certain** and **Likely**.

## Where the database and the models disagree

<LiveDemo title="The live demo on its Hints tab: open Ignore… under a hint for the rules that leave it out" shortcut="h" />

| Kind | Certainty | Meaning | Usual fix |
|---|---|---|---|
| `relation_without_foreign_key` | Certain | A relation uses columns with no foreign key, so rows can point at deleted ones | Add a foreign key in a migration, or ignore it when intended |
| `foreign_key_without_relation` | Certain | A foreign key that no model declares | Add the `belongsTo` / `hasMany` pair |
| `foreign_key_without_index` | Certain | A foreign key column with no index that starts with it (PostgreSQL, SQLite and SQL Server do not add one) | Add an index |
| `model_without_table` | Certain | A model whose table does not exist on its connection | Run the migration, or fix `$table` / `$connection` |
| `morph_without_map` | Certain | Morph columns store class names such as `App\Models\Post`, so renaming a model breaks rows | Register `Relation::enforceMorphMap()` |
| `unresolved_relation` | Certain | A relation method of your app threw when called on a blank model (no row loaded) | Fix the method, or make it work without a loaded row |
| `unresolved_package_relation` | Certain | The same, for a method a model inherits from a package, such as Passport's `Token::user()`. A note, not a failure by default | Nothing, unless the relation matters to you |
| `custom_relation` | Certain | A relation without a foreign key whose query joins other tables, or whose keys match a column that is not unique, so a foreign key would not describe it | Nothing; it is a note |

Polymorphic relations and relations across connections cannot have a foreign key, so they never get `relation_without_foreign_key`. A relation that only adds conditions, such as `->where('approved', true)`, still does: its columns are the link.

## Structural hints

These look at the database alone, whatever the models say. Like the others, they skip framework tables and cover package tables.

| Kind | Severity | Certainty | Meaning | Usual fix |
|---|---|---|---|---|
| `table_without_primary_key` | Warning | Certain | A table with no primary key, so one row cannot be updated or deleted reliably and some replication setups refuse it. The message names a unique index on non-null columns that could become the key, and, for a pivot table, the composite key that stops a pair being attached twice | Add a primary key, such as `$table->primary(['post_id', 'tag_id'])` |
| `foreign_key_type_mismatch` | Warning | Certain | A foreign key column whose type differs from the column it references: another type, signed against unsigned, or another length | Change the column to the referenced column's type |
| `foreign_key_name_mismatch` | Info | Likely | A `<name>_id` column whose foreign key references another table, while a `<name>` table exists: `user_id` pointing at `admins` while `users` exists. A prefixed table (`category_id` to `post_categories`) and a column with no table of its name (`author_id` to `users`) are fine | Rename the column, or point the key at the table it names |
| `index_duplicates_primary_key` | Warning | Certain | An index on exactly the primary key's columns | Drop it |
| `duplicate_index` | Warning | Certain | Two or more indexes on the same columns, all unique or all not; one hint names them all | Keep one |
| `redundant_index` | Info | Likely | A non-unique index whose columns another index starts with, or equal to a unique index's | Drop it, unless a query needs the smaller index |
| `morph_without_index` | Warning | Likely | A `<name>_type` text column and a `<name>_id` column, a polymorphic pair, that no index covers together | `$table->index(['<name>_type', '<name>_id'])`, which `morphs()` adds for you |

Index hints compare only plain indexes of the same structure. A partial index (PostgreSQL and SQLite `WHERE`, SQL Server filtered), an index on an expression such as `lower(email)`, a MySQL prefix index such as `name(10)`, an index with `INCLUDE` columns (PostgreSQL, SQL Server), and full-text, spatial, GIN, GiST or hash indexes serve other queries, so they are never called duplicate or redundant, and a unique index is never called redundant. MySQL and MariaDB index every foreign key column themselves, so `foreign_key_without_index` never shows there. SQLite compares types by their affinity, so `varchar(36)` and `text` match. A type comparison does not look at collations.

## Package tables

Tables a package creates are tagged with it while Composer has the package installed: by default Laravel's own packages: Passport (`oauth_*`), Cashier, Cashier Paddle, Pennant, Pulse (`pulse_*`), Sanctum (`personal_access_tokens`) and Telescope (`telescope_*`); add others in `package_tables` (see [Configuration](./configuration)). **Package tables** in the **Tables** menu (<kbd>P</kbd>) shows or hides them. They get hints like your own tables; ignore the ones you accept as below. Set `package_tables` to `false` to leave them untagged.

## Ignoring hints

Accept a hint for good by adding a rule to `hints.ignore` in `config/schema-viewer.php`. A hint is left out when it matches **every field the rule names**; a field you leave out matches anything.

```php
'hints' => [
    'ignore' => [
        // A kind, everywhere
        ['kind' => 'morph_without_map'],

        // A whole connection
        ['connection' => 'legacy'],

        // A whole table on one connection
        ['connection' => 'mysql', 'table' => 'audit_logs'],

        // Tables on any connection, by wildcard (here Passport's)
        ['table' => 'oauth_*'],

        // A kind on one table
        ['connection' => 'mysql', 'table' => 'posts', 'kind' => 'relation_without_foreign_key'],

        // One hint, by its columns
        ['connection' => 'mysql', 'table' => 'comments', 'kind' => 'relation_without_foreign_key', 'columns' => 'user_id'],

        // One hint, by its relation
        ['kind' => 'unresolved_relation', 'relation' => 'App\Models\User::team'],

        // Every hint inferred from names or conventions
        ['certainty' => 'likely'],
    ],
],
```

| Field | Matches | Wildcards |
|---|---|---|
| `connection` | The connection name | Yes, such as `analytics_*` |
| `table` | The table name | Yes, such as `oauth_*` |
| `kind` | A hint kind from the table above | No |
| `columns` | The columns the hint is about, comma separated: `user_id` or `user_id,team_id` | No |
| `relation` | The relation method, for hints about a relation that could not be read | No |
| `certainty` | `certain` or `likely` | No |

You rarely type a rule. Under each hint, **Ignore…** in the Hints tab and in the details of a table, relationship or column opens a dialog with the rules that leave it out, from only this hint to every hint of its kind, each with a Copy button. `schema-viewer:check` prints the narrowest one under each hint, and the JSON export carries all of them in each hint's `ignore`.

An unknown field, kind or certainty stops `schema-viewer:check` with an error, so a typo never ignores the wrong hints.
