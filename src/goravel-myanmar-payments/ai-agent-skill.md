---
title: AI Agent Skill
description: Goravel Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Goravel Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Goravel Myanmar Payments the way it's meant to be used.

## Installing the skill

```bash
npx skills add laranex/goravel-myanmar-payments
```

Or copy `skills/goravel-myanmar-payments` from the [repository](https://github.com/laranex/goravel-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder.

## What the skill covers

Accept KBZ Pay, Wave Money, AYA Pay, Yoma MMQR and CyberSource payments in a Goravel application with github.com/laranex/goravel-myanmar-payments/v4: facade, config, callbacks, the auto-submit form route and HTTP fakes in tests.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Goravel Myanmar Payments, update the skill the same way you installed it.
