---
title: AYA Pay
description: Integrate the AYA Payment Gateway with Laravel Myanmar Payments. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
|---|---|---|
| `ayaPay()->services()` | List the channels enabled for your account | [`list<AyaPayService>`](#services-response) |
| `ayaPay()->initiate($data)` | Signed form posted to AYA | [`FormPayment`](#initiate-response) |
| `ayaPay()->status($orderId)` | Enquire an order | [`PaymentStatusResult`](#status-response) |
| `ayaPay()->handleCallback($request)` | Verify the backend callback | [`PaymentCallback`](#handlecallback-response) |
| `ayaPay()->verifyRedirect($request)` | Verify the customer's return | [`PaymentCallback`](#verifyredirect-response) |

[Responses](#responses) shows what AYA puts in each result.

## How it works

AYA posts the result to your callback URL and also signs the query string it adds when sending the customer back.

<SequenceDiagram
  title="AYA Pay: channels, signed form, callback, return"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Your app', to: 'AYA Pay', label: 'List enabled channels', detail: 'ayaPay()->services()' },
    { from: 'AYA Pay', to: 'Your app', label: 'Channels and methods', detail: 'e.g. aya_pay: QR, NOTI', response: true },
    { from: 'Customer', to: 'Your app', label: 'Pick a channel and method', detail: 'aya_pay + AyaPayMethod::Qr' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'ayaPay()->initiate()', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Form page posts to AYA', detail: 'via the myanmar-payments.form route' },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'ayaPay()->handleCallback()' },
    { from: 'Customer', to: 'Your app', label: 'Back on your return page', detail: 'payload + checkSum in the query' },
    { from: 'Your app', to: 'Your app', label: 'Show the right message', detail: 'ayaPay()->verifyRedirect()' },
  ]"
/>

## Channels and Methods

`channel` is a lowercase key such as `aya_pay`, `kbz_pay` or `visa`; `method` is how the customer pays through it. Which ones you have depends on your merchant account, so list them:

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayMethod;

foreach (MyanmarPayments::ayaPay()->services() as $service) {
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

$payment = MyanmarPayments::ayaPay()->initiate(new AyaPayPaymentData(
    orderId: 'ORDER'.$order->id,
    amount: 8000,
    channel: 'aya_pay',
    method: AyaPayMethod::Qr,
    returnUrl: route('payments.aya.return'),
));

return redirect($payment->autoSubmitUrl);
```

AYA expects the form as `multipart/form-data`; `$payment->enctype` carries it if you [render the form yourself](/laravel-myanmar-payments/payment-flows#form-payments).

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
Route::post('/payments/aya/callback', function (Request $request) {
    $callback = MyanmarPayments::ayaPay()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId (merchOrderId), $callback->gatewayReference (tranId), $callback->amount
    }

    return MyanmarPayments::acknowledge($callback);
});
```

## The Return Page

AYA signs the query string it adds when sending the customer back, so the return page can show the right message:

```php
Route::get('/payments/aya/return', function (Request $request) {
    $result = MyanmarPayments::ayaPay()->verifyRedirect($request);

    return view('payments.result', ['status' => $result->status]);
})->name('payments.aya.return');
```

A `+` in the base64 `payload` that reached you as a space (an unencoded query string) is read back as `+` before decoding; the checksum is still verified. Still fulfill orders from the backend callback.

## Responses

What AYA puts in each property. See [Results](/laravel-myanmar-payments/references/results) and [PaymentCallback & Status](/laravel-myanmar-payments/references/payment-callback) for the full classes.

### `services()` → `list<AyaPayService>` {#services-response}

Each `Laranex\PhpMyanmarPayments\AyaPay\AyaPayService`:

| Property / Method | AYA value |
|---|---|
| `name` | AYA `name`, e.g. `AYA Pay`. Falls back to `key` when AYA sends none |
| `key` | AYA `key`, e.g. `aya_pay`, `kbz_pay`, `visa`. Pass it as `channel` |
| `imageUrl` | AYA `image_url`, the channel's logo. `null` when AYA sends none |
| `methods` | `list<AyaPayMethod>`, e.g. `[AyaPayMethod::Qr, AyaPayMethod::Noti]` |
| `unknownMethods` | `list<string>` of methods AYA listed that this package doesn't know yet. Usually `[]` |
| `supports($method)` | Whether `methods` contains `$method` |

Entries AYA sends without a `key` are skipped.

### `initiate()` → `FormPayment` {#initiate-response}

| Property / Method | AYA value |
|---|---|
| `orderId` | Your `orderId` |
| `action` | `{base_url}/v1/payment/request`, e.g. `https://uat-pgw.ayainnovation.com/v1/payment/request` |
| `fields` | In this order: `merchOrderId`, `amount`, `appKey`, `timestamp`, `userRef1`–`5` (`""` when unused), `description`, `currencyCode` (`104`), `channel`, `method`, `overrideFrontendRedirectUrl` (`""` without `returnUrl`), `checkSum` |
| `enctype` | `multipart/form-data` |
| `autoSubmitUrl` | Encrypted link to the `myanmar-payments.form` route, e.g. `https://shop.test/myanmar-payments/form?payload=…`. Expires after `form_route.ttl_minutes` (30). `null` when `form_route.enabled` is `false` |
| `toHtml()` | A full HTML page that posts the form on load |

`FormPayment` has no `raw`: nothing is sent to AYA until the customer's browser posts the form.

### `status()` → `PaymentStatusResult` {#status-response}

| Property | AYA value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`). Always set |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The verified enquiry payload: `merchOrderId`, `tranId`, `amount`, `currencyCode` (AYA sometimes spells it `currenyCode`), `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime`. Wallet payments omit the card fields |

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Property / Method | AYA value |
|---|---|
| `orderId` | AYA `merchOrderId` (your `orderId`) |
| `status` | `statusCode` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | AYA `statusCode`, e.g. `00` |
| `gatewayReference` | AYA `tranId` |
| `amount` | AYA `amount`, e.g. `8000` |
| `raw` | The verified payload: `merchOrderId`, `tranId`, `amount`, `currencyCode` (AYA sometimes spells it `currenyCode`), `statusCode`, `paymentCardNumber`, `paymentMobileNumber`, `cardTypeName`, `cardExpiryDate`, `nameOnCard`, `approvalCode`, `tranRef`, `userRef1`–`5`, `description`, `dateTime`. Wallet payments omit the card fields |
| `acknowledgement()` | HTTP `200`, empty body, `Content-Type: text/plain` |

`MyanmarPayments::acknowledge($callback)` turns `acknowledgement()` into a `CallbackResponse` (`Responsable`) that renders an empty `200`.

### `verifyRedirect()` → `PaymentCallback` {#verifyredirect-response}

The same values as [`handleCallback()`](#handlecallback-response), read from the signed `payload` and `checkSum` AYA adds to your return URL. There is nothing to acknowledge: return your own page.

`handleCallback()` and `verifyRedirect()` accept an `Illuminate\Http\Request` or a `CallbackRequest`.

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
