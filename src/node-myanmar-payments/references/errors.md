---
title: Errors
description: Every error thrown by Node Myanmar Payments extends PaymentError and can be matched with instanceof. Reference for validation, API, signature and configuration errors.
---

# Errors

Every error the package throws extends `PaymentError` (which extends `Error`). Match them with `instanceof`:

```ts
import { ApiError, InvalidPaymentDataError } from '@laranex/myanmar-payments';

try {
  const payment = await kbz.pwa(data);
} catch (error) {
  if (error instanceof InvalidPaymentDataError) {
    throw new Error(`check the order: ${JSON.stringify(error.errors)}`);
  }
  if (error instanceof ApiError) {
    throw new Error(`KBZ said ${error.gatewayCode}: ${error.gatewayMessage}`);
  }
  throw error;
}
```

| Class | Thrown when |
|---|---|
| `InvalidPaymentDataError` | Payment data breaks the gateway's documented rules, or `Amount.kyat` / `Amount.parse` get bad input. Thrown before any request is sent |
| `ApiError` | The gateway rejected the request, answered with an error (including errors sent with HTTP 200), or could not be reached |
| `SignatureVerificationError` | A callback, return redirect or gateway response fails signature verification |
| `ConfigurationError` | A gateway is missing a credential |

Each error's `name` is its class name, e.g. `ApiError`.

## InvalidPaymentDataError

| Field | Type | Description |
|---|---|---|
| `errors` | `Record<string, string>` | Field name to message, e.g. `{ amount: 'Wave Money does not accept decimal amounts; …' }`. Wave item errors use `items.0.amount` keys |

`message` joins the messages in field order.

## ApiError

| Field | Type | Description |
|---|---|---|
| `message` | `string` | What failed |
| `gatewayCode` | `string \| undefined` | The gateway's own error code, e.g. `ORDER_ID_USED`, `09`, `PAYMENT ALREADY EXISTS` |
| `gatewayMessage` | `string \| undefined` | The gateway's own error message |
| `httpStatus` | `number` | The response status, `0` when no response was received |
| `raw` | `Record<string, unknown>` | The decoded response body |
| `cause` | `unknown` | The underlying network error, if any |

For a timed-out or aborted call, `cause` is the abort reason, e.g. a `DOMException` named `TimeoutError` or `AbortError`.

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

Thrown by each config class (and so by each gateway's constructor and `fromEnv`), and by `MyanmarPayments` when a gateway is used without configuration.
