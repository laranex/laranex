---
title: Errors
description: Every error thrown by Node Myanmar Payments extends PaymentError and can be matched with instanceof. Reference for validation, API, signature and configuration errors.
---

# Errors

Every error the package throws extends `PaymentError` (which extends `Error`). Catch them with `instanceof`:

```ts
import { ApiError, InvalidPaymentDataError } from '@laranex/myanmar-payments';

try {
  const payment = await kbz.pwa(data);
} catch (error) {
  if (error instanceof InvalidPaymentDataError) {
    const errors = JSON.stringify(error.errors);
    throw new Error(`check the order: ${errors}`, { cause: error });
  }
  if (error instanceof ApiError) {
    throw new Error(
      `KBZ said ${error.gatewayCode}: ${error.gatewayMessage}`,
      { cause: error },
    );
  }
  throw error;
}
```

| Class | Thrown when |
|---|---|
| `InvalidPaymentDataError` | Payment data breaks the gateway's documented rules, or `Amount.kyat` / `Amount.parse` / `Amount.from` get bad input. Thrown before any request is sent |
| `ApiError` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `ConfigurationError` | A gateway is missing a credential |

Each error's `name` is its class name, e.g. `ApiError`.

## InvalidPaymentDataError

| Field | Type | Description |
|---|---|---|
| `errors` | `Record<string, string>` | A frozen object of field name to message, keyed by the payment data's camelCase field names, e.g. `{ amount: 'Wave Money does not accept decimal amounts; …' }`. Wave item errors use `items.0.amount` keys |

`error.message` is `Invalid payment data: ` followed by the messages, in field-name order.

## ApiError

| Field | Type | Description |
|---|---|---|
| `message` | `string` | What failed |
| `gatewayCode` | `string \| undefined` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gatewayMessage` | `string \| undefined` | The gateway's own error message |
| `httpStatus` | `number` | The response status, `0` when no response was received |
| `raw` | `Record<string, unknown>` | The decoded response body (`{}` when there was none); JSON numbers are their exact text as `string`s |
| `cause` | `unknown` | The underlying network error, if any |

When the gateway sends an error code without a message, `error.message` ends with the bracketed code, e.g. `KBZ Pay precreate failed: [ORDER_ID_USED]`. For a call that could not reach the gateway, `error.message` is `Could not reach <url>: …` and `cause` is the `fetch` error, e.g. a `TypeError` for a refused connection or a `DOMException` named `TimeoutError` or `AbortError` for a timed-out or aborted call.

## SignatureVerificationError

| Field | Type | Description |
|---|---|---|
| `message` | `string` | What failed |
| `raw` | `Record<string, unknown>` | The unverified payload, for logging only. Never act on it |

## ConfigurationError

| Field | Type | Description |
|---|---|---|
| `gateway` | `string` | e.g. `kbz_pay` |
| `key` | `string` | The missing setting, e.g. `app_key` |

`error.message` is e.g. `The kbz_pay configuration is missing [app_key].` Thrown by each config class (and so by each gateway's constructor and `fromEnv()`), and by `MyanmarPayments` when a gateway is used without configuration.
