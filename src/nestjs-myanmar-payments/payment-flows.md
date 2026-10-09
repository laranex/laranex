---
title: Payment Flows
description: Each gateway method returns one typed result class per flow — RedirectPayment, FormPayment, QrPayment or AppPayment — so you always know what to do next.
---

# Payment Flows

Starting a payment always follows the same pattern: build the gateway's payment data, call the gateway, then act on the typed result it returns. Each flow has its own result class with exactly the fields that flow needs.

| Result | What you do | Returned by |
|---|---|---|
| `RedirectPayment` | Redirect the customer to `payment.url` | `kbzPay().pwa()`, `waveMoney().initiate()` |
| `FormPayment` | Redirect to `this.payments.autoSubmitUrl(payment)` | `ayaPay().initiate()`, `cyberSource().initiate()` |
| `QrPayment` | Show the QR to the customer | `kbzPay().qr()`, `yomaMmqr().initiate()`, `yomaMmqr().renewQr()` |
| `AppPayment` | Return the signed payload to your mobile app | `kbzPay().app()` |

The samples run in a controller that injects `MyanmarPaymentsService` as `this.payments`. The customer finishing on the gateway's side is never proof of payment. Fulfill orders from the verified [callback](/nestjs-myanmar-payments/callbacks) or a status check.

## Redirect Payments

Here is the flow with the KBZ Pay PWA; Wave Money works the same way with its own payment page.

<SequenceDiagram
  title="Redirect payment with the KBZ Pay PWA"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbzPay().pwa()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type PWAAPP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'Redirect to the PWA', detail: '@Redirect(): { url: payment.url }', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'Pay in the KBZ Pay app' },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbzPay().handleCallback()' },
  ]"
/>

The gateway hosts its own payment page. Send the customer there.

```ts
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';
import { Controller, Param, Post, Redirect } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly payments: MyanmarPaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Post(':id/kbz-pay')
  @Redirect()
  async kbzPay(@Param('id') id: string): Promise<{ url: string }> {
    const order = await this.orders.findOrFail(id);

    const payment = await this.payments.kbzPay().pwa({
      orderId: `ORDER_${order.id}`,
      amount: 10000,
      callbackUrl: 'https://shop.test/payments/kbz/callback',
    });

    return { url: payment.url };
  }
}
```

`payment.gatewayReference` holds the gateway's id for the attempt (KBZ `prepay_id`, Wave `transaction_id`).

## Form Payments

Here is the flow with AYA Pay; CyberSource works the same way with its hosted checkout.

<SequenceDiagram
  title="Form payment with AYA Pay"
  :participants="['Customer', 'Your app', 'AYA Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Your app', label: 'Sign and encrypt the form', detail: 'ayaPay().initiate(), autoSubmitUrl()' },
    { from: 'Your app', to: 'Customer', label: 'Redirect to autoSubmitUrl', detail: 'encrypted, expires in 30 min', response: true },
    { from: 'Customer', to: 'Your app', label: 'Open the auto-submit route', detail: 'GET myanmar-payments/form' },
    { from: 'Your app', to: 'Customer', label: 'Auto-submitting form page', detail: '410 Gone once the link expires', response: true },
    { from: 'Customer', to: 'AYA Pay', label: 'Post the signed form', detail: 'POST /v1/payment/request' },
    { from: 'AYA Pay', to: 'Customer', label: 'Back to your return URL', detail: 'not proof of payment', response: true },
    { from: 'AYA Pay', to: 'Your app', label: 'Backend callback', detail: 'payload + checkSum' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'ayaPay().handleCallback()' },
  ]"
/>

The gateway expects the customer's browser to POST a signed form. The package hosts a page that renders the form and submits it immediately, so a redirect is enough:

```ts
const payment = this.payments.ayaPay().initiate(data);

return { url: this.payments.autoSubmitUrl(payment) }; // with @Redirect()
```

`autoSubmitUrl()` returns an encrypted, expiring link to the module's form route. See [Configuration](/nestjs-myanmar-payments/configuration#auto-submit-form-route).

To render the form yourself, for example with your own loading state, return `toHtml()` or use `action`, `fields` and `enctype`:

