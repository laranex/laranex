---
title: Operation
description: Generate Operations with Better Laravel's artisan command. Operations group reusable sets of Jobs that can be called from multiple Features.
---

# Operation

You can generate an operation by running the following command.

```bash
php artisan better:operation NotifySubscribers Blog
```

::: info
Generated operation will be at `app/Modules/BlogModule/Operations/NotifySubscribersOperation.php`
:::

### Arguments

- `operation` — name of the generated operation file (`Operation` is appended when missing)
- `module` — name of the module where the operation will be generated (`Module` is appended when missing)

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [OperationMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/OperationMakeCommand.php)

### Calling jobs from an operation

:::warning
Operation must extend `Laranex\BetterLaravel\Cores\Operation` to use the `run` or `runInQueue` methods. They work exactly like the [Feature methods](/better-laravel/usage/feature#running-jobs). Operations themselves cannot be queued.
:::

```php
use App\Domains\Blog\Jobs\NotifyViaEmailJob;
use App\Domains\Blog\Jobs\NotifyViaPushNotificationJob;
use App\Models\Blog;
use Laranex\BetterLaravel\Cores\Operation;

class NotifySubscribersOperation extends Operation
{
    public function __construct(private Blog $blog) {}

    public function handle(): void
    {
        $this->run(new NotifyViaEmailJob($this->blog));
        $this->run(new NotifyViaPushNotificationJob($this->blog));
    }
}
```

### Calling queue jobs from an operation

`runInQueue` only accepts jobs that extend `Laranex\BetterLaravel\Cores\QueueableJob`.

```php
class NotifySubscribersOperation extends Operation
{
    public function __construct(private Blog $blog) {}

    public function handle(): void
    {
        $this->runInQueue(new NotifyViaEmailJob($this->blog));
        $this->runInQueue(new NotifyViaPushNotificationJob($this->blog));
    }
}
```
