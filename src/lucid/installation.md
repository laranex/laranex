---
title: Installation
description: Install the maintained Lucid package and initialise a monolith or micro structure.
---

# Installation

```bash
composer require laranex/lucid
```

The package ships a `lucid` command-line tool. Run it from your project root:

```bash
vendor/bin/lucid list
```

Initialise the structure for your project:

```bash
vendor/bin/lucid init:monolith   # Lucid Monolith: services under app/Services
vendor/bin/lucid init:micro      # Lucid Micro
```

:::info
PHP 8.4 and Symfony Console 8 (Laravel 13) compatibility fixes are part of the upcoming release.
:::
