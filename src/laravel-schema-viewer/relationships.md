---
title: Relationships
description: How foreign keys and Eloquent relations become lines, and what each line style means.
---

# Relationships

Laravel Schema Viewer draws a line for every link between two tables, from two sources:

1. **Foreign keys** read from the database.
2. **Eloquent relations** read from your models: each public method that returns a relation, or whose body calls `$this->hasMany(`, `$this->belongsTo(` and the other builders, is called on a fresh model. Building a relation runs no query, and the object it returns gives the exact keys, pivot table, morph columns and conditions.

When a foreign key and one or more relations use the same columns, they become one line.

## Line styles

| Line | Meaning |
|---|---|
| Solid green | A foreign key that a relation also uses |
| Dashed amber | A relation without a foreign key, so rows can point at deleted ones |
| Solid grey | A foreign key that no model declares |
| Dotted blue | A through relation (`hasOneThrough`, `hasManyThrough`) |

Crow's feet mark the many side of a line. The label names the relation methods and the kind of relationship.

## Relation types

| Relation | Drawn as |
|---|---|
| `belongsTo`, `hasOne`, `hasMany` | A line between the key columns, one-to-one or one-to-many |
| `hasOne()->latestOfMany()`, or a relation with `where` conditions | The same line; the details panel lists the conditions |
| `belongsToMany` | Lines from the pivot table to both sides; the pivot model (`using()`), `withPivot()` columns and accessor (`as()`) are in the details |
| `morphTo`, `morphOne`, `morphMany` | A polymorphic line from the id column to every model whose relation points back at it |
| `morphToMany`, `morphedByMany` | Polymorphic many-to-many lines through the pivot table |
| `hasOneThrough`, `hasManyThrough` | A dotted line from the parent to the far table, labeled with the table in between |
| Self-referencing (`parent_id`) | A loop on the table |
| Related model on another connection | A line to a dashed card for that connection |

Relations registered with `Model::resolveRelationUsing()` and relation classes from other packages are found too. A method that throws when called is reported as a hint instead of breaking the viewer.
