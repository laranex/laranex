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

- `feature` — name of the generated feature file
- `module` — name of the module where the feature will be generated

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [FeatureMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/FeatureMakeCommand.php)

### Running Jobs

:::warning
Feature must extend `Laranex\NextLaravel\Cores\Feature` to use the `run` or `runInQueue` methods.
:::

```php
use App\Modules\BlogModule\Jobs\StoreBlogJob;
use App\Modules\BlogModule\Http\Requests\StoreBlogRequest;
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

### Running Queue Jobs

```php
class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        $blog = $this->run(new StoreBlogJob($request->validated()));

        $this->runInQueue(new NotifyViaEmailJob($blog));

        return $blog;
    }
}
```

### Running Operations

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
