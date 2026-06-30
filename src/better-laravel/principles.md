---
title: Principles
description: Better Laravel is built on Routes, Domains, Modules, Controllers, Features, Requests, Operations, and Jobs — each with a single clear responsibility.
---

# Principles

> Better Laravel is not a new framework — it is a set of principles you can follow to build a better Laravel application. Just follow them and your application will turn into cleaner, more human-readable code.

### Routes

Routes are the same as Laravel's default routes. The only difference is that Better Laravel loads routes from the `BetterLaravelServiceProvider`. You have 100% control over them. See more at:
- [Configuration](/better-laravel/configuration.html#config)
- [BetterLaravelServiceProvider.php](https://github.com/laranex/better-laravel/blob/master/src/BetterLaravelServiceProvider.php#L46)

### Domain

Domain is where your business logic lives. A domain can have:
- Jobs
- Requests

:::warning
Resources under domains are **sharable** across the application and consumed by Features. Since these are served globally, you can consume any of them from any module — no limitation at all.
:::

### Module

Modules are where you wrap your business layers into separate units. A module can have:
- HTTP
  - Controllers
- Features

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
