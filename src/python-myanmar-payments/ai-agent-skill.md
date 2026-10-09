---
title: AI Agent Skill
description: Python Myanmar Payments is built for humans and AI agents. Install its agent skill so Claude Code, Codex, Cursor and other coding agents use the package correctly.
---

# AI Agent Skill

Python Myanmar Payments is built for humans and AI agents. These docs are written for developers, and the package also ships an agent skill: a short guide that teaches coding agents such as Claude Code, Codex and Cursor how to install, configure and use Python Myanmar Payments the way it's meant to be used.

## Installing the skill

```bash
npx skills add laranex/python-myanmar-payments
```

Or copy `skills/python-myanmar-payments` from the [repository](https://github.com/laranex/python-myanmar-payments) into your project's `.claude/skills` or `.agents/skills` folder. The folder is also included in the package's source distribution (sdist) on PyPI, under `skills/python-myanmar-payments`.

## What the skill covers

Integrate Myanmar payment gateways (KBZ Pay, Wave Money, AYA Pay, Yoma MMQR, CyberSource) in a Python app (Django, Flask, FastAPI or plain Python) with `python-myanmar-payments`.

It is written from the package source and kept in the repository next to the code, so agents follow the same API, configuration and conventions these docs describe.

## Keeping it current

The skill lives in the package repository and is versioned with it, so it always describes the release you install. When you update Python Myanmar Payments, update the skill the same way you installed it.
