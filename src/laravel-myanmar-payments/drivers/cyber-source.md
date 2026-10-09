---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments with Laravel Myanmar Payments. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `cyberSource()->initiate($data)` | Signed form posted to the hosted checkout | [`FormPayment`](#initiate-response) |
| `cyberSource()->handleCallback($request)` | Verify the result post | [`PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: rely on the callback.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'cyberSource()->initiate()', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cyberSource()->handleCallback()' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cyberSource()->handleCallback()' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourcePaymentData;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourceTransactionType;

$payment = MyanmarPayments::cyberSource()->initiate(new CyberSourcePaymentData(
    orderId: 'ORDER-'.$order->id,
    amount: 20000,
    callbackUrl: route('payments.cybersource.callback'),
    returnUrl: route('payments.cybersource.receipt'),
    cancelUrl: route('checkout'),
));

return redirect($payment->autoSubmitUrl);
```

### CyberSourcePaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `Amount\|int` | Yes | Order total in `currency`, 0 or more, any number of decimals: `20000` or `Amount::parse('10.50')`. At most 15 characters |
| `callbackUrl` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `returnUrl` | `?string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `cancelUrl` | `?string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `currency` | `string` | No | Any three-letter uppercase ISO 4217 code (CyberSource is multi-currency), default `MMK` |
| `transactionType` | `CyberSourceTransactionType` | No | `Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`, default `en-us` |

For decimal amounts or another currency, pass an [`Amount`](/laravel-myanmar-payments/amounts): `amount: Amount::parse('10.50'), currency: 'USD'`.

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page. `decision` and `req_reference_number` must be listed in `signed_field_names`, or the post is rejected with `SignatureVerificationException`; `transaction_id` and the amount are read only when signed. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

```php
Route::post('/payments/cybersource/callback', function (Request $request) {
    $callback = MyanmarPayments::cyberSource()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId (req_reference_number), $callback->gatewayReference (transaction_id)
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.cybersource.callback');
```

## Responses

What CyberSource puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | CyberSource value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{base_url}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `fields` | All signed: `access_key`, `profile_id`, `transaction_uuid` (random), `signed_field_names`, `signed_date_time` (UTC), `locale`, `transaction_type`, `reference_number` (your `orderId`), `amount`, `currency`, `override_custom_receipt_page` (`""` without `returnUrl`), `override_backoffice_post_url` (`callbackUrl`), `override_custom_cancel_page` (`""` without `cancelUrl`), `signature` |
| `enctype` | `application/x-www-form-urlencoded` |
| `autoSubmitUrl` | Encrypted link to the `myanmar-payments.form` route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. Expires after `form_route.ttl_minutes` (30). `null` when `form_route.enabled` is `false` |
| `toHtml()` | A full HTML page that posts the form on load |

`FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | CyberSource value |
|---|---|
| `orderId` | CyberSource `req_reference_number` (your `orderId`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | CyberSource `decision`, uppercased, e.g. `ACCEPT` |
| `gatewayReference` | CyberSource `transaction_id`. `null` when CyberSource sends none |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10.50` |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Fields not listed in `signed_field_names` are dropped |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement()` into a `CallbackResponse` (`Responsable`) that renders an empty `200`. `handleCallback()` accepts an `Illuminate\Http\Request` or a `CallbackRequest`.

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `Successful` |
| `REVIEW` | `Pending` |
| `DECLINE`, `ERROR` | `Failed` |
| `CANCEL` | `Cancelled` |
| anything else | `Unknown` |
