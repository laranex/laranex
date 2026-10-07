---
title: Usage
description: Parse amounts into Money objects and cast Eloquent attributes to Money with the HasMoneyFields trait.
---

# Usage

## Parsing Money

`parseMoney()` turns an amount into a `Money\Money` object:

```php
use Laranex\LaravelMoney\Facades\LaravelMoney;

$money = LaravelMoney::parseMoney($amount);

// or without the facade
$money = (new \Laranex\LaravelMoney\LaravelMoney)->parseMoney($amount);
```

:::warning
The currency is fixed to `USD`, and the amount is passed to `Money` as is, so it must be in the currency's smallest unit (cents).
:::

## Money Fields on Models

List the money columns in `$moneyFields` and use the `HasMoneyFields` trait:

```php
use Laranex\LaravelMoney\Traits\HasMoneyFields;

class Wallet extends Model
{
    use HasMoneyFields;

    protected $moneyFields = ['balance'];
}
```

```php
// Storing: the value must be a Money object
$wallet = new Wallet();
$wallet->balance = LaravelMoney::parseMoney($amount);
$wallet->save();

// Retrieving: returns a Money object
$balance = Wallet::find(1)->balance;
```

Assigning anything other than a `Money\Money` object to a money field throws `Laranex\LaravelMoney\Exceptions\InvalidMoneyInstanceException`. The amount is stored as the Money object's amount (smallest unit).
