---
title: AYA Pay
description: Integrate the AYA Payment Gateway in plain PHP. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Call | What it does | Returns |
|---|---|---|
| `$ayaPay->services()` | List the channels enabled for your account | [`list<AyaPayService>`](#services-response) |
| `$ayaPay->initiate($data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `$ayaPay->status($orderId)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `$ayaPay->handleCallback($request)` | Verify the backend callback | [`PaymentCallback`](#handlecallback-response) |
| `$ayaPay->verifyRedirect($request)` | Verify the customer's return | [`PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA Pay puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: '$ayaPay->services()' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + AyaPayMethod::Qr' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: '$ayaPay->initiate($data)', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the form and pay', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$ayaPay->handleCallback($request)' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: '$ayaPay->verifyRedirect($request)' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```php
use Laranex\PhpMyanmarPayments\AyaPay\AyaPay;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayConfig;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayMethod;

$ayaPay = new AyaPay(new AyaPayConfig(
    appKey: '...',
    appSecret: '...',
    sandbox: true,
));

foreach ($ayaPay->services() as $service) {
    // $service->name: "AYA Pay"
    // $service->key: "aya_pay", pass it as channel
    // $service->imageUrl: the channel's logo
    // $service->methods: [AyaPayMethod::Qr, AyaPayMethod::Noti]
    if ($service->supports(AyaPayMethod::Qr)) {
        // offer the QR method
    }
}
```

Methods AYA lists that this package doesn't know yet are kept in `$service->unknownMethods`.

| `AyaPayMethod` | Value | Customer |
|---|---|---|
| `AyaPayMethod::Web` | `WEB` | Pays on a hosted web page (cards) |
| `AyaPayMethod::Qr` | `QR` | Scans a QR with the wallet app |
| `AyaPayMethod::Noti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayMethod;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayPaymentData;

$data = new AyaPayPaymentData(
    orderId: 'ORDER_'.$order->id,
    amount: 10000,
    channel: 'aya_pay',
    method: AyaPayMethod::Qr,
    returnUrl: 'https://shop.test/payments/aya/return',
    description: 'Order #'.$order->id,
);

$payment = $ayaPay->initiate($data);

// The page posts the signed form to AYA on load.
echo $payment->toHtml();
```

### AyaPayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `Amount\|int` | Yes | Whole kyat, greater than 0, e.g. `10000` or `Amount::kyat(10000)`. AYA documents no decimals and only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | A method the channel supports |
| `returnUrl` | `?string` | No | Absolute http or https URL. `null` uses the URL registered with AYA |
| `description` | `?string` | No | Shown to the customer |
| `userRefs` | `list<string>` | No | Up to 5 of your own values, echoed back in the callback |

### Form Encoding

AYA expects the form as `multipart/form-data`. `$payment->enctype` carries it; use it if you [render the form yourself](/php-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

AYA posts to the callback URL registered with them.

```php
// POST /payments/aya/callback
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $callback = $ayaPay->handleCallback(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException) {
    http_response_code(400);
    exit;
}

if ($callback->isSuccessful()) {
    // $callback->orderId is your merchOrderId
    // $callback->gatewayReference is AYA's tranId
}

$callback->acknowledgement()->send();
```

AYA signs only the fields present in its payload (wallet payments leave out the card fields); the package verifies them in the order the specification lists.

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```php
// GET /payments/aya/return
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

try {
    $result = $ayaPay->verifyRedirect(CallbackRequest::fromGlobals());
} catch (SignatureVerificationException) {
    http_response_code(400);
    exit;
}

echo $result->isSuccessful()
    ? 'Thank you, your payment was received.'
    : 'Payment '.$result->status->value.'.';
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. Still fulfill orders from the backend callback.

## Status Checks

```php
$result = $ayaPay->status('ORDER_'.$order->id);

if ($result->isSuccessful()) {
    // $result->gatewayReference is AYA's tranId
}
```

`status()` takes your `orderId`. An order AYA doesn't know throws `ApiException` (`20` Transaction not found).

## Responses

What AYA Pay puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `services()` → `list<AyaPayService>` {#services-response}

`Laranex\PhpMyanmarPayments\AyaPay\AyaPayService` is AYA-only, so it is listed in full here.

| Property / Method | AYA Pay value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `channel`. Always set |
| `imageUrl` | AYA `image_url`, the channel's logo. `null` when AYA sends none |
| `methods` | `list<AyaPayMethod>` this package knows, e.g. `[AyaPayMethod::Qr, AyaPayMethod::Noti]` |
| `unknownMethods` | `list<string>` of methods AYA listed that this package doesn't know yet. Usually `[]` |
| `supports($method)` | Whether `methods` contains `$method` |

Entries AYA sends without a `key` are skipped.

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{base_url}/v1/payment/request`, e.g. `https://uat-pgw.ayainnovation.com/v1/payment/request` |
| `fields` | The signed fields below. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `autoSubmitUrl` | `null` in plain PHP until you call `withAutoSubmitUrl()` |
| `withAutoSubmitUrl($url)` | Returns a copy with `autoSubmitUrl` set |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

`fields`, in the order AYA signs them:

| Form field | Value |
|---|---|
| `merchOrderId` | Your `orderId` |
| `amount` | Your `amount`, e.g. `10000` |
| `appKey` | Your configured app key |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | Your `userRefs`, `""` when unused |
| `description` | Your `description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | Your `channel`, e.g. `aya_pay` |
| `method` | Your `method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | Your `returnUrl`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

`initiate()` makes no HTTP call. `FormPayment` has no `raw`: nothing is sent to AYA until the customer's browser posts the form.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId`, falling back to the `orderId` you passed. Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA leaves out the fields that don't apply (wallet payments have no card fields), so `raw` only has the keys AYA sent. Some payloads spell `currencyCode` as `currenyCode`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, trimmed, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `10000` |
| `raw` | The verified, decoded payload, with the same keys as `status()` |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as [`handleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL (query string first, then the body). There is nothing to acknowledge: render your own page.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `Successful` |
| `01` | `Pending` |
| `02` (fail), `03` (reject) | `Failed` |
| `04` | `Expired` |
| anything else | `Unknown` |

## Errors

| Call | Throws | When |
|---|---|---|
| `new AyaPayPaymentData(...)` | `InvalidPaymentDataException` | A value breaks the rules above. Nothing is signed |
| `services()` | `ApiException` | AYA answers with an HTTP error or a `status` other than `00` |
| `status()` | `ApiException` | AYA answers with an HTTP error or a `status` other than `00`, e.g. `20` Transaction not found |
| `status()` | `SignatureVerificationException` | The enquiry payload's `checkSum` doesn't match |
| `handleCallback()`, `verifyRedirect()` | `SignatureVerificationException` | `payload` is missing or not base64 JSON, or `checkSum` doesn't match |

`ApiException` carries AYA's `status` (e.g. `20` Transaction not found, `09` Duplicate order ID) in `gatewayCode` and its `message` in `gatewayMessage`. When AYA can't be reached, the calls throw `ApiException` with `httpStatus` `0`.
