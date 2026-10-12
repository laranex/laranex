---
title: Errors
description: Every exception thrown by Laravel Myanmar Payments extends PaymentException. Reference for validation, API, signature and configuration errors.
---

# Errors

Every exception extends `Laranex\PhpMyanmarPayments\Exceptions\PaymentException`, so one `catch` covers the package.

| Exception | Thrown when |
|---|---|
| `InvalidPaymentDataException` | A request object is built with values the gateway would reject |
| `ApiException` | A gateway rejects a request, answers with an error (including errors sent with HTTP 200), or cannot be reached |
| `SignatureVerificationException` | A callback, return redirect or gateway response fails signature verification, including one whose signed values are malformed (an AYA Pay value holding `:`, a CyberSource `signed_field_names` that doesn't sign itself or an unknown `decision`, a Wave Money amount or ID out of format) |
| `ConfigurationException` | A gateway is used without a setting it needs, or a time setting is not a whole number greater than 0 |

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

The message names the gateway and the key, e.g. `The wave_money configuration is missing [merchant_id].`, or `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` for a time setting (a missing or blank HTTP timeout is not an error: it defaults to 30 seconds). `gateway` and `key` hold both. A form payment without a form link lifetime throws it with `form_route` and `ttl_minutes`.
