---
title: Job
description: Generate Job classes with Better Laravel's artisan command for handling models and business logic in a clean, testable unit.
---

# Job

You can generate a job by running the following command.

```bash
php artisan better:job StoreBlog Blog
```

::: info
Generated job will be at `app/Domains/Blog/Jobs/StoreBlogJob.php`
:::

### Arguments

- `job` — name of the generated job file
- `domain` — name of the domain where the job will be generated

### Options

- `--queue` — generates the job as a queueable job
- `--force` — overwrites an existing file at the same path. See more at:
  - [JobMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/JobMakeCommand.php)

### Job

```php
use Laranex\BetterLaravel\Cores\Job;

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

Turn any Job into a queueable job by extending `Laranex\BetterLaravel\Cores\QueueableJob`.

```php
use Laranex\BetterLaravel\Cores\QueueableJob;

class NotifyViaEmailJob extends QueueableJob
{
    public function __construct(private array $payload) {}

    public function handle(): void
    {
        // dispatched via Laravel Queues
    }
}
```
