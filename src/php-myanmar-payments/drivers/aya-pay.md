---
title: AYA Pay
description: Integrate the AYA Payment Gateway in plain PHP. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
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
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: '$ayaPay->handleCallback()' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: '$ayaPay->verifyRedirect()' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```php
use Laranex\PhpMyanmarPayments\AyaPay\AyaPay;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayConfig;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayMethod;

$ayaPay = new AyaPay(new AyaPayConfig(appKey: '...', appSecret: '...', sandbox: true));

foreach ($ayaPay->services() as $service) {
    $service->name;      // "AYA Pay"
    $service->key;       // "aya_pay", pass as channel
    $service->imageUrl;  // logo
    $service->methods;   // [AyaPayMethod::Qr, AyaPayMethod::Noti]
    $service->supports(AyaPayMethod::Qr);
}
```

| `AyaPayMethod` | Value | Customer |
|---|---|---|
| `Web` | `WEB` | Pays on a hosted web page (cards) |
| `Qr` | `QR` | Scans a QR with the wallet app |
| `Noti` | `NOTI` | Approves a push notification in the wallet app |

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayPaymentData;

$payment = $ayaPay->initiate(new AyaPayPaymentData(
    orderId: 'ORDER'.$order->id,
    amount: 8000,
    channel: 'aya_pay',
    method: AyaPayMethod::Qr,
    returnUrl: 'https://shop.test/aya/return.php',
));

echo $payment->toHtml(); // posts the signed form to AYA on load
```

AYA expects the form as `multipart/form-data`; `$payment->enctype` carries it if you [render the form yourself](/php-myanmar-payments/payment-flows#form-payments).

### AyaPayPaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | Unique, 6 to 40 characters (`merchOrderId`) |
| `amount` | `Amount\|int` | Yes | Whole kyat, greater than 0, e.g. `1000` or `Amount::kyat(1000)`. AYA documents no decimals. AYA only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | A method the channel supports |
| `returnUrl` | `?string` | No | Absolute http or https URL. Defaults to the URL registered with AYA |
| `description` | `?string` | No | Shown to the customer |
| `userRefs` | `list<string>` | No | Up to 5 of your own values, echoed back in the callback |

## Handling Callbacks

AYA posts to the callback URL registered with them.

```php
// aya/callback.php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$callback = $ayaPay->handleCallback(CallbackRequest::fromGlobals());

if ($callback->isSuccessful()) {
    // $callback->orderId (merchOrderId), $callback->gatewayReference (tranId), $callback->amount
}

$callback->acknowledgement()->send();
```

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```php
// aya/return.php
$result = $ayaPay->verifyRedirect(CallbackRequest::fromGlobals());

echo $result->isSuccessful() ? 'Thank you, your payment was received.' : 'Payment '.$result->status->value.'.';
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. Still fulfill orders from the backend callback.

## Responses

What AYA Pay puts in each property. See [Results](/php-myanmar-payments/references/results) and [PaymentCallback & Status](/php-myanmar-payments/references/payment-callback) for the full classes.

### `services()` → `list<AyaPayService>` {#services-response}

| Property / Method | AYA Pay value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` |
| `key` | AYA `key`, e.g. `aya_pay`, `visa`. Pass it as `channel` |
| `imageUrl` | AYA `image_url`, the channel's logo. `null` when AYA sends none |
| `methods` | `list<AyaPayMethod>` the channel supports, e.g. `[AyaPayMethod::Qr, AyaPayMethod::Noti]` |
| `unknownMethods` | `list<string>` of methods AYA listed that this package doesn't know yet, e.g. `['TOKEN']` |
| `supports($method)` | `true` when `$method` is in `methods` |

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{base_url}/v1/payment/request` |
| `fields` | The signed fields below. Post them unchanged |
| `enctype` | `multipart/form-data` |
| `autoSubmitUrl` | `null` in plain PHP until you call `withAutoSubmitUrl()` |
| `withAutoSubmitUrl($url)` | Returns a copy with `autoSubmitUrl` set |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

`fields`, in the order AYA signs them:

| Key | Value |
|---|---|
| `merchOrderId` | Your `orderId` |
| `amount` | Your `amount`, e.g. `8000` |
| `appKey` | Your configured app key |
| `timestamp` | Unix time in seconds |
| `userRef1` … `userRef5` | Your `userRefs`, `""` when unused |
| `description` | Your `description`, `""` when unset |
| `currencyCode` | `104` (MMK) |
| `channel` | Your `channel`, e.g. `aya_pay` |
| `method` | Your `method`, e.g. `QR` |
| `overrideFrontendRedirectUrl` | Your `returnUrl`, `""` when unset |
| `checkSum` | HMAC-SHA256 of the values above joined with `:` |

### `status()` → `PaymentStatusResult` {#status-response}

| Property | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`). Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The verified enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode`, `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime` |

AYA omits the card fields for wallet payments, so `raw` only has the keys AYA sent. Some responses spell `currencyCode` as `currenyCode`.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | AYA Pay value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The decoded, verified payload, with the same keys as `status()` |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as [`handleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL. Ignore `acknowledgement()` here and render your own page.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `Successful` |
| `01` | `Pending` |
| `02` (fail), `03` (reject) | `Failed` |
| `04` | `Expired` |
| anything else | `Unknown` |

## Errors

`services()` and `status()` throw `ApiException` when AYA's `status` is not `00`, e.g. `20` Transaction not found, `09` Duplicate order ID. `status()` also throws `SignatureVerificationException` when the enquiry payload's checksum doesn't match.
