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

Integrate Myanmar payment gateways (KBZ Pay, Wave Pay, AYA Pay, Yoma MMQR, CyberSource) in a Laravel app with laranex/laravel-myanmar-payments.
