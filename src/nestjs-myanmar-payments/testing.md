---
title: Testing
description: Fake gateway calls with the fetch option, send signed callbacks to your routes with supertest, mock MyanmarPaymentsService and follow auto-submit form links in your NestJS tests.
---

# Testing

## Faking Gateway Calls

Every gateway call goes through the `fetch` in the module options, so a fake one intercepts it and records it. Throw for anything unexpected so nothing reaches a real gateway:

```ts
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CheckoutController } from '../src/checkout/checkout.controller';

it('starts a KBZ Pay QR payment', async () => {
  const sent: { url: string; body: any }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    if (url.endsWith('/precreate')) {
      return Response.json({
        Response: {
          result: 'SUCCESS',
          code: '0',
          prepay_id: 'PREPAY1',
          qrCode: 'kbz-qr',
        },
      });
    }
    throw new Error(`Unexpected request to ${url}`);
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      MyanmarPaymentsModule.forRoot({
        env: {
          MYANMAR_PAYMENTS_HTTP_TIMEOUT: '5',
          KBZ_PAY_APP_ID: 'test-app-id',
          KBZ_PAY_APP_KEY: 'test-app-key',
          KBZ_PAY_MERCHANT_CODE: '100001',
        },
        fetch,
      }),
    ],
    controllers: [CheckoutController],
  }).compile();
  const app = await moduleRef.createNestApplication().init();

  await request(app.getHttpServer())
    .post('/checkout/1/kbz-qr')
    .expect(201)
    .expect(/kbz-qr/);

  const biz = sent[0].body.Request.biz_content;
  expect(biz.merch_order_id).toBe('ORDER_1');
});
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{apiUrl}/precreate`, `{apiUrl}/queryorder` |
| Wave Money | `{baseUrl}/payment` |
| AYA Pay | `{baseUrl}/v1/payment/services`, `{baseUrl}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{baseUrl}/token`, then `{baseUrl}/payment-gateway/{apiVersion}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/nestjs-myanmar-payments/drivers/kbz-pay). Gateways are configured on first use, so pass every required setting of the gateways under test in `env` (a record keeps the test independent of the machine's environment). When your app registers the module with `forRootAsync()`, override the options instead: `.overrideProvider(MYANMAR_PAYMENTS_OPTIONS).useValue({ env: testEnv, fetch })`. Yoma access tokens are kept in the token cache; the in-memory cache starts empty in every testing module.

## Sending Signed Callbacks

To exercise your real callback route, post a payload signed with the secret from your test configuration. Create the test app with `rawBody: true`, like `main.ts`. KBZ Pay signs every non-empty field except `sign` and `sign_type`, sorted by key, with `&key=<app key>` appended; the SDK's `KbzPaySigner` does exactly that:

```ts
import { KbzPaySigner } from '@laranex/myanmar-payments';
import request from 'supertest';

it('marks the order paid from a KBZ Pay callback', async () => {
  const app = moduleRef.createNestApplication({ rawBody: true });
  await app.init();

  const fields: Record<string, string> = {
    merch_order_id: 'ORDER_1',
    mm_order_id: 'MM1',
    total_amount: '10000',
    trade_status: 'PAY_SUCCESS',
    nonce_str: 'n',
    sign_type: 'SHA256',
  };
  fields.sign = new KbzPaySigner('test-app-key').sign(fields);

  await request(app.getHttpServer())
    .post('/payments/kbz/callback')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ Request: fields }))
    .expect(200, 'success');
});
```

The other gateways sign with HMAC-SHA256 as described on their gateway pages. A modified payload must be rejected: `@VerifiedCallback()` answers `400`, and `handleCallback()` throws `SignatureVerificationError`. On Fastify, pass `new FastifyAdapter()` to `createNestApplication()` and wait for `app.getHttpAdapter().getInstance().ready()` after `init()`.

## Mocking the Gateways

To test only your own handling, without signed payloads, override `MyanmarPaymentsService` and return a `PaymentCallback` you build yourself:

```ts
import { PaymentCallback, PaymentStatus } from '@laranex/myanmar-payments';
import { MyanmarPaymentsService } from '@laranex/nestjs-myanmar-payments';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';

const callback = new PaymentCallback({
  orderId: 'ORDER_1',
  status: PaymentStatus.Successful,
  gatewayStatus: 'PAY_SUCCESS',
  amount: '10000',
});

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MyanmarPaymentsService)
  .useValue({ handleCallback: async () => callback })
  .compile();
```

Code that takes the callback as an argument can be called with it directly, e.g. `await orders.fulfill(callback)`.

## Following Form Links

`autoSubmitUrl()` points at the module's form route, so a test can follow it. It needs a secret and a lifetime: put `MYANMAR_PAYMENTS_FORM_KEY` and `MYANMAR_PAYMENTS_FORM_TTL_MINUTES` in the test `env` (or `formLink: { secret, ttlMinutes }`).

```ts
const payment = payments.ayaPay().initiate(data);
const url = new URL(payments.autoSubmitUrl(payment), 'http://localhost');

const response = await request(app.getHttpServer())
  .get(url.pathname + url.search)
  .expect(200);

expect(response.text).toContain(
  'action="https://pgw.ayainnovation.com/v1/payment/request"',
);
```

A tampered link, or one older than `formLink.ttlMinutes` (with `ttlMinutes` set to 30, try `vi.useFakeTimers()` and `vi.advanceTimersByTime(31 * 60_000)`), answers `410 Gone`.
