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

- `request` — name of the generated request file (`Request` is appended when missing)
- `module` — name of the module where the request will be generated (`Module` is appended when missing)

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [RequestMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/RequestMakeCommand.php)

### Request

`Laranex\NextLaravel\Cores\Request` extends Laravel's `FormRequest`. Type-hint it on a feature's `handle` method to validate the incoming request before the feature runs. The generated `authorize` method returns `false`; change it before using the request.

```php
use Laranex\NextLaravel\Cores\Request;

class StoreBlogRequest extends Request
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
        ];
    }
}
```
