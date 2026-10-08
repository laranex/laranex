---
title: Configuration
description: Configure the locale, NRC data file and whether NRCs are validated against the database or the JSON file.
---

# Configuration

Publish the config file (optional):

```bash
php artisan vendor:publish --tag="laravel-myanmar-nrc-config"
```

```php
return [
    'locale' => 'en',
    'json_file' => null,
    'db_driven' => true,
];
```

| Option | Default | Description |
|---|---|---|
| `locale` | `en` | Language used when parsing: `en` or `mm`. Only `parse()` reads it; `isValid()` and the validation rule ignore it |
| `json_file` | `null` | NRC data file. `null` uses the bundled file. Use your own (e.g. `storage_path('nrc.json')`) and re-run `php artisan mm-nrc:seed` |
| `db_driven` | `true` | Validate and parse against the database (`true`) or the JSON file (`false`). Can be overridden per call |

A custom JSON file must contain a `types` array and a `states` array. Each state has a `townships` array. Every row has `id`, `code`, `code_mm`, `name` and `name_mm`.

## Publish tags

| Tag | Publishes |
|---|---|
| `laravel-myanmar-nrc-config` | `config/laravel-myanmar-nrc.php` |
| `laravel-myanmar-nrc-lang` | `lang/vendor/laravel-myanmar-nrc` (validation messages in `en` and `mm`) |
| `laravel-myanmar-nrc-migrations` | The three NRC migrations into `database/migrations`, timestamped |
| `laravel-myanmar-nrc` | All of the above |
