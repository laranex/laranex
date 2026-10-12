---
title: Introduction
aside: false
---

<PackageIntroduction />

## Live demo

A sample Laravel store with three database connections (the store, billing and analytics), 53 tables, 35 models and 81 relations. Everything works as it does in your app, downloads included.

<div class="lx-demo">
  <iframe src="/laravel-schema-viewer/demo/index.html" title="Laravel Schema Viewer live demo" loading="lazy"></iframe>
</div>

<p class="lx-demo__open"><a href="/laravel-schema-viewer/demo/index.html" target="_blank" rel="noopener">Open the demo full screen →</a></p>

## Why Laravel Schema Viewer

Laravel has no single schema file. The tables live in the database, and the relationships live in your Eloquent models. Laravel Schema Viewer reads both and draws them together, so anyone on the team can see how the data fits without reading migrations or models.

- **Every table, with or without a model.** Tables, columns, indexes and foreign keys come straight from the database, framework tables included.
- **Every relation your models declare.** `belongsTo`, `hasMany`, `belongsToMany` with its pivot, polymorphic relations, through relations, dynamic relations and third-party relation types. Each one is read from the object the method returns, without running a query.
- **One line per relationship.** A foreign key and the relations that use the same columns become one edge, labeled with the methods and the kind of relationship: one-to-many, many-to-many, polymorphic, has-many-through.
- **Every connection.** Each database connection your app and its models use, side by side, with relations across connections drawn as lines.
- **Hints where the two disagree.** Relations without a foreign key, foreign keys without a relation or an index, models without a table.
- **Downloads and commands.** The database schema as Mermaid, DBML, Markdown or JSON, the whole viewer as one HTML file, and a check that fails your CI on the hints you choose.

Open `/schema-viewer` in your local environment and the diagram is there; nothing to configure.

```bash
composer require laranex/laravel-schema-viewer:^1.0@alpha --dev
```
