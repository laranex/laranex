---
title: AYA Pay
description: Integrate the AYA Payment Gateway in plain PHP. One hosted checkout for AYA Pay, other wallets and cards, with channel discovery, status checks and verified callbacks.
---

# AYA Pay

The AYA Payment Gateway is one hosted checkout for AYA Pay, other wallets (KBZ Pay, WavePay, UAB Pay, CB Pay…) and cards (VISA, Mastercard, JCB).

| Method | Flow | Returns |
|---|---|---|
| `$ayaPay->services()` | List the channels enabled for your account | `list<AyaPayService>` |
| `$ayaPay->initiate($data)` | Signed form posted to AYA | [`FormPayment`](/php-myanmar-payments/payment-flows#form-payments) |
| `$ayaPay->status($orderId)` | Enquire an order | `PaymentStatusResult` |
| `$ayaPay->handleCallback($request)` | Verify the backend callback | `PaymentCallback` |
| `$ayaPay->verifyRedirect($request)` | Verify the customer's return | `PaymentCallback` |

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
| `amount` | `int` | Yes | Whole kyat, greater than 0 (AYA documents no decimals). AYA only accepts MMK (`104`) |
| `channel` | `string` | Yes | A key from `services()` |
| `method` | `AyaPayMethod` | Yes | A method the channel supports |
| `returnUrl` | `?string` | No | Valid URL. Defaults to the URL registered with AYA |
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

Still fulfil orders from the backend callback.

## Statuses

| AYA `statusCode` | `PaymentStatus` |
|---|---|
| `00` | `Successful` |
| `01` | `Pending` |
| `02` (fail), `03` (reject) | `Failed` |
| `04` | `Expired` |
| anything else | `Unknown` |

## Errors

`services()` and `status()` throw `ApiException` when AYA's `status` is not `00`, e.g. `20` Transaction not found, `09` Duplicate order ID.
