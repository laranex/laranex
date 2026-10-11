---
title: AI Agent Skill
description: Laravel Schema Viewer is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents read your schema before changing it.
---

# AI Agent Skill

Laravel Schema Viewer is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor to read the real schema before writing a migration, a model or a query.

## Installing the skill

If your app uses [Laravel Boost](https://github.com/laravel/boost), the skill is installed for you by `php artisan boost:install`; run `php artisan boost:update` after updating Laravel Schema Viewer to refresh it. With any other agent:

```bash
npx skills add laranex/laravel-schema-viewer
```

Or copy `skills/laravel-schema-viewer` from the [repository](https://github.com/laranex/laravel-schema-viewer) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Understand a Laravel app's database before changing it: read every table, column, index and foreign key together with the Eloquent models and relations that use them, find mismatches between the two, and export the schema as Markdown, JSON, Mermaid or DBML.

It covers when to use the package, installing and configuring it, reading the schema with `schema-viewer:export`, checking it with `schema-viewer:check` and what each hint means, testing your app and what to avoid. It is written from the package source and kept in the repository next to the code.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Laravel Schema Viewer, update the skill the same way you installed it.
