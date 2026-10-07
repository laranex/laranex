---
title: Configuration
description: Configure the locale, NRC data file and whether NRCs are validated against the database or the JSON file.
---

# Configuration

Publish the config file and translations (optional):

```bash
php artisan vendor:publish --tag="laravel-myanmar-nrc"
```

```php
return [
    'locale' => 'en',
    'json_file' => 'nrc.json',
    'db_driven' => true,
];
```

| Option | Default | Description |
|---|---|---|
| `locale` | `en` | Language used when parsing: `en` or `mm` |
| `json_file` | `nrc.json` | NRC data file. Use your own (e.g. `storage_path('nrc.json')`) and re-run `php artisan mm-nrc:seed` |
| `db_driven` | `true` | Validate and parse against the database (`true`) or the JSON file (`false`) |
