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
| Plain PHP | `CallbackRequest::fromGlobals()` reads all three | | |
| PSR-7 | `CallbackRequest::fromPsr7($request)` reads all three | | |
| Symfony | `$request->getContent()` | `$request->headers->all()`, each list joined with `, ` | `$request->query->all()` |

| Member | Description |
|---|---|
| `body` | The raw body, exactly as received |
| `headers()` | Headers as given |
| `query` | Query string parameters |
| `header($name)` | One header, case-insensitively, or `null` |
| `parsedBody()` | The body decoded as JSON (when it is a JSON object) or a urlencoded form (the first value of a repeated key); JSON numbers keep their exact text as strings |
| `input()` | The parsed body merged over the query string |
| `queryInput()` | The query string merged over the parsed body |

## Rules

- **Verify, then trust.** A callback that fails verification throws `SignatureVerificationException`, and so does one whose signed or hashed field holds an object or array instead of a single value, since no gateway signs nested values. Never act on its payload; `raw` carries the unverified data for logging only.
- **Check the amount.** Compare `$callback->amount` (the exact text the gateway sent) with your order before fulfilling, e.g. with `Amount::equals()`.
- **Be idempotent.** Gateways retry and may deliver the same callback more than once.
- **Acknowledge.** `$callback->acknowledgement` holds the response the gateway expects (`status`, `body`, `headers`), e.g. KBZ Pay's plain `success`. Without it, gateways keep retrying.

## Acknowledging

`$callback->acknowledgement` is an `Acknowledgement` with `status`, `body` and `headers`. Write them with your framework's response class:

| Framework | Response |
|---|---|
| Plain PHP | `$ack->send()`: writes them with `http_response_code()`, `header()` and `echo` |
| Symfony | `new Response($ack->body, $ack->status, $ack->headers)` |
| PSR-7 | `$responseFactory->createResponse($ack->status)`, then write `$ack->body` and add each header |

`Acknowledgement::default()` is the empty `200 text/plain` response most gateways expect.

Gateway callbacks are server-to-server posts: exclude these routes from CSRF protection.

## PaymentStatus

Every gateway's own status values are mapped onto one backed enum. The original value stays in `$callback->gatewayStatus`.

| Case | Value | Meaning |
|---|---|---|
| `PaymentStatus::Successful` | `successful` | The customer paid. The only status that means money was collected. |
| `PaymentStatus::Pending` | `pending` | Still in progress or waiting on the customer. |
| `PaymentStatus::Failed` | `failed` | Attempted and failed or rejected. |
| `PaymentStatus::Canceled` | `canceled` | Canceled or closed before completing. |
| `PaymentStatus::Expired` | `expired` | The payment window ran out. |
| `PaymentStatus::Unknown` | `unknown` | A status this package does not recognize yet. Inspect `gatewayStatus`. |

Cases are backed by strings, so `$callback->status->value` is the value and `PaymentStatus::from('successful')` reads it back. `$status->isFinal()` is `false` for `Pending` and `Unknown`. Unknown statuses never throw.

Each gateway page lists its exact mapping.

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
