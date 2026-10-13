---
title: Introduction
---

<PackageIntroduction />

## Why Next Laravel

As a Laravel app grows, controllers tend to collect validation, queries, mail and queue calls in one place. Next Laravel splits every request into small units with one responsibility each: a controller serves a feature, the feature runs jobs and operations, and jobs do the work. Every unit lives inside its module, so one folder holds everything a part of your app needs.

- **One class, one responsibility.** Controllers, features, operations, requests and jobs each do one thing, so code is easy to find, read and test.
- **Self-contained modules.** Apart from route files, every unit lives in its module under `app/Modules/{Name}Module`: controllers, requests, features, operations and jobs.
- **A generator for every unit.** `next:route`, `next:controller`, `next:request`, `next:feature`, `next:operation` and `next:job`, with stubs you can publish and change.
- **Run units by instance or by class name.** `run(StoreBlogJob::class, ['payload' => $data])` builds the unit with positional or named arguments, and only features, operations and jobs are accepted.
- **Safe generators.** Every name is checked before a file is written, so a name can never inject code or write outside its directory.
- **Route files that load themselves.** Every file under `routes/web` and `routes/api` is loaded with its middleware group and prefix, and nothing is scanned once routes are cached.
- **Queues built in.** Extend `QueueableJob` and call `runInQueue()`, on the default queue or a named one.
- **Plain Laravel underneath.** Units are dispatched through Laravel's bus and requests are form requests, so there is nothing new to learn.

```php
use Laranex\NextLaravel\Cores\Feature;

class StoreBlogFeature extends Feature
{
    public function handle(StoreBlogRequest $request): Blog
    {
        $blog = $this->run(StoreBlogJob::class, ['payload' => $request->validated()]);

        $this->runInQueue(NotifyViaEmailJob::class, [$blog], 'emails');

        return $blog;
    }
}
```

Prefer jobs and requests in domains that every module shares? See [Better Laravel](/better-laravel/introduction).
