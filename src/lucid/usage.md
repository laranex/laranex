---
title: Usage
description: Generate Lucid units with the lucid CLI and serve, run and queue them.
---

# Usage

Lucid is an unofficial, maintained version of [Lucid Architecture](https://lucidarch.dev). It exists because Laravel 10 changed job dispatching, which broke the original package. For the concepts, see the [official Lucid documentation](https://docs.lucidarch.dev).

## Commands

All commands run through `vendor/bin/lucid`:

| Command | Description |
|---|---|
| `init:monolith` / `init:micro` | Initialise Lucid Monolith or Micro in the project |
| `make:service` / `delete:service` | Create or delete a Service |
| `list:services` | List the services |
| `make:feature` / `delete:feature` | Create or delete a Feature in a service |
| `list:features` | List the features |
| `describe:feature` | List a feature's jobs in order |
| `make:operation` / `delete:operation` | Create or delete an Operation (`--queue` for a queueable one) |
| `make:job` / `delete:job` | Create or delete a Job in a domain (`--queue` for a queueable one) |
| `make:controller` | Create a controller in a service (`--resource` for a resource controller) |
| `make:request` / `delete:request` | Create or delete a Request in a domain |
| `make:model` / `delete:model` | Create or delete an Eloquent model |
| `make:policy` / `delete:policy` | Create or delete a Policy |
| `make:migration` | Create a migration in a service |
| `src:name` | Set the source directory namespace |

```bash
vendor/bin/lucid make:service Forum
vendor/bin/lucid make:feature AddRecipe Kitchen
vendor/bin/lucid make:job SaveRecipe Recipe --queue
```

## Units

Generated classes extend the units in `Lucid\Units`: `Controller`, `Feature`, `Operation`, `QueueableOperation`, `Job`, `QueueableJob` and `Model`.

```php
use Lucid\Units\Controller;

class RecipeController extends Controller
{
    public function store()
    {
        return $this->serve(AddRecipeFeature::class);
    }
}
```

```php
use Lucid\Units\Feature;

class AddRecipeFeature extends Feature
{
    public function handle(AddRecipe $request)
    {
        $price = $this->run(CalculateRecipePriceOperation::class, [
            'ingredients' => $request->input('ingredients'),
        ]);

        $this->run(SaveRecipeJob::class, ['price' => $price, 'title' => $request->input('title')]);

        return $this->run(RedirectBackJob::class);
    }
}
```

`serve()` serves a Feature from a controller; `run()` runs a Feature, Operation or Job; `runInQueue()` dispatches a unit to a queue.
