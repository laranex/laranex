---
title: What Runs on Build
description: The model code schema-viewer:build runs, what Laravel Schema Viewer fakes while it runs, what still reaches the outside world, and how to skip it with SchemaViewer::building().
---

# What Runs on Build

To draw a relation, the viewer needs the object the relation method returns, so `php artisan schema-viewer:build` runs your models' code:

- Every model in the scanned folders is constructed, so its constructor, `boot()`, `booted()` and trait initializers run.
- Every candidate method is called on that blank model, with no row loaded, and so is every relation registered with `Model::resolveRelationUsing()`.

This happens in the build process only. The viewer's page carries the snapshot and never runs model code in a web request, in any environment.

## What is faked

While that code runs:

| Kept from the outside world | How |
|---|---|
| Database writes and reads | Every configured connection pretends: queries are logged, never sent. Connections opened only for the build are closed again. |
| Model events and observers | Off while relation methods run. |
| Jobs, queued jobs, mail, notifications | Faked. |
| HTTP calls through Laravel's `Http` client | Answered by a fake; nothing is sent. |
| Events dispatched by a relation method | Faked. |
| Cache writes | Kept in a store of their own, in memory. |

Everything is put back when the build ends. `schema-viewer:export` and `schema-viewer:check` read the models the same way, with connections pretending and model events off, but without the fakes.

A model that cannot be constructed, or a method that throws, is reported as an [`unresolved_relation` hint](./hints) instead of breaking the build.

## What still runs for real

Only Laravel's own facades and clients can be faked. Code that goes around them runs as usual, every time the build runs, deploy scripts included:

```php
protected static function booted(): void
{
    (new \GuzzleHttp\Client)->post('https://hooks.slack.com/...'); // a real request
    \Stripe\Customer::create([...]);                               // a real API call
    Redis::connection()->incr('models_booted');                    // a real Redis write
    file_put_contents(storage_path('boot.log'), 'booted');         // a real file
    Log::info('Order booted');                                     // a real log line
}
```

The same goes for a relation method that calls a service to decide what to return, and for static state a constructor sets. Most models never do this: a relation method that only returns `$this->belongsTo(...)` has nothing to run. Check models with a custom constructor, heavy `boot()` or `booted()` logic, or relations that do more than build the relation.

## Skipping your own side effects

`SchemaViewer::building()` is `true` while the package reads your models (in `schema-viewer:build`, `schema-viewer:export` and `schema-viewer:check`) and `false` everywhere else. Return early from code that should not run during a build:

```php
use Laranex\LaravelSchemaViewer\SchemaViewer;

protected static function booted(): void
{
    if (class_exists(SchemaViewer::class) && SchemaViewer::building()) {
        return;
    }

    (new \GuzzleHttp\Client)->post('https://hooks.slack.com/...');
}
```

Keep the `class_exists()` check when the package is a dev dependency. A server installed with `composer install --no-dev` has no `SchemaViewer` class, and calling `SchemaViewer::building()` there throws an error. `SchemaViewer::class` and the `use` line never load the class, so the check is safe, and on that server it is simply `false`. When the package is a regular dependency, `SchemaViewer::building()` alone is enough.

Only skip work that reaches the outside world. A relation method must still return its relation during the build, or the viewer cannot draw it:

```php
public function plan(): BelongsTo
{
    if (! (class_exists(SchemaViewer::class) && SchemaViewer::building())) {
        Billing::syncPlans(); // skipped during the build
    }

    return $this->belongsTo(Plan::class);
}
```

`boot()` and `booted()` run once per model class in a process. In the build's own process that first run is during the build, so the check sees `true`.
