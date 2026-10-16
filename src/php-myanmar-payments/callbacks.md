---
title: Callbacks & Status
description: Verify gateway callbacks with handleCallback(), read a gateway-independent PaymentStatus, acknowledge the callback, and check payment status when a callback is late.
---

# Callbacks & Status

Every gateway notifies your server of the payment result. `handleCallback()` takes a `CallbackRequest`, verifies the gateway's signature and returns a `PaymentCallback`. Verifying needs no network call.

::: tip Production setup
For production, follow [Handling Webhooks (recommended)](/php-myanmar-payments/webhooks): verify, store the call, acknowledge immediately, then process it once in the background with retries. The example below handles everything inline to show the API.
:::

Every callback goes through the same steps; KBZ Pay is shown here.

<SequenceDiagram
  title="Handling a KBZ Pay callback"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: '$kbz->handleCallback($request)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Invalid: 400, never fulfill', detail: 'SignatureVerificationException', response: true },
    { from: 'Your app', to: 'Your app', label: 'Find the order', detail: 'by $callback->orderId' },
    { from: 'Your app', to: 'Your app', label: 'Fulfill once', detail: 'skip if paid, match the amount' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Acknowledge: plain success', detail: '$callback->acknowledgement->send()', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'No acknowledgement? Retry', detail: 'after 60 s, then 600 s' },
  ]"
/>

```php
// POST /payments/kbz/callback
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $kbz->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException $e) {
    error_log('rejected KBZ callback: '.$e->getMessage());
    http_response_code(400);
    echo 'invalid callback';
    exit;
}

$order = $orders->find($callback->orderId);
$paid = Amount::parse($order->amount)->equals($callback->amount);
if ($callback->isSuccessful() && $order->paidAt === null && $paid) {
    $orders->markPaid($order, $callback->gatewayReference);
}

// KBZ Pay: HTTP 200 with plain-text "success"
$callback->acknowledgement->send();
```

## Building a CallbackRequest

Signatures are checked against what the gateway actually sent, so build the request from the real incoming request: the raw body, the headers and the query string. Never rebuild it from parsed input such as `$_POST`, a decoded JSON array or a framework's request DTO: a JSON number such as `1000.50` would come back as `1000.5` and break a signature over the exact text.

| Constructor | Use when |
|---|---|
| `CallbackRequest::fromGlobals()` | A plain PHP endpoint: reads `php://input`, the request headers and `$_GET` |
| `CallbackRequest::fromPsr7($serverRequest)` | You have a PSR-7 `ServerRequestInterface` (Slim, Mezzio, any PSR-15 framework) |
| `new CallbackRequest(body: ..., headers: ..., query: ...)` | Any other framework: pass the raw body, the headers as name => value and the query parameters. All three are optional |
| `CallbackRequest::fromArray($payload, $headers = [])` | Replaying a payload you stored as decoded JSON, e.g. from a queue or a failed-callback table |

| Framework | `body` | `headers` | `query` |
|---|---|---|---|
| Symfony | `$request->getContent()` | `$request->headers->all()`, each list joined with `, ` | `$request->query->all()` |

See [CallbackRequest](/php-myanmar-payments/references/payment-callback#callbackrequest) for every member.

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationException`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `$callback->amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount::equals()`. Yoma MMQR callbacks carry no amount: match `orderId` to your stored order and trust its stored amount.
- **Signed is not enough on its own.** Where a gateway joins the signed values with a separator (AYA Pay `:`, CyberSource `,` and `=`) or with none (Wave Money), the package also rejects values that could be re-split into other fields. See each driver's Handling Callbacks section.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.

## Acknowledging

`$callback->acknowledgement` is an `Acknowledgement` with `status`, `body` and `headers`. Write them with your framework's response class:

| Framework | Response |
|---|---|
| Plain PHP | `$ack->send()`: writes them with `http_response_code()`, `header()` and `echo` |
| Symfony | `new Response($ack->body, $ack->status, $ack->headers)` |
| PSR-7 | `$responseFactory->createResponse($ack->status)`, then write `$ack->body` and add each header |

Gateway callbacks are server-to-server posts: exclude these routes from CSRF protection.

## PaymentStatus

Every gateway's own status values are mapped onto one `PaymentStatus` enum; the original value stays in `$callback->gatewayStatus`, and each gateway page lists its exact mapping. Only `Successful` means money was collected; `$status->isFinal()` is `false` for `Pending` and `Unknown`, and unknown statuses never throw. See [PaymentStatus](/php-myanmar-payments/references/payment-callback#paymentstatus) for every case.

## Status Checks

When a callback is late, ask KBZ Pay, AYA or Yoma directly; Wave Money and CyberSource have no status API.

<SequenceDiagram
  title="Checking the status when the callback is late"
  :participants="['Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Your app', to: 'Your app', label: 'Callback late or missing' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Ask for the order status', detail: '$kbz->status($orderId)' },
    { from: 'KBZ Pay', to: 'Your app', label: 'PaymentStatusResult', detail: 'trade_status, e.g. PAY_SUCCESS', response: true },
    { from: 'Your app', to: 'Your app', label: 'Successful? Fulfill once', detail: 'same checks as the callback' },
    { from: 'Your app', to: 'Your app', label: 'Not final? Check again later', detail: '$result->status->isFinal()' },
  ]"
/>

Status checks return a `PaymentStatusResult` with the same `status`, `gatewayStatus`, `gatewayReference` and `amount` properties.

| Gateway | Call |
|---|---|
| KBZ Pay | `$kbz->status($orderId)` |
| AYA Payment Gateway | `$aya->status($orderId)` |
| Yoma MMQR | `$yoma->status($payment->reference)` |
| Wave Money | No status API: rely on the callback |
| CyberSource | No status API: rely on the callback |

```php
use Laranex\PhpMyanmarPayments\Exceptions\ApiException;

try {
    $result = $kbz->status('ORDER_1');
} catch (ApiException $e) {
    error_log("KBZ {$e->gatewayCode}: {$e->gatewayMessage}");
    throw $e;
}

if ($result->isSuccessful()) {
    // ...
}
```

See [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for every property.
