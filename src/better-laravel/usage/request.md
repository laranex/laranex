---
title: Request
description: Generate Request classes with Better Laravel's artisan command for validating and authorizing incoming HTTP requests.
---

# Request

You can generate a request by running the following command.

```bash
php artisan better:request StoreBlog Blog
```

::: info
Generated request will be at `app/Domains/Blog/Requests/StoreBlogRequest.php`
:::

### Arguments

- `request` — name of the generated request file
- `domain` — name of the domain where the request will be generated

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [RequestMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/RequestMakeCommand.php)

### Request

```php
use Laranex\BetterLaravel\Cores\Request;

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
