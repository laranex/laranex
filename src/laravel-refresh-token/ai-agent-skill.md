---
title: AI Agent Skill
description: Laravel Refresh Token is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Laravel Refresh Token is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Laravel Refresh Token the way it's meant to be used.

## With Laravel Boost

If your app uses [Laravel Boost](https://github.com/laravel/boost), the skill is installed for you:

```bash
php artisan boost:install
```

Already set up? Run `php artisan boost:update` after updating Laravel Refresh Token to refresh it.

## With any other agent

```bash
npx skills add laranex/laravel-refresh-token
```

Or copy `skills/laravel-refresh-token` from the [repository](https://github.com/laranex/laravel-refresh-token) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Issue, verify, rotate, revoke and prune RS256 JWT refresh tokens for Eloquent models in a Laravel app with laranex/laravel-refresh-token.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Laravel Refresh Token, update the skill the same way you installed it.
