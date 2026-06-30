---
title: Operation
description: Generate Operations with Better Laravel's artisan command. Operations group reusable sets of Jobs that can be called from multiple Features.
---

# Operation

You can generate an operation by running the following command.

```bash
php artisan better:operation NotifySubscribersOperation Blog
```

::: info
Generated operation will be at `app/Modules/BlogModule/Operations/NotifySubscribersOperation.php`
:::

### Arguments

- `operation` — name of the generated operation file
- `module` — name of the module where the operation will be generated

### Options

- `--force` — overwrites an existing file at the same path. See more at:
  - [OperationMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/OperationMakeCommand.php)

### Calling Jobs from an Operation

:::warning
Operation must extend `Laranex\BetterLaravel\Cores\Operation` to use the `run` or `runInQueue` methods.
:::

```php
use App\Domains\Blog\Jobs\NotifyViaEmailJob;
use App\Domains\Blog\Jobs\NotifyViaPushNotificationJob;
use Laranex\BetterLaravel\Cores\Operation;

class NotifySubscribersOperation extends Operation
{
    public function __construct(private array $payload) {}

    public function handle(): void
    {
        $this->run(new NotifyViaEmailJob($this->payload));
        $this->run(new NotifyViaPushNotificationJob($this->payload));
    }
}
```

### Calling Queue Jobs from an Operation

```php
class NotifySubscribersOperation extends Operation
{
    public function __construct(private array $payload) {}

    public function handle(): void
    {
        $this->runInQueue(new NotifyViaEmailJob($this->payload));
        $this->runInQueue(new NotifyViaPushNotificationJob($this->payload));
    }
}
```
