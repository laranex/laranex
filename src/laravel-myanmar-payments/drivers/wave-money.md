---
title: Wave Money
description: Integrate Wave Money (WavePay) with Laravel Myanmar Payments. Redirect payments with typed line items and verified callbacks.
---

# Wave Money

| Method | Flow | Returns |
|---|---|---|
| `waveMoney()->initiate($data)` | Redirect to Wave's payment page | [`RedirectPayment`](/laravel-myanmar-payments/payment-flows#redirect-payments) |
| `waveMoney()->handleCallback($request)` | Verify the callback | `PaymentCallback` |

Wave has no status API: the callback is the only payment result.


::: warning Sandbox host
Wave's documented test host `testpayments.wavemoney.io` no longer resolves in DNS (checked October 2026). If Wave gives you a different test host, set it as the base URL; otherwise testing happens against production with your merchant credentials.
:::

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyItem;
use Laranex\PhpMyanmarPayments\WaveMoney\WaveMoneyPaymentData;

$data = new WaveMoneyPaymentData(
    orderId: (string) $order->id,
    callbackUrl: route('payments.wave.callback'),
    returnUrl: route('orders.show', $order),
    description: 'Order #'.$order->id,
    items: [
        new WaveMoneyItem('Product A', 3000),
        new WaveMoneyItem('Product B', 2000),
    ],
);

$order->update(['wave_reference' => $data->merchantReferenceId]);

$payment = MyanmarPayments::waveMoney()->initiate($data);

return redirect()->away($payment->url);
```

### WaveMoneyPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Your order id. One order can have several payment attempts |
| `callbackUrl` | `string` | Yes | HTTPS URL on the standard port 443 that Wave posts the result to, with a CA-issued certificate |
| `returnUrl` | `string` | Yes | Valid URL Wave sends the customer back to. Not proof of payment |
| `description` | `string` | Yes | Shown to the customer |
| `items` | `list<WaveMoneyItem>` | Yes | At least one item |
| `amount` | `Amount\|int\|null` | No | Whole kyat (Wave does not accept decimals), greater than 0. Defaults to the sum of the items. Wave only accepts MMK |
| `merchantReferenceId` | `?string` | No | Unique id of this attempt. Defaults to a random id |

`WaveMoneyItem` takes a `name` and an `amount` (`Amount|int`) in whole kyat, greater than 0. The default total is summed with integers, never floats.

### Merchant Reference Id

Wave rejects a reused `merchant_reference_id` (`409 Record already exists`), so every attempt, including a retry of the same order, needs a new one. The default is a fresh random id. **Store it**: read it from `$data->merchantReferenceId`. Wave marks `orderId` as optional in callbacks, while `merchantReferenceId` is always present.

## Handling Callbacks

```php
Route::post('/payments/wave/callback', function (Request $request) {
    $callback = MyanmarPayments::waveMoney()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId, $callback->raw['merchantReferenceId'], $callback->gatewayReference (Wave transactionId)
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.wave.callback');
```

`$callback->orderId` falls back to `merchantReferenceId` when Wave omits `orderId`.

## Statuses

Only `PAYMENT_CONFIRMED` means the customer paid.

| Wave `status` | `PaymentStatus` |
|---|---|
| `PAYMENT_CONFIRMED` | `Successful` |
| `INSUFFICIENT_BALANCE` | `Pending` |
| `ACCOUNT_LOCKED`, `BILL_COLLECTION_FAILED` | `Failed` |
| `PAYMENT_REQUEST_CANCELLED` | `Cancelled` |
| `TRANSACTION_TIMED_OUT`, `SCHEDULER_TRANSACTION_TIMED_OUT` | `Expired` |
| anything else | `Unknown` |

`SCHEDULER_TRANSACTION_TIMED_OUT` arrives up to 15 minutes after the time-to-live ends.

## Errors

A rejected request throws `ApiException`; `httpStatus` tells them apart: `400` invalid hash, `404` unknown merchant, `409` reused reference, `422` validation (`gatewayCode` is `VALIDATION_ERROR`).
