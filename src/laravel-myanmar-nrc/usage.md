---
title: Usage
description: Validate NRC input with the MyanmarNRC rule and parse it into the readable English or Myanmar format.
---

# Usage

## NRC input format

The package works with ID-based NRCs, as sent from a form or an API client:

```
STATE_ID-TOWNSHIP_ID-TYPE_ID-NUMBER
12-284-1-123456
```

The first three parts are the IDs of the state, township and type (from the database or the JSON file), and the last part is the 6-digit number. The NRC must have exactly four `-` separated parts, and the township must belong to the state.

### Reference IDs

The bundled data uses these type IDs:

| ID | Code | Myanmar |
|---|---|---|
| 1 | `N` | `နိုင်` |
| 2 | `E` | `ဧည့်` |
| 3 | `P` | `ပြု` |
| 4 | `T` | `သာသနာ` |
| 5 | `Y` | `ယာယီ` |
| 6 | `S` | `စ` |

State IDs equal their NRC codes: `1` Kachin, `2` Kayah, `3` Kayin, `4` Chin, `5` Sagaing, `6` Tanintharyi, `7` Bago, `8` Magway, `9` Mandalay, `10` Mon, `11` Rakhine, `12` Yangon, `13` Shan, `14` Ayeyawady and `15` Naypyitaw. Township IDs run from `1` to `471`. Build pick lists from the data rather than hard-coding IDs:

```php
use Laranex\LaravelMyanmarNRC\Models\State;

// Database backend
$states = State::query()->with('townships')->orderBy('code')->get();

// JSON backend
$townships = app(\Laranex\LaravelMyanmarNRC\Repositories\JsonNrcRepository::class)->townships();
```

Each row has `id`, `code`, `code_my`, `name` and `name_my`; townships also have `nrc_state_id`.

## Validation

```php
use Laranex\LaravelMyanmarNRC\Rules\MyanmarNRC;

$request->validate([
    'nrc' => ['required', new MyanmarNRC],
]);
```

Pass `dbDriven` to choose the backend for this rule only:

```php
new MyanmarNRC(dbDriven: false); // validate against the JSON file
```

The error message comes from the package translations (`en` and `my`). Override it with the usual custom messages array, keyed by the rule class:

```php
$request->validate(
    ['nrc' => ['required', new MyanmarNRC]],
    ['nrc.'.MyanmarNRC::class => 'Please enter a valid NRC.'],
);
```

## Parsing

```php
use Laranex\LaravelMyanmarNRC\Facades\MyanmarNrc;

MyanmarNrc::parse('12-284-1-123456');             // "12/DAGAYA(N)123456"
MyanmarNrc::parse('12-284-1-123456', lang: 'my');  // "၁၂/ဒဂရ(နိုင်)၁၂၃၄၅၆"
MyanmarNrc::isValid('12-284-1-123456');           // true
```

`parse(string $nrc, ?bool $dbDriven = null, ?string $lang = null): string`

| Argument | Default | Description |
|---|---|---|
| `$nrc` | | NRC in the ID format above |
| `$dbDriven` | config `db_driven` | Use the database (`true`) or the JSON file (`false`) |
| `$lang` | config `locale` | `en` or `my` |

`parse()` returns `State/Township(Type)Number`. `isValid(string $nrc, ?bool $dbDriven = null): bool` returns a boolean instead.

The facade resolves `Laranex\LaravelMyanmarNRC\MyanmarNrc`, which is bound as a singleton, so you can also inject it.

## Exceptions

| Exception | Thrown when |
|---|---|
| `InvalidNrcException` | The NRC is malformed, an ID doesn't exist, or the township doesn't belong to the state |
| `UnsupportedLocaleException` | `$lang` is not `en` or `my` |
| `InvalidJsonFileException` | The JSON file is missing or doesn't contain `types` and `states` arrays |

All three live in `Laranex\LaravelMyanmarNRC\Exceptions`. `InvalidNrcException` and `UnsupportedLocaleException` extend `InvalidArgumentException`; `InvalidJsonFileException` extends `RuntimeException`.

## Data

### Models

The `Laranex\LaravelMyanmarNRC\Models` namespace has `State` (`nrc_states`), `Township` (`nrc_townships`) and `Type` (`nrc_types`):

```php
use Laranex\LaravelMyanmarNRC\Models\State;

$state = State::query()->where('code', 12)->first();

$state->townships;           // HasMany
$state->townships[0]->state; // BelongsTo
```

### Repositories

Both backends implement `Laranex\LaravelMyanmarNRC\Repositories\NrcRepository`, with `state(int $id)`, `township(int $id)` and `type(int $id)` returning a model or `null`:

```php
MyanmarNrc::repository()->township(284)?->code;      // backend from config
MyanmarNrc::repository(false)->state(12)?->name_my;  // JSON backend
```

| Class | Reads from |
|---|---|
| `DatabaseNrcRepository` | The NRC tables |
| `JsonNrcRepository` | The configured JSON file. Also has `types()`, `states()` and `townships()`, which return every row as an array, and `path()` |
