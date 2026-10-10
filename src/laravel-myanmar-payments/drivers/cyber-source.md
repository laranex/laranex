---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments with Laravel Myanmar Payments. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance is a hosted checkout for card payments, in MMK or any other currency.

| Call | What it does | Returns |
|---|---|---|
| `cyberSource()->initiate($data)` | Signed form posted to the hosted checkout | [`FormPayment`](#initiate-response) |
| `cyberSource()->handleCallback($request)` | Verify the result post | [`PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'cyberSource()->initiate($data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cyberSource()->handleCallback($request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cyberSource()->handleCallback($request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourcePaymentData;

$data = new CyberSourcePaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    callbackUrl: route('payments.cybersource.callback'),
    returnUrl: route('payments.cybersource.receipt'),
    cancelUrl: route('checkout'),
);

$payment = MyanmarPayments::cyberSource()->initiate($data);

return redirect($payment->autoSubmitUrl);
```

### CyberSourcePaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `Amount\|int` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `10000` or `Amount::parse('10.50')` |
| `callbackUrl` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `returnUrl` | `?string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `cancelUrl` | `?string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `currency` | `string` | No | Any three-letter uppercase ISO 4217 code, default `MMK` |
| `transactionType` | `CyberSourceTransactionType` | No | `Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`, default `en-us` |

### Amounts and Currencies

CyberSource is multi-currency and accepts decimals. For another currency, pass an [`Amount`](/laravel-myanmar-payments/amounts) with the currency: `amount: Amount::parse('10.50'), currency: 'USD'`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. `$payment->enctype` carries it; use it if you [render the form yourself](/laravel-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

Route::post('/payments/cybersource/callback', function (Request $request) {
    try {
        $callback = MyanmarPayments::cyberSource()->handleCallback($request);
    } catch (SignatureVerificationException) {
        abort(400);
    }

    if ($callback->isSuccessful()) {
        // $callback->orderId is your req_reference_number
        // $callback->gatewayReference is CyberSource's transaction_id
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.cybersource.callback');
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes. CyberSource posts form fields, so every `raw` value is a `string`, exactly as sent.

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | CyberSource value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{base_url}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below. Post them unchanged |
| `enctype` | `application/x-www-form-urlencoded` |
| `autoSubmitUrl` | Encrypted link to the `myanmar-payments.form` route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. Expires after `form_route.ttl_minutes` (30). `null` when `form_route.enabled` is `false` |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

`fields`, all signed, in this order:

| Form field | Value |
|---|---|
| `access_key` | Your configured access key |
| `profile_id` | Your configured profile ID |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The field names in this table except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | Your `locale`, e.g. `en-us` |
| `transaction_type` | Your `transactionType`, e.g. `sale` |
| `reference_number` | Your `orderId` |
| `amount` | Your `amount`, e.g. `10000` |
| `currency` | Your `currency`, e.g. `MMK` |
| `override_custom_receipt_page` | Your `returnUrl`, `""` when unset |
| `override_backoffice_post_url` | Your `callbackUrl` |
| `override_custom_cancel_page` | Your `cancelUrl`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`initiate()` makes no HTTP call. `FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | CyberSource value |
|---|---|
| `orderId` | CyberSource `req_reference_number` (your `orderId`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gatewayReference` | CyberSource `transaction_id`. `null` when it is not signed |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement` into a `CallbackResponse` (`Responsable`). `handleCallback()` accepts an `Illuminate\Http\Request` or a `CallbackRequest`.

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `Successful` |
| `REVIEW` | `Pending` |
| `DECLINE`, `ERROR` | `Failed` |
| `CANCEL` | `Canceled` |
| anything else | `Unknown` |

## Errors

| Call | Throws | When |
|---|---|---|
| `new CyberSourcePaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is signed |
| `handleCallback()` | `SignatureVerificationException` | `signature` doesn't match, a field listed in `signed_field_names` is missing, or `decision` or `req_reference_number` isn't signed |

CyberSource makes no HTTP calls, so nothing throws `ApiException`.
