---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback(), read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback()` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/php-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: '$kbzPay->handleCallback()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationException', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by $callback->orderId' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: '$callback->acknowledgement()->send()', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```php
// kbz/callback.php
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $kbzPay->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException $e) {
    error_log($e->getMessage());
    http_response_code(400);
    exit;
}

$order = findOrderByReference($callback->orderId);

if ($callback->isSuccessful() && ! $order->isPaid() && (int) $callback->amount === $order->amount) {
    $order->markAsPaid($callback->gatewayReference);
}

$callback->acknowledgement()->send(); // KBZ Pay: HTTP 200 with plain-text "success"
```

## Building a CallbackRequest

Signatures are checked against the exact bytes the gateway sent, so build the request from the real incoming request.

| Constructor | Use when |
|---|---|
| `CallbackRequest::fromGlobals()` | A plain PHP endpoint: reads `php://input`, the request headers and `$_GET` |
| `CallbackRequest::fromPsr7($serverRequest)` | You have a PSR-7 `ServerRequestInterface` |
| `CallbackRequest::fromArray($payload, $headers)` | Replaying a payload you stored, e.g. from a queue or a failed-callback table |
| `new CallbackRequest($body, $headers, $query)` | Any other framework: pass the raw body, headers and query parameters |

`$request->header($name)` is case-insensitive, `parsedBody()` decodes a JSON or form body, and `input()` merges it over the query string. JSON numbers keep their exact text as strings (`1000.50` stays `"1000.50"`), so signatures are checked against what the gateway sent and `raw` never holds a rounded float.

See [Framework Integration](/php-myanmar-payments/framework-integration) for Symfony and PSR-15 examples.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationException`. Never act on its payload; it carries the unverified data in `$e->raw` for logging only.
- **Check the amount.** Compare `$callback->amount` (as the gateway sent it, a string) with your order before fulfilling.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `$callback->acknowledgement()` holds the response the gateway expects (`status`, `body`, `headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`send()` writes the acknowledgement with PHP's native `http_response_code()`, `header()` and `echo`:

```php
$callback->acknowledgement()->send();
```

With PSR-7, map it onto a response instead:

```php
$ack = $callback->acknowledgement();

$response = $responseFactory->createResponse($ack->status)
    ->withBody($streamFactory->createStream($ack->body));

foreach ($ack->headers as $name => $value) {
    $response = $response->withHeader($name, $value);
}
```

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
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: '$kbzPay->status($orderId)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: '$result->status->isFinal()' },
  ]"
/>

When a callback is late or missing, ask the gateway directly. Status checks return a `PaymentStatusResult` with the same `status`, `gatewayStatus`, `gatewayReference` and `amount` fields.

| Gateway | Call |
|---|---|
| KBZ Pay | `$kbzPay->status($orderId)` |
| AYA Payment Gateway | `$ayaPay->status($orderId)` |
| Yoma MMQR | `$yomaMmqr->status($payment->reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```php
$result = $kbzPay->status('ORDER_1');

if ($result->isSuccessful()) {
    // ...
}
```

See [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for every property.
