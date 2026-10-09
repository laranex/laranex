---
title: Principles
description: Next Laravel is built on Routes, Modules, Controllers, Features, Requests, Operations, and Jobs — each with a single clear responsibility.
---

# Principles

> Next Laravel is not a new framework — it is a set of principles you can follow to build a better Laravel application. Just follow them and your application will turn into cleaner, more human-readable code.

## Request lifecycle

<SequenceDiagram
  title="Serving a request"
  :participants="['Route', 'Controller', 'Feature', 'Operation', 'Job']"
  :steps="[
    { from: 'Route', to: 'Controller', label: 'POST /api/v1/blogs', detail: 'routes/api/v1/blogs.php' },
    { from: 'Controller', to: 'Feature', label: 'serve(new StoreBlogFeature)' },
    { from: 'Feature', to: 'Feature', label: 'Validate the Request', detail: 'StoreBlogRequest type-hinted on handle()' },
    { from: 'Feature', to: 'Job', label: 'run(new StoreBlogJob($data))' },
    { from: 'Job', to: 'Feature', label: 'Blog', response: true },
    { from: 'Feature', to: 'Operation', label: 'run(new NotifySubscribersOperation($blog))' },
    { from: 'Operation', to: 'Job', label: 'runInQueue(new NotifyViaEmailJob($blog))', detail: 'pushed onto the queue' },
    { from: 'Feature', to: 'Controller', label: 'Blog', response: true },
    { from: 'Controller', to: 'Route', label: 'HTTP response', response: true },
  ]"
/>

## Units

### Routes

Routes are the same as Laravel's default routes. The only difference is that Next Laravel loads routes from the `NextLaravelServiceProvider`. You have 100% control over them. See more at:
- [Configuration](/next-laravel/configuration#config)
- [NextLaravelServiceProvider.php](https://github.com/laranex/next-laravel/blob/master/src/NextLaravelServiceProvider.php)

### Module

Modules are where you wrap your business layers into separate units. A module can have:
- HTTP
  - Controllers
  - Requests
- Features
- Operations
- Jobs

:::warning
Resources under modules are **not sharable** across the application and are intended for a single purpose. You can only consume these resources from within the same module.
:::

### Controller

Controller is responsible for:
- Serving the Feature
- Returning everything the Feature returns to the request

### Feature

Feature is responsible for:
- Validating the Request
- Running Job(s) / Operation(s)
- Mapping data from Job(s) to a response
- Returning the HTTP Response to the Controller

### Request

Request is responsible for:
- Validating the incoming HTTP Request
- Authorization of the Request

### Operation

Operation is responsible for:
- Running the Job(s)

### Job

Job is responsible for:
- Handling Laravel Models
- Providing data to the Feature

### Operation vs Feature

Even though both Operation and Feature run Job(s), there is a key difference:
- Feature can be served from the Controller; Operation cannot.
- Operation can only be run from a Feature — it cannot work independently.
- Operation is optional in an application; Feature is not.

:::tip
Operation is useful when the same set of Jobs needs to run from multiple Features. Instead of duplicating Job calls across Features, collect those Jobs into a single Operation and run it from each Feature.
:::

:::info Next Laravel and Better Laravel
[Better Laravel](/better-laravel/introduction) uses the same units, but generates Jobs and Requests into shared Domains (`app/Domains`). Next Laravel generates every unit inside a module.
:::
