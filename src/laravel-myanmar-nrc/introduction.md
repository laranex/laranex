---
title: Introduction
---

<PackageIntroduction />

## Why Laravel Myanmar NRC

A Myanmar NRC number is more than a pattern: its state, township and type must exist, and the township must belong to the state. Laravel Myanmar NRC checks all of that against the real NRC data and gives the number back in English or Myanmar:

- **The NRC data is included.** All 15 state codes, 471 townships and 6 NRC types, in English and Myanmar, seeded into your database with one command or read straight from the bundled JSON file.
- **One validation rule.** `new MyanmarNRC` rejects malformed numbers, unknown ids and townships from another state, with its error message in English and Myanmar.
- **Readable in both languages.** `parse()` turns `12-284-1-123456` into `12/DAGAYA(N)123456` or `၁၂/ဒဂရ(နိုင်)၁၂၃၄၅၆`, Myanmar digits included.
- **One canonical form to store.** `normalize()` turns `012-0284-01-123456` into `12-284-1-123456`, so equal NRCs are equal strings and unique checks don't miss duplicates.
- **Database or JSON file.** Use the `nrc_states`, `nrc_townships` and `nrc_types` tables with their Eloquent models, or skip the database and read the JSON file, per call if you like. Your own data file works too.
- **Cached lookups.** The database backend reads the tables once and caches them, so other requests and workers skip the queries.

```php
use Laranex\LaravelMyanmarNRC\Facades\MyanmarNrc;
use Laranex\LaravelMyanmarNRC\Rules\MyanmarNRC;

$request->validate(['nrc' => ['required', new MyanmarNRC]]);

MyanmarNrc::parse('12-284-1-123456');             // "12/DAGAYA(N)123456"
MyanmarNrc::parse('12-284-1-123456', lang: 'my');  // "၁၂/ဒဂရ(နိုင်)၁၂၃၄၅၆"
MyanmarNrc::normalize('012-0284-01-123456');      // "12-284-1-123456"
```
