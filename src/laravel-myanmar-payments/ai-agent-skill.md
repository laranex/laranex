---
title: AI Agent Skill
description: Laravel Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Laravel Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Laravel Myanmar Payments the way it's meant to be used.

## With Laravel Boost

If your app uses [Laravel Boost](https://github.com/laravel/boost), the skill is installed for you:

```bash
php artisan boost:install
```

Already set up? Run `php artisan boost:update` after updating Laravel Myanmar Payments to refresh it.

## With any other agent

```bash
npx skills add laranex/laravel-myanmar-payments
```

Or copy `skills/laravel-myanmar-payments` from the [repository](https://github.com/laranex/laravel-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Integrate Myanmar payment gateways (KBZ Pay, Wave Money, AYA Pay, Yoma MMQR, CyberSource) in a Laravel app with laranex/laravel-myanmar-payments.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Laravel Myanmar Payments, update the skill the same way you installed it.
