---
title: Feature
description: Generate Features with Better Laravel's artisan command. Features validate requests, run Jobs and Operations, and return HTTP responses.
---

# Feature

You can generate a feature by running the following command.

```bash
php artisan better:feature StoreBlog Blog
```

::: info
Generated feature will be at `app/Modules/BlogModule/Features/StoreBlogFeature.php`
:::

### Arguments

- `feature` — name of the generated feature file (`Feature` is appended when missing)
- `module` — name of the module where the feature will be generated (`Module` is appended when missing)

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [FeatureMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/FeatureMakeCommand.php)

### Running jobs

:::warning
Feature must extend `Laranex\BetterLaravel\Cores\Feature` to use the `run` or `runInQueue` methods.
:::

| Method | Accepts | Returns |
|---|---|---|
| `run(Job\|Operation $unit)` | A `Cores\Job` or `Cores\Operation` instance | Whatever the unit's `handle` method returns |
| `runInQueue(QueueableJob $unit, string $queue = 'default')` | A `Cores\QueueableJob` instance | `Illuminate\Foundation\Bus\PendingDispatch` |

Units are passed as instances; class names are not accepted.

```php
use App\Domains\Blog\Jobs\StoreBlogJob;
use App\Domains\Blog\Requests\StoreBlogRequest;
use App\Models\Blog;
use Laranex\BetterLaravel\Cores\Feature;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        return $this->run(new StoreBlogJob($request->validated()));
    }
}
```

### Running queue jobs

```php
use App\Domains\Blog\Jobs\NotifyViaEmailJob;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        $blog = $this->run(new StoreBlogJob($request->validated()));

        $this->runInQueue(new NotifyViaEmailJob($blog));
        // Or on a named queue
        $this->runInQueue(new NotifyViaEmailJob($blog), 'emails');

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
