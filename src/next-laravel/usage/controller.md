---
title: Controller
description: Generate controllers with Next Laravel's artisan command and serve Features using the built-in serve method.
---

# Controller

You can generate a controller by running the following command.

```bash
php artisan next:controller Blog Blog
```

::: info
Generated controller will be at `app/Modules/BlogModule/Http/Controllers/BlogController.php`
:::

### Arguments

- `controller` — name of the generated controller file (`Controller` is appended when missing)
- `module` — name of the module where the controller will be generated (`Module` is appended when missing)

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [ControllerMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/ControllerMakeCommand.php)

### Serving features

:::warning
The controller must extend `Laranex\NextLaravel\Cores\Controller` to use the `serve` method.
:::

`serve(string|object $feature, array $arguments = []): mixed` dispatches the feature synchronously and returns whatever its `handle` method returns. Pass an instance, or a class name together with the constructor arguments (positional or named). Dependencies type-hinted on `handle` (such as a form request) are resolved from the container.

```php
use App\Modules\BlogModule\Features\StoreBlogFeature;
use Laranex\NextLaravel\Cores\Controller;

class BlogController extends Controller
{
    public function store()
    {
        return $this->serve(StoreBlogFeature::class);
        // Or pass an instance:
        // return $this->serve(new StoreBlogFeature());
    }
}
```

`Cores\Controller` also uses Laravel's `ValidatesRequests` trait, so `$this->validate()` is available.
