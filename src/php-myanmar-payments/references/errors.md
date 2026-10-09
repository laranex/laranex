---
title: Errors
description: Every exception thrown by PHP Myanmar Payments extends PaymentException. Reference for validation, API, signature and configuration errors.
---

# Errors

Every exception extends `Laranex\PhpMyanmarPayments\Exceptions\PaymentException`, so one `catch` covers the package.

| Exception | Thrown when |
|---|---|
| `InvalidPaymentDataException` | A request object is built with values the gateway would reject |
| `ApiException` | A gateway rejects a request, answers with an error (including errors sent with HTTP 200), or cannot be reached |
| `SignatureVerificationException` | A callback, return redirect or gateway response fails signature verification |
| `ConfigurationException` | A gateway is used without a credential it needs |

## InvalidPaymentDataException

```php
try {
    $data = new KbzPayPaymentData(
        orderId: 'ORDER-1',
        amount: 0,
        callbackUrl: 'https://shop.test/cb',
    );
} catch (InvalidPaymentDataException $e) {
    $e->errors();
    // ['orderId' => 'The orderId field may only contain ...',
    //  'amount' => 'The amount field must be greater than 0.']
}
```

## ApiException

| Property | Type | Description |
|---|---|---|
| `gatewayCode` | `?string` | The gateway's error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gatewayMessage` | `?string` | The gateway's error message |
| `httpStatus` | `int` | HTTP status of the response, `0` when no response was received |
| `raw` | `array` | The decoded response body |

## SignatureVerificationException

`raw` holds the unverified payload. Log it, never act on it.

## ConfigurationException

The message names the gateway and the missing key, e.g. `The wave_money configuration is missing [merchant_id].`
