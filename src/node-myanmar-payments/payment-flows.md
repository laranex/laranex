---
title: Payment Flows
description: Each gateway method returns one typed result per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result. Each flow has its own result class with exactly the fields that flow needs, and every result has a `flow` property (`'redirect'`, `'form'`, `'qr'` or `'app'`), so a `switch` on `payment.flow` narrows the `PaymentResult` union.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `payment.url` | `kbz.pwa`, `wave.initiate` |
| `FormPayment` | Return `payment.toHtml()` | `aya.initiate`, `cs.initiate` |
| `QrPayment` | Show the QR to the customer | `kbz.qr`, `yoma.initiate`, `yoma.renewQr` |
| `AppPayment` | Return the signed payload to your mobile app | `kbz.app` |

Every method validates the payment data first and throws `InvalidPaymentDataError` before any request is sent. Call the gateway's static `validate()` yourself to check the data earlier, e.g. `KbzPay.validate(data)` while handling a form. The customer finishing on the gateway's side is never proof of payment: fulfill orders from the verified [callback](/node-myanmar-payments/callbacks) or a status check.

The samples on this page and the gateway pages are `node:http` handlers; [Framework Integration](/node-myanmar-payments/framework-integration) shows Express, Fastify, Next.js and Hono.

## Redirect Payments

Here is the flow with the KBZ Pay PWA; Wave Money works the same way with its own payment page.

<SequenceDiagram
  title="Redirect payment with the KBZ Pay PWA"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'await kbz.pwa(data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type PWAAPP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: '302 to payment.url', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handleCallback(request)' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Amount, KbzPay } from '@laranex/myanmar-payments';

const kbz = KbzPay.fromEnv(process.env);

async function checkout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const payment = await kbz.pwa({
    orderId: 'ORDER_1',
    amount: Amount.kyat(10000),
    callbackUrl: 'https://shop.test/payments/kbz/callback',
  });
  res.writeHead(302, { Location: payment.url }).end();
}
```

`payment.gatewayReference` holds the gateway's ID for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

Here is the flow with AYA Pay; CyberSource works the same way with its hosted checkout.

<SequenceDiagram
  title="Form payment with AYA Pay"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Sign the form, no API call', detail: 'aya.initiate(data)' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: 'res.end(payment.toHtml())', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'aya.handleCallback(request)' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. `toHtml()` returns a complete page that submits the form as soon as it loads, with every value escaped:

```ts
async function ayaCheckout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // no network call: synchronous, never awaited
  const payment = aya.initiate(data);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(payment.toHtml());
}
```

To build the form yourself, use `action`, `fields` (an ordered array of `{ name, value }`) and `enctype` with your template engine, which escapes every value:

```tsx
<form
  id="payment-form"
  method="POST"
  action={payment.action}
  encType={payment.enctype}
>
  {payment.fields.map((field) => (
    <input
      key={field.name}
      type="hidden"
      name={field.name}
      value={field.value}
    />
  ))}
</form>
```

Post the fields unchanged: they are signed. `payment.field(name)` looks up one value and `payment.values()` returns them as an object. AYA expects `multipart/form-data`, which `enctype` carries.

## QR Payments

Here is the flow with Yoma MMQR, whose QR expires after 120 seconds; a KBZ Pay QR follows the same steps without renewals.

<SequenceDiagram
  title="QR payment with Yoma MMQR"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'await yoma.initiate(data)' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the first QR', detail: 'qr/generate' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'QR image and refLabel', detail: 'payable for 120 seconds', response: true },
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'qrImage, a base64 PNG', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'await yoma.renewQr(orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yoma.handleCallback(request)' },
  ]"
/>

Gateways return QR codes in two shapes:

| Field | Gateway | Use it as |
|---|---|---|
| `qrString` | KBZ Pay | A payload: encode it into a QR image with any QR library, e.g. `qrcode` |
| `qrImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `qrImageDataUri()` |

```ts
async function yomaCheckout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const payment = await yoma.initiate(data);
  const until = payment.expiresAt?.toLocaleTimeString();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<img src="${payment.qrImageDataUri()}" alt="Scan to pay">
<p>Payable until ${until}</p>`);
}
```

`expiresAt` is a `Date` when the gateway limits how long the QR is payable (`undefined` otherwise), and `reference` holds the ID used for status checks (Yoma `refLabel`, KBZ `prepay_id`).

## App Payments

Here is the flow with the KBZ Pay mobile SDK.

<SequenceDiagram
  title="In-app payment with the KBZ Pay SDK"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Pay in your mobile app' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'await kbz.app(data)' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'res.end(JSON.stringify(payment))', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbz.handleCallback(request)' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. `AppPayment.toJSON()` returns the values with the SDK's names, so return it to your app as JSON; the app passes the values to `KBZPay.startPay()`:

```ts
async function kbzAppCheckout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const payment = await kbz.app(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  // {"orderId", "orderInfo", "sign", "signType"}
  res.end(JSON.stringify(payment));
}
```

The SDK's own result only means the payment screen closed; rely on the callback or `kbz.status()`.

## Handling Any Result

```ts
import type { ServerResponse } from 'node:http';
import type { PaymentResult } from '@laranex/myanmar-payments';

function respond(payment: PaymentResult, res: ServerResponse): void {
  switch (payment.flow) {
    case 'redirect':
      res.writeHead(302, { Location: payment.url }).end();
      break;
    case 'form':
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(payment.toHtml());
      break;
    case 'qr':
      res.end(payment.qrImageDataUri() ?? payment.qrString);
      break;
    case 'app':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payment));
      break;
  }
}
```

See [Results](/node-myanmar-payments/references/results) for every field.
