---
title: Hints
description: Where the database and the models disagree, and how to act on each hint.
---

# Hints

Hints point at places where the database and the models disagree. They are informational: the Hints tab lists them, the table card shows a count, and `schema-viewer:check` can fail your CI on the kinds you choose. Framework tables never get hints.

<Screenshot src="/laravel-schema-viewer/hints" alt="The Hints tab listing warnings and notes, each with a link to its table" />

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

Some packages own tables that skip foreign keys by design. While Passport (`oauth_*`), spatie/laravel-permission (its five tables, renamed ones included) or Filament Breezy (`breezy_*`) is installed, their tables count as framework tables: shown, tagged and free of hints. Set `package_tables` to `false` to treat them as your own.

## Ignoring hints

Accept a hint for good in `config/schema-viewer.php`, by kind or for one table:

```php
'hints' => [
    'ignore' => ['morph_without_map', 'relation_without_foreign_key:audit_logs'],
],
```
