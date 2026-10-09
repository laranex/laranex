---
title: AI Agent Skill
description: Goravel Money is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Goravel Money is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Goravel Money the way it's meant to be used.

## Installing the skill

```bash
npx skills add laranex/goravel-money
```

Or copy `skills/goravel-money` from the [repository](https://github.com/laranex/goravel-money) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Work with money in a Goravel app using github.com/laranex/goravel-money/v4: the immutable `money.Money` value type, ORM column types, exact arithmetic, percentages, allocation, rounding and formatting with the correct precision for every currency.

It covers when to use the package, installing and configuring it, building money, calculating, formatting and serializing, storing amounts in the database, handling errors, testing your app and what to avoid. It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Goravel Money, update the skill the same way you installed it.
