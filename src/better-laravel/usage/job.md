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

- `job` — name of the generated job file (`Job` is appended when missing)
- `domain` — name of the domain where the job will be generated

### Options

- `--queue` — generates the job as a queueable job (extends `QueueableJob`)
- `--force` — overwrites an existing file at the same path. See more at:
  - [JobMakeCommand.php](https://github.com/laranex/better-laravel/blob/master/src/Commands/JobMakeCommand.php)

### Job

A job extends `Laranex\BetterLaravel\Cores\Job` and runs synchronously through `run()`. Whatever `handle` returns is returned to the caller.

```php
use App\Models\Blog;
use Laranex\BetterLaravel\Cores\Job;

class StoreBlogJob extends Job
{
    public function __construct(private array $payload) {}

    public function handle(): Blog
    {
        return Blog::create($this->payload);
    }
}
```

### Queue job

Turn any job into a queueable job by extending `Laranex\BetterLaravel\Cores\QueueableJob`. It implements `ShouldQueue` and uses Laravel's `InteractsWithQueue`, `Queueable` and `SerializesModels` traits; dispatch it with `runInQueue()`.

```php
use App\Models\Blog;
use Laranex\BetterLaravel\Cores\QueueableJob;

class NotifyViaEmailJob extends QueueableJob
{
    public function __construct(private Blog $blog) {}

    public function handle(): void
    {
        // dispatched via Laravel Queues
    }
}
```
