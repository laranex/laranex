---
title: Installation
description: Install Better Laravel via Composer. Requires PHP 8.1+ and Laravel 10.48.29+ on 10.x, or Laravel 11, 12 or 13.
---

# Installation

## Via Composer

> **Requires** PHP 8.1+ and Laravel 10 (10.48.29 or later), 11, 12 or 13.

You may install **[Better Laravel](https://github.com/laranex/better-laravel)** into your Laravel application by running the following command.

```bash
composer require laranex/better-laravel
```

The `BetterLaravelServiceProvider` and the `BetterLaravel` facade alias are registered automatically through package discovery. Publishing the config, views or stubs is optional, see [Configuration](/better-laravel/configuration).

## Commands

The package registers one generator command per unit.

| Command | Generates |
|---|---|
| `better:route {route} {versionOrDirectory?} [--api] [--force]` | `routes/{web\|api}/[versionOrDirectory/]{routes}.php` |
| `better:controller {controller} {module} [--force]` | `app/Modules/{Module}Module/Http/Controllers/{Name}Controller.php` |
| `better:feature {feature} {module} [--force]` | `app/Modules/{Module}Module/Features/{Name}Feature.php` |
| `better:operation {operation} {module} [--force]` | `app/Modules/{Module}Module/Operations/{Name}Operation.php` |
| `better:request {request} {domain} [--force]` | `app/Domains/{Domain}/Requests/{Name}Request.php` |
| `better:job {job} {domain} [--queue] [--force]` | `app/Domains/{Domain}/Jobs/{Name}Job.php` |

Each command exits with `0` when the file is generated and `1` when generation fails, for example when the file already exists and `--force` was not given, or when a name is invalid (see [Naming rules](#naming-rules)).

### Naming rules

The generators check every name before writing a file, so a name can never inject code into a stub or write outside its directory. Invalid input exits with an error and code `1`, and no file is written.

| Input | Rule |
|---|---|
| Class, module and domain names | Must not contain `/` or `\` (nested names such as `Blog/CreatePost` are not supported), and the generated name (with its suffix) must match `^[A-Za-z_][A-Za-z0-9_]*$`: letters, numbers and underscores, not starting with a number |
| Route names | The generated file name (pluralized kebab-case) must match `^[a-z0-9_-]+$`: lowercase letters, numbers, `-` and `_` |
| `versionOrDirectory` | `/`-separated segments that each match `^[a-z0-9_-]+$` (so no `..`) |
| Route file type | `web` or `api` (`--api` selects `api`) |

## Facade

The `BetterLaravel` facade exposes the helper the service provider uses to discover route files.

```php
use Laranex\BetterLaravel\Facades\BetterLaravel;

// Every .php file under routes/api, recursively, as absolute paths,
// in sorted order
$files = BetterLaravel::getAllFilesOfADirectory(
    base_path('routes/api'),
    'php',
);
```

`getAllFilesOfADirectory(string $directory, string $extension = '')` returns an empty array when the directory does not exist, and every file when `$extension` is empty.
