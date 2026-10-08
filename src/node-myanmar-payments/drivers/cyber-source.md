---
title: CyberSource
description: Integrate CyberSource Secure Acceptance card payments in Node.js. Signed hosted checkout form and verified callbacks.
---

# CyberSource

| Method | Flow | Returns |
|---|---|---|
| `cs.initiate(data)` | Signed form posted to the hosted checkout | [`FormPayment`](#initiate-response) |
| `cs.handleCallback(request)` | Verify the result post | [`PaymentCallback`](#handlecallback-response) |

[Responses](#responses) shows what CyberSource puts in each result.

CyberSource has no status API in this package: rely on the callback.

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
import { Amount } from '@laranex/myanmar-payments';
import { CyberSource } from '@laranex/myanmar-payments/cyber-source';

const cs = new CyberSource({ profileId: '...', accessKey: '...', secretKey: '...' });

const payment = cs.initiate({
  orderId: `ORDER-${orderId}`,
  amount: Amount.parse('10.50'),
  currency: 'USD',
  callbackUrl: 'https://shop.test/payments/cybersource/callback',
  returnUrl: 'https://shop.test/payments/cybersource/receipt',
  cancelUrl: 'https://shop.test/checkout',
});
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(payment.toHtml()); // posts the signed form to CyberSource on load
```

`CyberSource` takes no HTTP options and `initiate()` is synchronous: CyberSource only signs fields and makes no HTTP calls.

### CyberSourcePaymentData

| Field | Type | Required | Rules |
|---|---|---|---|
| `orderId` | `string` | Yes | At most 50 characters, sent as `reference_number` |
| `amount` | `Amount \| number \| bigint` | Yes | Order total in `currency`, 0 or more, any number of decimals, at most 15 characters |
| `callbackUrl` | `string` | Yes | Absolute http or https URL CyberSource posts the result to. At most 255 characters; CyberSource may require HTTPS in production |
| `returnUrl` | `string` | No | Receipt page for the customer (absolute http or https URL). At most 255 characters |
| `cancelUrl` | `string` | No | Page shown when the customer cancels (absolute http or https URL). At most 255 characters |
| `currency` | `string` | No | Any ISO 4217 code (CyberSource is multi-currency). Unset means `MMK` |
| `transactionType` | `CyberSourceTransactionType` | No | `'sale'` (default), `'authorization'`, `'sale,create_payment_token'` or `'authorization,create_payment_token'`; also available as `CyberSourceTransactionType.Sale`, `.Authorization`, `.SaleAndCreateToken`, `.AuthorizationAndCreateToken` |
| `locale` | `string` | No | Hosted page language as a CyberSource locale code such as `en-us`. Unset means `en-us` |

## Handling Callbacks

CyberSource posts a form to `callbackUrl`. The same check works for the browser post to your receipt page.

```ts
try {
  const callback = cs.handleCallback(await CallbackRequest.fromNodeRequest(req));
  if (callback.isSuccessful()) {
    // callback.orderId (req_reference_number), callback.gatewayReference (transaction_id)
  }
  callback.acknowledgement.send(res);
} catch (error) {
  res.writeHead(400).end('invalid callback');
}
```

A post whose `signed_field_names` lists a field that is missing fails verification.

## Responses

What CyberSource puts in each field. See [Results](/node-myanmar-payments/references/results) and [PaymentCallback & Status](/node-myanmar-payments/references/payment-callback) for the full classes. On error the method throws; a field the gateway didn't send is `undefined`. CyberSource posts form fields, so every `raw` value is a string, exactly as sent.

### `initiate()` → `FormPayment` {#initiate-response}

| Field / Method | CyberSource value |
|---|---|
| `flow` | `'form'` |
| `orderId` | Your `data.orderId` |
| `action` | `{baseUrl}/pay`, e.g. `https://testsecureacceptance.cybersource.com/pay` |
| `fields` | The signed fields below, in signing order |
| `enctype` | `application/x-www-form-urlencoded` |
| `toHtml()` | A page that posts the fields to `action` on load |

| Form field | Value |
|---|---|
| `access_key` | `config.accessKey` |
| `profile_id` | `config.profileId` |
| `transaction_uuid` | A random id per call |
| `signed_field_names` | Every field name in this table except `signature`, comma-separated |
| `signed_date_time` | UTC, e.g. `2026-10-08T09:30:00Z` |
| `locale` | `data.locale`, `en-us` when unset |
| `transaction_type` | `data.transactionType`, `sale` when unset |
| `reference_number` | `data.orderId` |
| `amount` | `data.amount`, e.g. `10.50` |
| `currency` | `data.currency`, `MMK` when unset |
| `override_custom_receipt_page` | `data.returnUrl`, `""` when unset |
| `override_backoffice_post_url` | `data.callbackUrl` |
| `override_custom_cancel_page` | `data.cancelUrl`, `""` when unset |
| `signature` | Base64 HMAC-SHA256 of the signed fields |

`initiate()` makes no HTTP call. Errors: `InvalidPaymentDataError` only.

### `handleCallback()` → `PaymentCallback` {#handlecallback-response}

| Field | CyberSource value |
|---|---|
| `orderId` | CyberSource `req_reference_number` (your `orderId`) |
| `status` | `decision` mapped, see [Statuses](#statuses) |
| `gatewayStatus` | CyberSource `decision`, trimmed and uppercased, e.g. `ACCEPT` |
| `gatewayReference` | CyberSource `transaction_id` |
| `amount` | CyberSource `auth_amount`, falling back to `req_amount`, e.g. `10.50` |
| `raw` | The verified post: `decision`, `reason_code`, `message`, `transaction_id`, `req_reference_number`, `req_amount`, `req_currency`, `auth_amount`, `signed_field_names`, `signature` and the other fields CyberSource sends |
| `acknowledgement` | HTTP `200`, empty body, `Content-Type: text/plain` |

Errors: `SignatureVerificationError` when `signature` does not match or a field listed in `signed_field_names` is missing.

## Statuses

| CyberSource `decision` | `PaymentStatus` |
|---|---|
| `ACCEPT` | `successful` |
| `REVIEW` | `pending` |
| `DECLINE`, `ERROR` | `failed` |
| `CANCEL` | `cancelled` |
| anything else | `unknown` |
