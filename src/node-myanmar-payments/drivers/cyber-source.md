---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Node.js. Signed hosted checkout form and verified callbacks.
---

# CyberSource

CyberSource Secure Acceptance is a hosted checkout for card payments, in MMK or any other currency.

| Call | What it does | Returns |
|---|---|---|
| `cs.initiate(data)` | Signed form posted to the hosted checkout | [`FormPayment`](#initiate-response) |
| `cs.handleCallback(request)` | Verify the result post | [`PaymentCallback`](#handlecallback-response) |

CyberSource has no status API in this package: the callback is the only payment result.

[Responses](#responses) shows what CyberSource puts in each result.

## How it works

CyberSource posts the result twice, to your backoffice URL and through the browser to your receipt page, and both are verified the same way.

<SequenceDiagram
  title="CyberSource: signed form, hosted checkout, two result posts"
  :participants="['Customer', 'Your app', 'CyberSource']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Customer', label: 'Signed form, auto-submits', detail: 'cs.initiate(data)', response: true },
    { from: 'Customer', to: 'CyberSource', label: 'Post to the hosted checkout', detail: 'POST /pay, then the card form' },
    { from: 'CyberSource', to: 'Your app', label: 'Backoffice post', detail: 'override_backoffice_post_url' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'cs.handleCallback(request)' },
    { from: 'Customer', to: 'Your app', label: 'Browser posts the receipt', detail: 'override_custom_receipt_page' },
    { from: 'Your app', to: 'Your app', label: 'Same signature check', detail: 'cs.handleCallback(request)' },
    { from: 'Your app', to: 'Customer', label: 'Show the receipt', response: true },
  ]"
/>

## Initiating a Payment

```ts
import {
  CyberSource,
  CyberSourceTransactionType,
  type CyberSourcePaymentData,
} from '@laranex/myanmar-payments/cyber-source';

const cs = new CyberSource({
  profileId: '...',
  accessKey: '...',
  secretKey: '...',
});

const data: CyberSourcePaymentData = {
  orderId: `ORDER_${order.id}`,
  amount: 10000,
  callbackUrl: 'https://shop.test/payments/cybersource/callback',
  currency: 'MMK',
  transactionType: CyberSourceTransactionType.Sale,
  locale: 'en-us',
  returnUrl: 'https://shop.test/payments/cybersource/receipt',
  cancelUrl: 'https://shop.test/checkout',
};

const payment = cs.initiate(data);

// The page posts the signed form to CyberSource on load.
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(payment.toHtml());
```

### CyberSourcePaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `Amount \| number \| bigint` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters, e.g. `10000` or `Amount.parse('10.50')` |
| `callbackUrl` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `currency` | `string` | Yes | Any three-letter uppercase ISO 4217 code, e.g. `MMK` |
| `transactionType` | `CyberSourceTransactionType` | Yes | `CyberSourceTransactionType.Sale` (`'sale'`), `.Authorization` (`'authorization'`), `.SaleAndCreateToken` (`'sale,create_payment_token'`) or `.AuthorizationAndCreateToken` (`'authorization,create_payment_token'`) |
| `locale` | `string` | Yes | Hosted page language as a CyberSource locale code, e.g. `en-us` |
| `returnUrl` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `cancelUrl` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |

### Amounts and Currencies

CyberSource is multi-currency and accepts decimals. For another currency, pass an [`Amount`](/node-myanmar-payments/amounts) with the currency: `amount: Amount.parse('10.50'), currency: 'USD'`.

### Form Encoding

CyberSource expects the form as `application/x-www-form-urlencoded`. `payment.enctype` carries it; use it if you [render the form yourself](/node-myanmar-payments/payment-flows#form-payments).

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```ts
import { CallbackRequest } from '@laranex/myanmar-payments';

// POST /payments/cybersource/callback
try {
  const request = await CallbackRequest.fromNodeRequest(req);
  const callback = cs.handleCallback(request);

  if (callback.isSuccessful()) {
    // callback.orderId is your req_reference_number
    // callback.gatewayReference is CyberSource's transaction_id
  }

  callback.acknowledgement.send(res);
} catch {
  res.writeHead(400).end('invalid callback');
}
```

Only signed fields are trusted: `decision` and `req_reference_number` must be listed in `signed_field_names`, `transaction_id` and the amount are read only when they are signed, and `raw` keeps only the signed fields plus `signature`. An unsigned extra field, such as `decision=ACCEPT` added to a re-posted checkout form, can't change the result.

## Responses

What CyberSource puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. A field the gateway didn't send is `undefined`. CyberSource posts form fields, so every `raw` value is a `string`, exactly as sent.

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `flow` | `'form'` |
| `orderId` | Your `data.orderId` |
| `action` | `{baseUrl}/pay`, e.g. `https://secureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below, in signing order. Post them unchanged |
| `enctype` | `application/x-www-form-urlencoded` |
| `toHtml()` | A full HTML page that posts `fields` to `action` on load |

| Form field | Value |
|---|---|
| `access_key` | `config.accessKey` |
| `profile_id` | `config.profileId` |
| `transaction_uuid` | A random ID, new for every call |
| `signed_field_names` | The field names in this table except `signature`, comma-separated |
| `signed_date_time` | UTC time, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.locale` |
| `transaction_type` | `data.transactionType` |
| `reference_number` | `data.orderId` |
| `amount` | `data.amount`, e.g. `10000` |
| `currency` | `data.currency` |
| `override_custom_receipt_page` | `data.returnUrl`, `""` when unset |
| `override_backoffice_post_url` | `data.callbackUrl` |
| `override_custom_cancel_page` | `data.cancelUrl`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`initiate()` makes no HTTP call, so it is synchronous and takes no `signal`, and `CyberSource` takes no HTTP options. `FormPayment` has no `raw`: nothing is sent to CyberSource until the customer's browser posts the form.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `orderId` | CyberSource `req_reference_number` (your `orderId`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gatewayReference` | CyberSource `transaction_id`. `undefined` when it is not signed |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount` when it is missing or empty, e.g. `10000`. Signed values only |
| `raw` | The signed fields of the verified post plus `signature`, e.g. `decision`, `reason_code`, `message`, `transaction_id`, `auth_amount`, `auth_code`, `req_reference_number`, `req_amount`, `req_currency`, `req_transaction_uuid`, `signed_field_names`, `signed_date_time`. Unsigned fields are left out |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `successful` |
| `REVIEW` | `pending` |
| `DECLINE`, `ERROR` | `failed` |
| `CANCEL` | `canceled` |
| anything else | `unknown` |

## Errors

| Call | Throws | When |
|---|---|---|
| `initiate()` | `InvalidPaymentDataError` | `CyberSource.validate(data)` fails. Nothing is signed |
| `handleCallback()` | `SignatureVerificationError` | `signature` doesn't match, a field listed in `signed_field_names` is missing or holds an object or array, or `decision` or `req_reference_number` isn't signed |

CyberSource makes no HTTP calls, so nothing throws `ApiError`.
