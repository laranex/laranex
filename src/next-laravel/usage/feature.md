---
title: Feature
description: Generate Features with Next Laravel's artisan command. Features validate requests, run Jobs and Operations, and return HTTP responses.
---

# Feature

You can generate a feature by running the following command.

```bash
php artisan next:feature StoreBlog Blog
```

::: info
Generated feature will be at `app/Modules/BlogModule/Features/StoreBlogFeature.php`
:::

### Arguments

- `feature` — name of the generated feature file (`Feature` is appended when missing)
- `module` — name of the module where the feature will be generated (`Module` is appended when missing)

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [FeatureMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/FeatureMakeCommand.php)

### Running jobs

:::warning
Feature must extend `Laranex\NextLaravel\Cores\Feature` to use the `run` or `runInQueue` methods.
:::

| Method | Returns |
|---|---|
| `run(string\|object $unit, array $arguments = [])` | Whatever the unit's `handle` method returns |
| `runInQueue(string\|object $unit, array $arguments = [], string $queue = 'default')` | The pending dispatch |

Both methods accept an instance, or a class name together with its constructor arguments (positional or named). `runInQueue` throws an `Error` when the unit cannot be queued: operations are never queueable, and jobs must extend `Laranex\NextLaravel\Cores\QueueableJob`.

```php
use App\Models\Blog;
use App\Modules\BlogModule\Http\Requests\StoreBlogRequest;
use App\Modules\BlogModule\Jobs\StoreBlogJob;
use Laranex\NextLaravel\Cores\Feature;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        return $this->run(StoreBlogJob::class, ['payload' => $request->validated()]);
        // Or
        return $this->run(new StoreBlogJob($request->validated()));
    }
}
```

### Running queue jobs

```php
use App\Modules\BlogModule\Jobs\NotifyViaEmailJob;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        $blog = $this->run(new StoreBlogJob($request->validated()));

        $this->runInQueue(new NotifyViaEmailJob($blog));
        // Or on a named queue
        $this->runInQueue(NotifyViaEmailJob::class, [$blog], 'emails');

        return $blog;
    }
}
```

### Running operations

```php
use App\Modules\BlogModule\Operations\NotifySubscribersOperation;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        $blog = $this->run(new StoreBlogJob($request->validated()));

        $this->run(new NotifySubscribersOperation($blog));

        return $blog;
    }
}
```
