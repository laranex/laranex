---
title: CyberSource
description: Integrate CyberSource Secure Acceptance Hosted Checkout card payments in plain PHP. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance Hosted Checkout is a hosted page for card payments, in the currencies enabled on your Secure Acceptance profile (all are disabled by default; your merchant account provider lists the supported ones). The package follows CyberSource's [Secure Acceptance Hosted Checkout guide](https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance.html).

| Call | What it does | Returns |
|---|---|---|
| `$cyberSource->hostedCheckout($data)` | Signed form posted to the hosted checkout | [`FormPayment`](#hosted-checkout-response) |
| `$cyberSource->handleCallback($request)` | Verify the result post | [`PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

## How it works

CyberSource posts the result to your Merchant POST URL (`callbackUrl`). When a receipt page is set (`returnUrl`, or the custom receipt page on your Secure Acceptance profile), the customer's browser also posts the result there, so you get two posts, both verified the same way. Without a receipt page there is one post, to the Merchant POST URL.

<SequenceDiagram
  title="CyberSource Hosted Checkout: signed form, card page, result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: '$cyberSource->hostedCheckout($data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$cyberSource->handleCallback($request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt, when one is set', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: '$cyberSource->handleCallback($request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Hosted Checkout

```php
use Laranex\PhpMyanmarPayments\CyberSource\CyberSource;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourceConfig;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourcePaymentData;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourceTransactionType;

$cyberSource = new CyberSource(new CyberSourceConfig(
    profileId: '...',
    accessKey: '...',
    secretKey: '...',
    baseUrl: CyberSourceConfig::PRODUCTION_URL,
));

$data = new CyberSourcePaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    callbackUrl: 'https://shop.test/payments/cybersource/callback',
    currency: 'MMK',
    transactionType: CyberSourceTransactionType::Sale,
    locale: 'en-us',
    returnUrl: 'https://shop.test/payments/cybersource/receipt',
    cancelUrl: 'https://shop.test/checkout',
);

$payment = $cyberSource->hostedCheckout($data);

// The page posts the signed form to CyberSource on load.
echo $payment->toHtml();
```

### CyberSourcePaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 40 characters, sent as `reference_number` |
| `amount` | `Amount\|int` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `10000` or `Amount::parse('10.50')` |
| `callbackUrl` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters |
| `currency` | `string` | Yes | Three-letter uppercase ISO 4217 code enabled on your Secure Acceptance profile, e.g. `MMK` |
| `transactionType` | `CyberSourceTransactionType` | Yes | `CyberSourceTransactionType::Sale` (`'sale'`), `::Authorization` (`'authorization'`), `::SaleAndCreateToken` (`'sale,create_payment_token'`) or `::AuthorizationAndCreateToken` (`'authorization,create_payment_token'`) |
| `locale` | `string` | Yes | Hosted page language, lowercase `xx-xx`, e.g. `en-us` |
| `returnUrl` | `?string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters. Left out of the form when unset |
| `cancelUrl` | `?string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters. Left out of the form when unset |

CyberSource requires the callback, receipt and cancel URLs to use HTTPS with TLS 1.2 or later on port 443; the package doesn't enforce it.

### Transaction Types

`sale` authorizes the payment and settles it in one step. `authorization` only authorizes it: the funds are held, not collected, until you capture the authorization through CyberSource (the Business Center or its API), which is outside this package. The `create_payment_token` variants also ask CyberSource to create a payment token for the card.

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```php
// POST /payments/cybersource/callback
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $cyberSource->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException) {
    http_response_code(400);
    echo 'invalid callback';
    exit;
}

if ($callback->isSuccessful()) {
    // $callback->orderId is your req_reference_number
    // $callback->gatewayReference is CyberSource's transaction_id
}

$callback->acknowledgement->send();
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes. A property the gateway didn't send is `null`. CyberSource posts form fields, so every `raw` value is a `string`, exactly as sent.

### `hostedCheckout()` → `FormPayment` {#hosted-checkout-response}

| Property / Method | CyberSource value |
|---|---|
| `flow()` | `PaymentFlow::Form` |
| `orderId` | Your `$data->orderId` |
| `action` | `{baseUrl}/pay`, e.g. `https://secureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `application/x-www-form-urlencoded` |
| `autoSubmitUrl` | `null` in plain PHP until you call `withAutoSubmitUrl()` |
| `withAutoSubmitUrl($url)` | Returns a copy with `autoSubmitUrl` set |
| `toHtml(?string $nonce = null)` | A full HTML page that posts `fields` to `action` on load; `$nonce` is added to its inline script |
| `field($name)` | One field's value, or `null` |
| `values()` | `fields` as an array |

| Form field | Value |
|---|---|
| `access_key` | `$config->accessKey` |
| `profile_id` | `$config->profileId` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The names of the fields sent, except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `$data->locale` |
| `transaction_type` | `$data->transactionType` |
| `reference_number` | `$data->orderId` |
| `amount` | `$data->amount`, e.g. `10000` |
| `currency` | `$data->currency` |
| `override_custom_receipt_page` | `$data->returnUrl`; left out when unset |
| `override_backoffice_post_url` | `$data->callbackUrl` |
| `override_custom_cancel_page` | `$data->cancelUrl`; left out when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`hostedCheckout()` makes no HTTP call. `FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | CyberSource value |
|---|---|
| `orderId` | CyberSource `req_reference_number` (your `orderId`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gatewayReference` | CyberSource `transaction_id`. `null` when it is not signed |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`; `null` when both are. Signed values only. On `ACCEPT` it can be less than the order total (partial approval, reason code `110`); on `DECLINE`, `ERROR` and `CANCEL` it is the requested amount (`req_amount`), not a paid amount |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `Successful` |
| `REVIEW` | `Pending` |
| `DECLINE`, `ERROR` | `Failed` |
| `CANCEL` | `Canceled` |

`ACCEPT` includes partial approvals (reason code `110`), where the issuer approved less than the requested amount: compare `amount` with the order total before fulfilling. With an `authorization` transaction type, `ACCEPT` means authorized, not captured, see [Transaction Types](#transaction-types).

`REVIEW` means the authorization needs your review (reason codes `200`, `201`, `230` and `520`), and CyberSource posts nothing again once it is decided: resolve it in the Business Center and update the order yourself.

Any other `decision` throws `SignatureVerificationException` (`CyberSource callback is malformed.`), so a verified callback never has the `Unknown` status.

## Errors

| Call | Throws | When |
|---|---|---|
| `new CyberSourcePaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is signed |
| `handleCallback()` | `SignatureVerificationException` | `CyberSource callback signature verification failed.`: `signature` is missing, not a string or doesn't match, a field listed in `signed_field_names` is missing or holds an object or array, or `signed_field_names` doesn't list itself or has an empty, repeated or `=`-containing name. `CyberSource callback is malformed.`: the signature matches but `decision` or `req_reference_number` isn't signed, or `decision` isn't one of the five above |

CyberSource makes no HTTP calls, so nothing throws `ApiException`.
