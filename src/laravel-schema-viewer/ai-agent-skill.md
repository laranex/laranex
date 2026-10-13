---
title: AI Agent Skill
description: Laravel Schema Viewer is built for humans and AI agents. Install its agent skills so Claude Code, Codex, Cursor and other coding agents set it up and read your schema before changing it.
---

# AI Agent Skill

Laravel Schema Viewer is built for humans and AI agents. These docs are written for developers, and the package also ships two agent skills: short guides that teach coding agents such as Claude Code, Codex and Cursor to set the package up and to read the real schema before writing a migration, a model or a query.

## Installing the skills

If your app uses [Laravel Boost](https://github.com/laravel/boost), both skills are installed for you by `php artisan boost:install`; run `php artisan boost:update` after updating Laravel Schema Viewer to refresh them. With any other agent, one command installs both:

```bash
npx skills add laranex/laravel-schema-viewer
```

Or copy `skills/laravel-schema-viewer` and `skills/laravel-schema-viewer-schema` from the [repository](https://github.com/laranex/laravel-schema-viewer) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skills cover

### `laravel-schema-viewer`: set it up

Install, configure and share the package: installing it, building the schema snapshot with `schema-viewer:build`, its settings, who may open the viewer with the `viewSchema` gate or `SchemaViewer::auth()`, accepting hints with `hints.ignore`, failing CI with `schema-viewer:check` and on a stale snapshot with `schema-viewer:build --check`, exporting a standalone HTML viewer, testing your app and what to avoid.

### `laravel-schema-viewer-schema`: read the schema

Learn the app's real database before changing it: read `schema-viewer.json` in the project root when it is there, or every table, column, index and foreign key with `schema-viewer:export --format=markdown`, and the models and relations with `--format=json`. It shows how to answer questions from the JSON (which relation uses a column, whether a foreign key backs it through each link's `state`, where it is declared through `source`, what a model adds, through relations in `derivedLinks`), what each hint kind means, which are only likely, and what to do about it, reading `schema-viewer:check --format=json`, what changed with `schema-viewer:diff`, the notes your team wrote, and how to link a person to a table, relationship or column in the viewer.

Both are written from the package source and kept in the repository next to the code.

## Keeping them current

The skills live in the package repository and are versioned with it, so they always describe the release you install. When you update Laravel Schema Viewer, update the skills the same way you installed them.
