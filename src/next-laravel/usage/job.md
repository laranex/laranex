---
title: Job
description: Generate Job classes with Next Laravel's artisan command for handling models and business logic in a clean, testable unit.
---

# Job

You can generate a job by running the following command.

```bash
php artisan next:job StoreBlog Blog
```

::: info
Generated job will be at `app/Modules/BlogModule/Jobs/StoreBlogJob.php`
:::

### Arguments

- `job` — name of the generated job file
- `module` — name of the module where the job will be generated

### Options

- `--queue` — generates the job as a queueable job
- `--force` — overwrites an existing file at the same path. See more at:
  - [JobMakeCommand.php](https://github.com/laranex/next-laravel/blob/master/src/Commands/JobMakeCommand.php)

### Job

```php
use Laranex\NextLaravel\Cores\Job;

class StoreBlogJob extends Job
{
    public function __construct(private array $payload) {}

    public function handle(): void
    {
        // handle your business logic here
    }
}
```

### Queue Job

Turn any Job into a queueable job, dispatched with Laravel Queues instead of running synchronously, by extending `Laranex\NextLaravel\Cores\QueueableJob`.

```php
use Laranex\NextLaravel\Cores\QueueableJob;

class NotifyViaEmailJob extends QueueableJob
{
    public function __construct(private array $payload) {}

    public function handle(): void
    {
        // dispatched via Laravel Queues
    }
}
```
