---
title: Testing
description: Test a NestJS app that uses NestJS Myanmar Payments - fake the gateways' HTTP calls with the fetch option, post signed callbacks with supertest on Express or Fastify, and build PaymentCallback objects for your own code.
---

# Testing

The package makes no network call you can't replace, and callbacks are plain HTTP requests, so apps that use it are tested with `@nestjs/testing` and supertest like any other Nest app.

## Fake the Gateways

Pass a fake `fetch` (or an SDK `HttpClient`) in the module options. Every gateway call goes through it:

```ts
import { Test } from '@nestjs/testing';
import { MyanmarPaymentsModule } from '@laranex/nestjs-myanmar-payments';

const fetch = async (url: string | URL | Request): Promise<Response> =>
  new Response(
    JSON.stringify({ Response: { result: 'SUCCESS', code: '0', prepay_id: 'PREPAY123' } }),
    { headers: { 'Content-Type': 'application/json' } },
  );

const moduleRef = await Test.createTestingModule({
  imports: [
    MyanmarPaymentsModule.forRoot({
      env: { KBZ_PAY_APP_ID: 'kp123', KBZ_PAY_APP_KEY: 'kbz-secret', KBZ_PAY_MERCHANT_CODE: '100001' },
      fetch,
    }),
  ],
  controllers: [CheckoutController],
}).compile();
```

Passing `env` as a record keeps the test independent of the machine's environment. When your app registers the module with `forRootAsync()`, override the options instead:

```ts
Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MYANMAR_PAYMENTS_OPTIONS)
  .useValue({ env: testEnv, fetch });
```

The responses each gateway returns are listed in the SDK's [driver pages](/node-myanmar-payments/drivers/kbz-pay).

## Post Signed Callbacks

Create the test app with `rawBody: true`, like `main.ts`, and sign the callback with the SDK so it passes verification:

```ts
import { KbzPaySigner } from '@laranex/myanmar-payments';
import request from 'supertest';

const app = moduleRef.createNestApplication({ rawBody: true });
await app.init();

const fields: Record<string, string> = {
  merch_order_id: 'ORDER_1',
  mm_order_id: 'MM1',
  total_amount: '1000.00',
  trade_status: 'PAY_SUCCESS',
  sign_type: 'SHA256',
};
fields.sign = new KbzPaySigner('kbz-secret').sign(fields);

await request(app.getHttpServer())
  .post('/payments/callback/kbz-pay')
  .set('Content-Type', 'application/json')
  .send(JSON.stringify({ Request: fields }))
  .expect(200, 'success');
```

On Fastify, pass `new FastifyAdapter()` to `createNestApplication()` and wait for `app.getHttpAdapter().getInstance().ready()` after `init()`. A tampered body (change `total_amount` after signing) answers 400 from `@VerifiedCallback()`. The other gateways' signatures are HMAC-SHA256 over documented fields; see each [driver page](/node-myanmar-payments/drivers/wave-money) and [Callbacks & Status](/node-myanmar-payments/callbacks).

## Test Your Own Logic

To test fulfillment code without signatures, build the callback yourself:

```ts
import { PaymentCallback } from '@laranex/myanmar-payments';

const callback = new PaymentCallback({
  orderId: 'ORDER_1',
  status: 'successful',
  gatewayStatus: 'PAY_SUCCESS',
  amount: '1000.00',
});
await orders.fulfill(callback);
```

To replay a stored call through real verification, rebuild the request with `CallbackRequest.from({ body, headers, query })` and pass it to `MyanmarPaymentsService.handleCallback(gateway, request)`.

## Form Links

`autoSubmitUrl()` needs a secret: put `MYANMAR_PAYMENTS_FORM_KEY` in the test `env` (or `formLink: { secret }`), then request the returned path with supertest to get the auto-submitting page.
