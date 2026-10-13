---
title: Introduction
---

<PackageIntroduction />

## Why Laravel New Relic

New Relic's Monolog enricher does not support Monolog 3, which current Laravel versions use, and the New Relic PHP agent records a whole Octane worker as one endless transaction. Laravel New Relic fixes both with one log channel and a few event listeners:

- **Logs straight to New Relic Logs.** The `newrelic` log channel posts your records to the Logs API with your license key, no log forwarder or agent needed. The region's host is picked from the key.
- **Batched and safe.** Records are buffered and sent as one batch after each Octane request or queue job, with short timeouts and batches split under the 1 MB payload limit. A failed delivery goes to PHP's error log and never breaks your app.
- **Logs in context.** With the New Relic PHP agent loaded, each record carries the agent's linking metadata (`entity.guid`, `trace.id`, `span.id`), so logs show up next to their APM transaction.
- **Useful attributes.** Every record has your app name as `service`, the hostname and the authenticated user's id. The client IP and the user's email are personal data, so they are opt-in.
- **One transaction per Octane request.** Each Octane request becomes its own web transaction, named after its route name, controller action or route pattern, never the raw URL. See [Transactions](./usage#transactions).
- **Works without the agent.** Every agent call does nothing when the `newrelic` extension is not loaded, and the agent and the log transport are contracts you can fake in tests.
