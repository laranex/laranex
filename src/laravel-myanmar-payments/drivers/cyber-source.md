---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments with Laravel Myanmar Payments. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `cyberSource()->initiate($data)` | Signed form posted to the hosted checkout | [`FormPayment`](/laravel-myanmar-payments/payment-flows#form-payments) |
| `cyberSource()->handleCallback($request)` | Verify the result post | `PaymentCallback` |

CyberSource has no status API in this package: rely on the callback.

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
| `callbackUrl` | `string` | Yes | HTTPS URL CyberSource posts the result to. At most 255 characters |
| `returnUrl` | `?string` | No | HTTPS receipt page for the customer. At most 255 characters |
| `cancelUrl` | `?string` | No | HTTPS page shown when the customer cancels. At most 255 characters |
| `currency` | `string` | No | Any ISO 4217 code (CyberSource is multi-currency), default `MMK` |
| `transactionType` | `CyberSourceTransactionType` | No | `Sale` (default), `Authorization`, `SaleAndCreateToken` or `AuthorizationAndCreateToken` |
| `locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`, default `en-us` |

For decimal amounts or another currency, pass an [`Amount`](/laravel-myanmar-payments/amounts): `amount: Amount::parse('10.50'), currency: 'USD'`.

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```php
Route::post('/payments/cybersource/callback', function (Request $request) {
    $callback = MyanmarPayments::cyberSource()->handleCallback($request);

    if ($callback->isSuccessful()) {
        // $callback->orderId (req_reference_number), $callback->gatewayReference (transaction_id)
    }

    return MyanmarPayments::acknowledge($callback);
})->name('payments.cybersource.callback');
```

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `Successful` |
| `REVIEW` | `Pending` |
| `DECLINE`, `ERROR` | `Failed` |
| `CANCEL` | `Cancelled` |
| anything else | `Unknown` |
