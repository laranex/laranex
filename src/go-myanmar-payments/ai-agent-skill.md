---
title: AI Agent Skill
description: Go Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Go Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Go Myanmar Payments the way it's meant to be used.

## Installing the skill

```bash
npx skills add laranex/go-myanmar-payments
```

Or copy `skills/go-myanmar-payments` from the [repository](https://github.com/laranex/go-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder. The folder is also included in the Go module, under `$(go env GOMODCACHE)/github.com/laranex/go-myanmar-payments/v4@<version>/skills/go-myanmar-payments`.

## What the skill covers

Integrate Myanmar payment gateways (KBZ Pay, Wave Money, AYA Pay, Yoma MMQR, CyberSource) in a Go service with github.com/laranex/go-myanmar-payments/v4.

## Keeping it current

When you update Go Myanmar Payments, update the skill the same way you installed it.
