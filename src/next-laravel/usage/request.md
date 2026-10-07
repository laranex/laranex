---
title: Request
description: Generate Request classes with Next Laravel's artisan command for validating and authorizing incoming HTTP requests.
---

# Request

You can generate a request by running the following command.

```bash
php artisan next:request StoreBlog Blog
```

::: info
Generated request will be at `app/Modules/BlogModule/Http/Requests/StoreBlogRequest.php`
:::

### Arguments

- `request` — name of the generated request file
- `module` — name of the module where the request will be generated

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [RequestMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/RequestMakeCommand.php)

### Request

```php
use Laranex\NextLaravel\Cores\Request;

class StoreBlogRequest extends Request
{
    public function authorize(): bool
    {
        return false;
    }

    public function rules(): array
    {
        // your validation rules
    }
}
```
