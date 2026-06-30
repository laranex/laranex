---
title: Controller
description: Generate controllers with Better Laravel's artisan command and serve Features using the built-in serve method.
---

# Controller

You can generate a controller by running the following command.

```bash
php artisan better:controller Blog Blog
```

::: info
Generated controller will be at `app/Modules/BlogModule/Http/Controllers/BlogController.php`
:::

### Arguments

- `controller` — name of the generated controller file
- `module` — name of the module where the controller will be generated

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [ControllerMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/ControllerMakeCommand.php)

### Serving Features

:::warning
The controller must extend `Laranex\BetterLaravel\Cores\Controller` to use the `serve` method.
:::

```php
use App\Modules\BlogModule\Features\StoreBlogFeature;
use Laranex\BetterLaravel\Cores\Controller;

class BlogController extends Controller
{
    public function store()
    {
        return $this->serve(StoreBlogFeature::class);
        // OR
        return $this->serve(new StoreBlogFeature());
    }
}
```
