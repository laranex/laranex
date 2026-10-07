---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in plain PHP. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `$cyberSource->initiate($data)` | Signed form posted to the hosted checkout | [`FormPayment`](/php-myanmar-payments/payment-flows#form-payments) |
| `$cyberSource->handleCallback($request)` | Verify the result post | `PaymentCallback` |

CyberSource has no status API in this package: rely on the callback.

## Initiating a Payment

```php
use Laranex\PhpMyanmarPayments\CyberSource\CyberSource;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourceConfig;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourcePaymentData;
use Laranex\PhpMyanmarPayments\CyberSource\CyberSourceTransactionType;

$cyberSource = new CyberSource(new CyberSourceConfig(profileId: '...', accessKey: '...', secretKey: '...', sandbox: true));

$payment = $cyberSource->initiate(new CyberSourcePaymentData(
    orderId: 'ORDER-'.$order->id,
    amount: 20000,
    callbackUrl: 'https://shop.test/cybersource/callback.php',
    returnUrl: 'https://shop.test/cybersource/receipt.php',
    cancelUrl: 'https://shop.test/checkout.php',
));

echo $payment->toHtml(); // posts the signed form to CyberSource on load
```

`CyberSource` only signs fields: it makes no HTTP calls, so it takes no HTTP client.

### CyberSourcePaymentData

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `int\|string` | Yes | Order total in `currency`, 0 or more. Decimals allowed as a string, e.g. `'10.50'`. At most 15 characters |
| `callbackUrl` | `string` | Yes | HTTPS URL CyberSource posts the result to. At most 255 characters |
| `returnUrl` | `?string` | No | HTTPS receipt page for the customer. At most 255 characters |
| `cancelUrl` | `?string` | No | HTTPS page shown when the customer cancels. At most 255 characters |
| `currency` | `string` | No | Any ISO 4217 code (CyberSource is multi-currency), default `MMK` |
| `transactionType` | `CyberSourceTransactionType` | No | `Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`, default `en-us` |

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```php
// cybersource/callback.php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;

$callback = $cyberSource->handleCallback(CallbackRequest::fromGlobals());

if ($callback->isSuccessful()) {
    // $callback->orderId (req_reference_number), $callback->gatewayReference (transaction_id)
}

$callback->acknowledgement()->send();
```

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `Successful` |
| `REVIEW` | `Pending` |
| `DECLINE`, `ERROR` | `Failed` |
| `CANCEL` | `Cancelled` |
| anything else | `Unknown` |
