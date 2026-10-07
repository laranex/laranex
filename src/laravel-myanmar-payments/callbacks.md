---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback(), read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback()` verifies the gateway's signature and returns a `PaymentCallback`. Pass it the Laravel request as is: signatures are checked against the exact body the gateway sent.

```php
use Illuminate\Http\Request;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;

Route::post('/payments/kbz/callback', function (Request $request) {
    $callback = MyanmarPayments::kbzPay()->handleCallback($request);

    $order = Order::where('reference', $callback->orderId)->firstOrFail();

    if ($callback->isSuccessful() && ! $order->isPaid() && (int) $callback->amount === $order->amount) {
        $order->markAsPaid($callback->gatewayReference);
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.kbz.callback');
```

Gateways post from their own servers, so exclude callback routes from CSRF verification.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationException`. Never act on its payload; it carries the unverified data in `$e->raw` for logging only.
- **Check the amount.** Compare `$callback->amount` (as the gateway sent it, a string) with your order before fulfilling.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `MyanmarPayments::acknowledge($callback)` returns the response the gateway expects, e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## PaymentStatus

Every gateway's own status values are mapped onto one enum. The original value stays in `$callback->gatewayStatus`.

| Case | Meaning |
|---|---|
| `PaymentStatus::Successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus::Pending` | Still in progress or waiting on the customer. |
| `PaymentStatus::Failed` | Attempted and failed or rejected. |
| `PaymentStatus::Cancelled` | Cancelled or closed before completing. |
| `PaymentStatus::Expired` | The payment window ran out. |
| `PaymentStatus::Unknown` | A status this package does not recognise yet. Inspect `gatewayStatus`. |

`$status->isFinal()` is `false` for `Pending` and `Unknown`. Unknown statuses never throw.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late or missing, ask the gateway directly. Status checks return a `PaymentStatusResult` with the same `status`, `gatewayStatus`, `gatewayReference` and `amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `MyanmarPayments::kbzPay()->status($orderId)` |
| AYA Payment Gateway | `MyanmarPayments::ayaPay()->status($orderId)` |
| Yoma MMQR | `MyanmarPayments::yomaMmqr()->status($payment->reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```php
$result = MyanmarPayments::kbzPay()->status('ORDER_1');

if ($result->isSuccessful()) {
    // ...
}
```

See [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for every property.
