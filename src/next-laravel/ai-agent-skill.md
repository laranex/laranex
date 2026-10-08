---
title: AI Agent Skill
description: Next Laravel is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Next Laravel is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Next Laravel the way it's meant to be used.

## With Laravel Boost

If your app uses [Laravel Boost](https://github.com/laravel/boost), the skill is installed for you:

```bash
php artisan boost:install
```

Already set up? Run `php artisan boost:update` after updating Next Laravel to refresh it.

## With any other agent

```bash
npx skills add laranex/next-laravel
```

Or copy `skills/next-laravel-development` from the [repository](https://github.com/laranex/next-laravel) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Structure a Laravel application into modules (controllers, requests, features, operations, jobs) with laranex/next-laravel, generate units with the next:* Artisan commands and let route files under routes/web and routes/api be discovered.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Next Laravel, update the skill the same way you installed it.
