---
title: Errors
description: Every exception thrown by PHP Myanmar Payments extends PaymentException and can be caught with catch. Reference for validation, API, signature and configuration errors.
---

# Errors

Every exception the package throws extends `PaymentException` (which extends `RuntimeException`), all in `Laranex\PhpMyanmarPayments\Exceptions`. Catch them with `catch`:

```php
use Laranex\PhpMyanmarPayments\Exceptions\ApiException;
use Laranex\PhpMyanmarPayments\Exceptions\InvalidPaymentDataException;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;

try {
    $data = new KbzPayPaymentData(
        orderId: 'ORDER_1',
        amount: 10000,
        callbackUrl: 'https://shop.test/payments/kbz/callback',
    );
    $payment = $kbz->pwa($data);
} catch (InvalidPaymentDataException $e) {
    throw new DomainException(
        'check the order: '.json_encode($e->errors()),
        previous: $e,
    );
} catch (ApiException $e) {
    throw new RuntimeException(
        "KBZ said {$e->gatewayCode}: {$e->gatewayMessage}",
        previous: $e,
    );
}
```

| Class | Thrown when |
|---|---|
| `InvalidPaymentDataException` | Payment data breaks the gateway's documented rules, or `Amount::kyat` / `Amount::parse` / `Amount::from` get bad input. Thrown when the payment data is created, before any request is sent |
| `ApiException` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `SignatureVerificationException` | A callback, return redirect or gateway response fails signature verification, including one with a nested object or array in a signed field |
| `ConfigurationException` | A gateway setting is missing or blank, or a time setting is not a whole number greater than 0 |

## InvalidPaymentDataException

| Property / Method | Type | Description |
|---|---|---|
| `errors()` | `array<string, string>` | Field name to message, keyed by the payment data's camelCase parameter names, e.g. `['amount' => 'Wave Money does not accept decimal amounts; …']`. Wave item errors use `items.0.amount` keys |

`getMessage()` is `Invalid payment data: ` followed by the messages, in field-name order. A bad amount reads e.g. `The amount field must be a number such as 1000 or 1000.50, got "1,000".`

## ApiException

| Property / Method | Type | Description |
|---|---|---|
| `getMessage()` | `string` | What failed |
| `gatewayCode` | `?string` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gatewayMessage` | `?string` | The gateway's own error message |
| `httpStatus` | `int` | The response status, `0` when no response was received |
| `raw` | `array` | The decoded response body (`[]` when there was none) |
| `getPrevious()` | `?Throwable` | The underlying network error, if any |

When the gateway sends an error code without a message, `getMessage()` ends with the bracketed code, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED]`. For a call that could not reach the gateway, `getMessage()` is `Could not reach <url>: …` and `getPrevious()` is the PSR-18 client's `ClientExceptionInterface`, e.g. Guzzle's `ConnectException`.

## SignatureVerificationException

| Property / Method | Type | Description |
|---|---|---|
| `getMessage()` | `string` | What failed |
| `raw` | `array` | The unverified payload, for logging only. Never act on it |

## ConfigurationException

| Property / Method | Type | Description |
|---|---|---|
| `gateway` | `string` | e.g. `kbz_pay` |
| `key` | `string` | The setting, e.g. `app_key` |

`getMessage()` is e.g. `The kbz_pay configuration is missing [app_key].`, or `The kbz_pay configuration [timeout_in_seconds] must be a whole number greater than 0.` for a time setting. Thrown by each config class (and so by each gateway's constructor and `fromEnv()`), and by `MyanmarPayments` when a gateway is used without configuration.
