---
title: Installation
description: Install Laravel Schema Viewer, open the viewer and choose who may see it.
---

# Installation

```bash
composer require laranex/laravel-schema-viewer --dev
```

The service provider registers itself. Open `/schema-viewer` in your local environment; the page loads the built viewer from the package, so there is no `npm install` and nothing to publish.

Install it as a dev dependency unless your team wants the viewer on a server; see [Access](#access).

## Access

The viewer is on in the `local` environment and off everywhere else. To open it on a staging or production server, turn it on and say who may see it with the `viewSchema` gate, for example in `AppServiceProvider::boot()`:

```php
use Illuminate\Support\Facades\Gate;

Gate::define('viewSchema', fn ($user) => $user->isAdmin());
```

```ini
SCHEMA_VIEWER_ENABLED=true
```

Without the gate, the viewer answers 403 outside `local`. Schema details help an attacker, so keep the gate strict.

::: warning Local means anyone who can reach the app
In `local` the viewer skips the gate. If the app is reachable from outside, through Herd Share, Expose, ngrok, `artisan serve --host=0.0.0.0` or a server misconfigured as `local`, anyone with the link sees the full schema. Set `SCHEMA_VIEWER_ENABLED=false` while sharing the app.
:::

Every setting has a default; see [Configuration](./configuration) to change one.
