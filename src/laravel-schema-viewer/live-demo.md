---
title: Live Demo
description: A sample Laravel store with three database connections, opened in Laravel Schema Viewer. Try it in the browser.
aside: false
pageClass: lx-demo-page
---

# Live Demo

A sample Laravel store, opened in the viewer: three database connections, 53 tables, 35 models and 81 relations. Everything works as it does in your app, downloads included.

<div class="lx-demo">
  <iframe src="/laravel-schema-viewer/demo/" title="Laravel Schema Viewer live demo" loading="lazy"></iframe>
</div>

<p class="lx-demo__open"><a href="/laravel-schema-viewer/demo/" target="_blank" rel="noopener">Open the demo full screen →</a></p>

## What is in it

| Connection | Tables |
|---|---|
| `sqlite` (the store) | Users, teams and their members, profiles, a category tree, brands, products and variants, stock per warehouse, orders, order items and shipments, a blog with comments, polymorphic addresses, images and tags, plus Laravel's own tables |
| `billing` | Plans, customers, subscriptions, invoices, invoice lines, payments and credit notes |
| `analytics` | Visitors, page views, events, A/B experiments with their variants and assignments, and funnels |

## Things to try

- Click `products`: its variants, reviews, tags, images and comments, the `topReview()` that picks the highest rating, the `published` scope and soft deletes.
- Open the Hints tab: `products.brand_id` has no foreign key, and `shipments.warehouse_id` has a foreign key that no model uses.
- Start on **All connections**: the store, billing and analytics side by side, with `Customer::user()` and `Visitor::user()` drawn across to `users`.
- Pick `billing` alone in the connection picker and follow `Customer::user()` to the dashed `users` card, which opens the store connection.
- Press `G` to hide Laravel's framework tables, or `1` to `4` to show only one kind of line.
- Search for `invoice`, `morphTo` or a column such as `user_id`.
- Download the `billing` connection as Mermaid or DBML, or the whole viewer as one HTML file.