```ts
import { Header, Param, Post } from '@nestjs/common';

@Post(':id/aya-pay')
@Header('Content-Type', 'text/html; charset=utf-8')
async ayaPay(@Param('id') id: string): Promise<string> {
  // ...
  return this.payments.ayaPay().initiate(data).toHtml();
}
```

```handlebars
<form id="payment-form" method="POST" action="{{payment.action}}"
      enctype="{{payment.enctype}}">
  {{#each payment.fields}}
    <input type="hidden" name="{{this.name}}" value="{{this.value}}">
  {{/each}}
</form>
<script>document.getElementById('payment-form').submit();</script>
```

Post the fields unchanged: they are signed. `fields` is a list in signing order; `payment.values()` returns them as an object and `payment.field(name)` reads one.

## QR Payments

Here is the flow with Yoma MMQR, whose QR expires after 120 seconds; a KBZ Pay QR follows the same steps without renewals.

<SequenceDiagram
  title="QR payment with Yoma MMQR"
  :participants="['Customer', 'Your app', 'Yoma MMQR']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Check out' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Check out the order', detail: 'yomaMmqr().initiate()' },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Generate the first QR', detail: 'qr/generate' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'QR image and refLabel', detail: 'payable for 120 seconds', response: true },
    { from: 'Your app', to: 'Customer', label: 'Show the QR', detail: 'payment.qrImageDataUri()', response: true },
    { from: 'Your app', to: 'Yoma MMQR', label: 'Expired? Renew the QR', detail: 'yomaMmqr().renewQr(orderId)' },
    { from: 'Customer', to: 'Yoma MMQR', label: 'Scan with an MMQR wallet' },
    { from: 'Yoma MMQR', to: 'Your app', label: 'Payment callback', detail: 'orderNumber, status, hashValue' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'yomaMmqr().handleCallback()' },
  ]"
/>

Gateways return QR codes in two shapes:

| Property | Gateway | Use it as |
|---|---|---|
| `qrString` | KBZ Pay | A payload: encode it into a QR image with any QR library |
| `qrImage` | Yoma MMQR | A base64 image: display it as is, e.g. with `qrImageDataUri()` |

```ts
const payment = await this.payments.yomaMmqr().initiate(data);
```

```handlebars
<img src="{{qrImageDataUri}}" alt="Scan to pay">
<p>Valid until {{expiresAt}}</p>
```

Pass `payment.qrImageDataUri()` and `payment.expiresAt` to your view. `expiresAt` is set when the gateway limits how long the QR is payable, and `reference` holds the id used for status checks (Yoma `refLabel`).

## App Payments

Here is the flow with the KBZ Pay mobile SDK.

<SequenceDiagram
  title="In-app payment with the KBZ Pay SDK"
  :participants="['Customer', 'Your app', 'KBZ Pay']"
  :steps="[
    { from: 'Customer', to: 'Your app', label: 'Pay in your mobile app' },
    { from: 'Your app', to: 'Your app', label: 'Start the payment', detail: 'kbzPay().app()' },
    { from: 'Your app', to: 'KBZ Pay', label: 'Create the order', detail: 'precreate, trade_type APP' },
    { from: 'KBZ Pay', to: 'Your app', label: 'prepay_id', response: true },
    { from: 'Your app', to: 'Customer', label: 'orderInfo, sign, signType', detail: 'return payment (JSON)', response: true },
    { from: 'Customer', to: 'KBZ Pay', label: 'KBZPay.startPay()', detail: 'the customer pays in KBZ Pay' },
    { from: 'KBZ Pay', to: 'Customer', label: 'Payment screen closed', detail: 'not proof of payment', response: true },
    { from: 'KBZ Pay', to: 'Your app', label: 'Payment notification', detail: 'POST to callbackUrl' },
    { from: 'Your app', to: 'Your app', label: 'Verified callback is proof', detail: 'kbzPay().handleCallback()' },
  ]"
/>

The KBZ Pay mobile SDK needs a signed order string. Return it to your app, which passes it to `KBZPay.startPay()`:

```ts
const payment = await this.payments.kbzPay().app(data);

// JSON: orderId, orderInfo, sign, signType
return payment;
```

Returning the `AppPayment` from a handler serializes it with `toJSON()`, which leaves out `raw`. The SDK's own result only means the payment screen closed; rely on the callback or `kbzPay().status()`.

See [Results](/nestjs-myanmar-payments/references/results) for every property.
