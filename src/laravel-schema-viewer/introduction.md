---
title: Introduction
aside: false
---

<PackageIntroduction />

## Live demo

A sample Laravel store with three database connections (the store, billing and analytics), 200 tables, 162 models and 236 relations. Everything works as it does in your app, downloads included.

<LiveDemo title="Laravel Schema Viewer live demo" />

## Why Laravel Schema Viewer

Laravel has no single schema file. The tables live in the database, and the relationships live in your Eloquent models. Laravel Schema Viewer reads both and draws them together, so anyone on the team can see how the data fits without reading migrations or models.

- **Every table, with or without a model.** Tables, columns, indexes and foreign keys come straight from the database, framework tables included.
- **Every relation your models declare.** `belongsTo`, `hasMany`, `belongsToMany` with its pivot, polymorphic relations, through relations, dynamic relations and third-party relation types. Each one is read from the object the method returns, without running a query.
- **One line per relationship.** A foreign key and the relations that use the same columns become one edge, labeled with the methods and the kind of relationship: one-to-many, many-to-many, polymorphic, has-many-through.
- **Every connection.** Each database connection your app and its models use, side by side, with relations across connections drawn as lines.
- **Hints where the two disagree.** Relations without a foreign key, foreign keys without a relation or an index, models without a table.
- **Made for big schemas.** Browse every table, relationship and column with one filter, pick any of them for its details, fold tables to their keys or their names, focus on a table, a relationship or a column and what is around it, and share a link that opens exactly that view. See [Using the Viewer](./viewer).
- **Straight to the code.** Model and relation names open in your editor at the line that declares them.
- **Downloads and commands.** The database schema as Mermaid, DBML, Markdown or JSON, the whole viewer as one HTML file, and a check that fails your CI on the hints you choose.

Run `php artisan schema-viewer:build` and open `/schema-viewer` in your local environment; nothing to configure. The build writes `schema-viewer.json` in your project root, runs again after every `php artisan migrate` there, and is the only thing the viewer reads.

```bash
composer require laranex/laravel-schema-viewer --dev
```
