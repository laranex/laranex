---
title: Usage
description: Validate NRC input with the MyanmarNRC rule and parse it into the readable English or Myanmar format.
---

# Usage

## NRC Input Format

The package works with ID-based NRCs, as sent from a form or an API client:

```
STATE_ID-TOWNSHIP_ID-TYPE_ID-NUMBER
1-1-1-123456
```

The first three parts are the IDs of the state, township and type (from the database or the JSON file), and the last part is the 6-digit number.

## Validation

```php
use Laranex\LaravelMyanmarNRC\Rules\MyanmarNRC;

$request->validate([
    'nrc' => ['required', new MyanmarNRC],
]);
```

The error message comes from the package translations (`en` and `mm`).

## Parsing

```php
use Laranex\LaravelMyanmarNRC\LaravelMyanmarNrcFacade as LaravelMyanmarNrc;

LaravelMyanmarNrc::parseNRC('1-1-1-123456');             // "1/HAPANA(N)123456"
LaravelMyanmarNrc::parseNRC('1-1-1-123456', lang: 'mm');  // "၁/ဟပန(နိုင်)၁၂၃၄၅၆"
```

| Argument | Default | Description |
|---|---|---|
| `$nrc` | | NRC in the ID format above |
| `$dbDriven` | `false` | Use the database. The `db_driven` config value also enables it |
| `$lang` | config `locale` | `en` or `mm` |

`parseNRC()` returns `State/Township(Type)Number` and throws an `Exception` (`Invalid NRC`) when the NRC is malformed, the township doesn't belong to the state, or an ID doesn't exist. `isValidMyanmarNRC($nrc)` returns a boolean instead.
