---
title: AI Agent Skill
description: Node Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Node Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Node Myanmar Payments the way it's meant to be used.

## Installing the skill

```bash
npx skills add laranex/node-myanmar-payments
```

Or copy `skills/node-myanmar-payments` from the [repository](https://github.com/laranex/node-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder. The folder is also included in the npm package, under `node_modules/@laranex/myanmar-payments/skills/node-myanmar-payments`.

## What the skill covers

Integrate Myanmar payment gateways (KBZ Pay, Wave Money, AYA Pay, Yoma MMQR, CyberSource) in a Node.js or TypeScript app with `@laranex/myanmar-payments`.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Node Myanmar Payments, update the skill the same way you installed it.
