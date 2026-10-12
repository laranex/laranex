---
title: Installation
description: Install Next Laravel via Composer. Requires PHP 8.1+ and Laravel 10.48.29+ on 10.x, or Laravel 11, 12 or 13.
---

# Installation

## Via Composer

> **Requires** PHP 8.1+ and Laravel 10 (10.48.29 or later), 11, 12 or 13.

You may install **[Next Laravel](https://github.com/laranex/next-laravel)** into your Laravel application by running the following command.

```bash
composer require laranex/next-laravel
```

The `NextLaravelServiceProvider` and the `NextLaravel` facade alias are registered automatically through package discovery. Publishing the config, views or stubs is optional, see [Configuration](/next-laravel/configuration).

## Commands

The package registers one generator command per unit. Every unit except routes is generated inside a module.

| Command | Generates |
|---|---|
| `next:route {route} {versionOrDirectory?} [--api] [--force]` | `routes/{web\|api}/[versionOrDirectory/]{routes}.php` |
| `next:controller {controller} {module} [--force]` | `app/Modules/{Module}Module/Http/Controllers/{Name}Controller.php` |
| `next:request {request} {module} [--force]` | `app/Modules/{Module}Module/Http/Requests/{Name}Request.php` |
| `next:feature {feature} {module} [--force]` | `app/Modules/{Module}Module/Features/{Name}Feature.php` |
| `next:operation {operation} {module} [--force]` | `app/Modules/{Module}Module/Operations/{Name}Operation.php` |
| `next:job {job} {module} [--queue] [--force]` | `app/Modules/{Module}Module/Jobs/{Name}Job.php` |

Each command exits with `0` when the file is generated and `1` when generation fails, for example when the file already exists and `--force` was not given, or when a name is invalid (see [Naming rules](#naming-rules)).

### Naming rules

The generators check every name before writing a file, so a name can never inject code into a stub or write outside its directory. Invalid input exits with an error and code `1`, and no file is written.

| Input | Rule |
|---|---|
| Class and module names | Must not contain `/` or `\` (nested names such as `Blog/CreatePost` are not supported), and the generated name (with its suffix) must match `^[A-Za-z_][A-Za-z0-9_]*$`: letters, numbers and underscores, not starting with a number |
| Route names | The generated file name (pluralized kebab-case) must match `^[a-z0-9_-]+$`: lowercase letters, numbers, `-` and `_` |
| `versionOrDirectory` | `/`-separated segments that each match `^[a-z0-9_-]+$` (so no `..`) |
| Route file type | `web` or `api` (`--api` selects `api`) |

## Facade

The `NextLaravel` facade exposes the helper the service provider uses to discover route files.

```php
use Laranex\NextLaravel\Facades\NextLaravel;

// Every .php file under routes/api, recursively, as absolute paths,
// in sorted order
$files = NextLaravel::getAllFilesOfADirectory(base_path('routes/api'), 'php');
```

`getAllFilesOfADirectory(string $directory, string $extension = '')` returns an empty array when the directory does not exist, and every file when `$extension` is empty.
