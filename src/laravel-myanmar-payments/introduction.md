---
title: Introduction
---

<PackageIntroduction />

## Payment Flows

Every driver follows the same three-step lifecycle — `initiate → redirect/form → callback` — but how the customer reaches the gateway differs between two flow types.

### Redirect-based

The driver returns a URL and you redirect the customer there directly.

**Drivers:** KBZ Pay (PWA), Wave Money

```php
$result = MyanmarPayments::driver('kbzpay.pwa')->initiate($data);

return redirect($result->redirectUrl);
```

### Form-based

Some gateways require a signed POST form submission rather than a plain redirect. The driver signs the request fields, encrypts them, and returns a `redirectUrl` pointing to the package's built-in form page — a Blade view that renders a hidden form and auto-submits it. The customer is forwarded transparently; from your controller the pattern looks identical to a redirect flow.

**Drivers:** AYA PGW, CyberSource

```php
$result = MyanmarPayments::driver('aya_pgw')->initiate($data);

return redirect($result->redirectUrl); // package handles the form internally
```

#### Rendering the form yourself

If you want full control over the form page — custom styling, loading state, analytics — skip `redirectUrl` and use `$result->formUrl` and `$result->formData` directly:

```php
$result = MyanmarPayments::driver('aya_pgw')->initiate($data);

return view('payment.form', ['result' => $result]);
```

In your Blade view:

```html
<form id="payment-form" method="POST" action="{{ $result->formUrl }}">
    @foreach ($result->formData as $key => $value)
        <input type="hidden" name="{{ $key }}" value="{{ $value }}">
    @endforeach
</form>
<script>document.getElementById('payment-form').submit();</script>
```

## RequestPaymentResult

Every driver method returns a `RequestPaymentResult` instance:

| Property | Type | Description |
|---|---|---|
| `status` | `PaymentStatus` | `Initiated`, `Successful`, `Failed`, `Pending`, `Cancelled` |
| `redirectUrl` | `?string` | Redirect the customer here — set on `initiate()` for all drivers |
| `formUrl` | `?string` | Raw POST target (form-based drivers only) |
| `formData` | `?array` | Hidden field key/value pairs (form-based drivers only) |
| `qrCode` | `?string` | QR string (`kbzpay.qr` only) |
| `appData` | `?array` | Signed mobile SDK payload (`kbzpay.app` only) |
| `orderId` | `?string` | Echoed back on `verify()` and `handleCallback()` |
| `raw` | `array` | Raw gateway response for all methods |

Helper methods: `isSuccessful()`, `isPending()`, `isInitiated()`, `isFailed()`, `isCancelled()`, `requiresRedirect()`.

## Error Handling

HTTP-level errors (4xx/5xx responses) throw `Illuminate\Http\Client\RequestException`. Business logic failures — where the gateway accepts the request but returns a non-success code — return a `RequestPaymentResult` with `status = PaymentStatus::Failed` and the raw response in `$result->raw`.

```php
use Illuminate\Http\Client\RequestException;

try {
    $result = MyanmarPayments::driver('kbzpay.pwa')->initiate($data);

    if ($result->isFailed()) {
        logger()->warning('Payment initiation failed', $result->raw);
        return back()->withErrors('Payment could not be initiated.');
    }

    return redirect($result->redirectUrl);
} catch (RequestException $e) {
    report($e);
    return back()->withErrors('Payment gateway is unavailable.');
}
```
