---
title: AI Agent Skill
description: NestJS Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

NestJS Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use NestJS Myanmar Payments the way it's meant to be used.

## With any agent

```bash
npx skills add laranex/nestjs-myanmar-payments
```

Or copy `skills/nestjs-myanmar-payments` from the [repository](https://github.com/laranex/nestjs-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder. The npm package ships the same folder, so it is also in `node_modules/@laranex/nestjs-myanmar-payments/skills`.

## What the skill covers

Integrate Myanmar payment gateways (KBZ Pay, Wave Money, AYA Pay, Yoma MMQR, CyberSource) in a NestJS app with @laranex/nestjs-myanmar-payments.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update NestJS Myanmar Payments, update the skill the same way you installed it.
