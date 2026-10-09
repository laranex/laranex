---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback(), read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback()` verifies the gateway's signature and returns a `PaymentCallback`. Pass it the Laravel request as is: signatures are checked against the exact body the gateway sent.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/laravel-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'kbzPay()->handleCallback()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationException', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by $callback->orderId' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: 'acknowledge($callback)', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```php
use Illuminate\Http\Request;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;

Route::post('/payments/kbz/callback', function (Request $request) {
    $callback = MyanmarPayments::kbzPay()->handleCallback($request);

    $order = Order::where('reference', $callback->orderId)->firstOrFail();

    // $order->amount is a string such as "1000"; compare strings, never floats
    if ($callback->isSuccessful() && ! $order->isPaid() && $callback->amount === $order->amount) {
        $order->markAsPaid($callback->gatewayReference);
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.kbz.callback');
```

Gateways post from their own servers, so exclude callback routes from CSRF verification.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationException`. Never act on its payload; it carries the unverified data in `$e->raw` for logging only.
- **Check the amount.** Compare `$callback->amount` (as the gateway sent it, a string) with your order before fulfilling. A gateway may format it differently from your order (`1000` or `1000.00`); the `sameAmount()` helper in [Handling Webhooks](/laravel-myanmar-payments/webhooks#job) compares decimal strings exactly.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `MyanmarPayments::acknowledge($callback)` returns the response the gateway expects, e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## PaymentStatus

Every gateway's own status values are mapped onto one enum. The original value stays in `$callback->gatewayStatus`.

| Case | Meaning |
|---|---|
| `PaymentStatus::Successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus::Pending` | Still in progress or waiting on the customer. |
| `PaymentStatus::Failed` | Attempted and failed or rejected. |
| `PaymentStatus::Cancelled` | Canceled or closed before completing. |
| `PaymentStatus::Expired` | The payment window ran out. |
| `PaymentStatus::Unknown` | A status this package does not recognize yet. Inspect `gatewayStatus`. |

`$status->isFinal()` is `false` for `Pending` and `Unknown`. Unknown statuses never throw.

Each gateway page lists its exact mapping.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: 'kbzPay()->status($orderId)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: '$result->status->isFinal()' },
  ]"
/>

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
