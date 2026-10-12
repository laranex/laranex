---
title: Hints
description: Where the database and the models disagree, and how to act on each hint.
---

# Hints

Hints point at places where the database and the models disagree. They are informational: the Hints tab lists them, the table card shows a count, and `schema-viewer:check` can fail your CI on the kinds you choose. Framework tables never get hints.

<LiveDemo title="The live demo on its Hints tab: open Ignore… under a hint for the rules that leave it out" shortcut="h" />

| Kind | Meaning | Usual fix |
|---|---|---|
| `relation_without_foreign_key` | A relation uses columns with no foreign key, so rows can point at deleted ones | Add a foreign key in a migration, or ignore it when intended |
| `foreign_key_without_relation` | A foreign key that no model declares | Add the `belongsTo` / `hasMany` pair |
| `foreign_key_without_index` | A foreign key column with no index that starts with it (PostgreSQL, SQLite and SQL Server do not add one) | Add an index |
| `model_without_table` | A model whose table does not exist on its connection | Run the migration, or fix `$table` / `$connection` |
| `morph_without_map` | Morph columns store class names such as `App\Models\Post`, so renaming a model breaks rows | Register `Relation::enforceMorphMap()` |
| `unresolved_relation` | A relation method of your app threw when called on a blank model (no row loaded) | Fix the method, or make it work without a loaded row |
| `unresolved_package_relation` | The same, for a method a model inherits from a package, such as Passport's `Token::user()`. A note, not a failure by default | Nothing, unless the relation matters to you |
| `custom_relation` | A relation without a foreign key whose query joins other tables, or whose keys match a column that is not unique, so a foreign key would not describe it | Nothing; it is a note |

Polymorphic relations and relations across connections cannot have a foreign key, so they never get `relation_without_foreign_key`. A relation that only adds conditions, such as `->where('approved', true)`, still does: its columns are the link.

## Package tables

Tables that a known package creates are tagged with it: Passport (`oauth_*`), spatie/laravel-permission (its five tables, renamed ones included) and Filament Breezy (`breezy_*`). The **Package tables** toggle (<kbd>P</kbd>) shows or hides them. They get hints like your own tables; ignore the ones you accept as below. Set `package_tables` to `false` to leave them untagged.

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

You rarely type a rule. Under each hint, **Ignore…** in the Hints tab and in the table details lists the rules that leave it out, from only this hint to every hint of its kind, each with a Copy button. `schema-viewer:check` prints the narrowest one under each hint, and the JSON export carries all of them in each hint's `ignore`.

An unknown field or kind stops `schema-viewer:check` with an error, so a typo never ignores the wrong hints.
