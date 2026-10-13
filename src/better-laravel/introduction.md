---
title: Introduction
---

<PackageIntroduction />

## Why Better Laravel

As a Laravel app grows, controllers tend to collect validation, queries, mail and queue calls in one place. Better Laravel splits every request into small units with one responsibility each: a controller serves a feature, the feature runs jobs and operations, and jobs do the work. Controllers, features and operations live in modules; jobs and requests live in domains that every module shares.

- **One class, one responsibility.** Controllers, features, operations, requests and jobs each do one thing, so code is easy to find, read and test.
- **Reuse without duplication.** Jobs and requests in `app/Domains` can be used from any module, and an operation groups jobs that several features run.
- **A generator for every unit.** `better:route`, `better:controller`, `better:feature`, `better:request`, `better:operation` and `better:job`, with stubs you can publish and change.
- **Safe generators.** Every name is checked before a file is written, so a name can never inject code or write outside its directory.
- **Route files that load themselves.** Every file under `routes/web` and `routes/api` is loaded with its middleware group and prefix, and nothing is scanned once routes are cached.
- **Queues built in.** Extend `QueueableJob` and call `runInQueue()`, on the default queue or a named one.
- **Plain Laravel underneath.** Units are dispatched through Laravel's bus and requests are form requests, so there is nothing new to learn.

```php
use Laranex\BetterLaravel\Cores\Feature;

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

Prefer to keep jobs and requests inside each module? See [Next Laravel](/next-laravel/introduction).
