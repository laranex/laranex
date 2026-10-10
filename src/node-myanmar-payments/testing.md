---
title: Testing
description: Test an app that uses Node Myanmar Payments - fake the gateways' HTTP calls with a fake fetch or undici's MockAgent, replay signed callbacks with CallbackRequest, and build PaymentCallback objects for your own code.
---

# Testing

Every gateway call goes through `fetch` (or the `HttpClient` you pass), and callbacks are plain `CallbackRequest` objects, so apps that use the package are tested with `node:test`, Vitest or Jest and your framework's test client like any other code. Nothing below needs network access.

## Faking Gateway Calls

Pass a fake `fetch` in the gateway options. It receives every request the gateway sends and returns a canned `Response`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const config = new KbzPayConfig({
  appId: 'kp1',
  appKey: 'kbz-secret',
  merchantCode: '1',
  timeoutSeconds: 5,
});

async function precreate(url: string, init: RequestInit): Promise<Response> {
  const biz = JSON.parse(String(init.body)).Request.biz_content;
  assert.ok(url.endsWith('/precreate'));
  assert.equal(biz.merch_order_id, 'ORDER_1');
  return Response.json({
    Response: {
      result: 'SUCCESS',
      code: '0',
      prepay_id: 'PREPAY_1',
      qrCode: 'kbz-qr',
    },
  });
}

test('starts a KBZ Pay QR payment', async () => {
  const kbz = new KbzPay(config, { fetch: precreate });

  const payment = await kbz.qr({
    orderId: 'ORDER_1',
    amount: 10000,
    callbackUrl: 'https://shop.test/payments/kbz/callback',
  });

  assert.equal(payment.qrString, 'kbz-qr');
  assert.equal(payment.reference, 'PREPAY_1');
});
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{apiUrl}/precreate`, `{apiUrl}/queryorder` |
| Wave Money | `{baseUrl}/payment` |
| AYA Pay | `{baseUrl}/v1/payment/services`, `{baseUrl}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{baseUrl}/token`, then `{baseUrl}/payment-gateway/{apiVersion}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/node-myanmar-payments/drivers/kbz-pay). To test failures, return an error body (e.g. `{"Response": {"result": "FAIL", "code": "ORDER_ID_USED"}}`) and assert that your code handles the `ApiError`; throw `new TypeError('fetch failed')` from the fake to simulate an unreachable gateway. To replace the transport entirely, pass an `httpClient` instead (see [HTTP Client](/node-myanmar-payments/configuration#http-client)).

When your app builds gateways with `MyanmarPayments.fromEnv()`, pass a test environment and the fake `fetch` instead of touching `process.env`:

```ts
import {
  MyanmarPayments,
  type FetchFunction,
} from '@laranex/myanmar-payments';

const testEnv = {
  KBZ_PAY_APP_ID: 'kp1',
  KBZ_PAY_APP_KEY: 'kbz-secret',
  KBZ_PAY_MERCHANT_CODE: '1',
  MYANMAR_PAYMENTS_HTTP_TIMEOUT: '5',
};

export function makePayments(fetch: FetchFunction): MyanmarPayments {
  return MyanmarPayments.fromEnv(testEnv, { fetch });
}
```

### With undici's MockAgent

[undici](https://undici.nodejs.org/)'s `MockAgent` intercepts Node's global `fetch`, so the gateways need no `fetch` option:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { KbzPay, KbzPayConfig } from '@laranex/myanmar-payments';

const config = new KbzPayConfig({
  appId: 'kp1',
  appKey: 'kbz-secret',
  merchantCode: '1',
  timeoutSeconds: 5,
});

test('reports a paid order', async () => {
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);

  agent
    .get('https://api.kbzpay.com')
    .intercept({ path: '/payment/gateway/queryorder', method: 'POST' })
    .reply(200, {
      Response: {
        result: 'SUCCESS',
        code: '0',
        merch_order_id: 'ORDER_1',
        trade_status: 'PAY_SUCCESS',
        total_amount: '10000',
      },
    });

  const result = await new KbzPay(config).status('ORDER_1');

  assert.ok(result.isSuccessful());
});
```

## Replaying Signed Callbacks

To run a callback through real verification, sign it with the secret from your test configuration. KBZ Pay's signer is public (`KbzPaySigner`); `CallbackRequest.fromJson` encodes the payload as a JSON body:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CallbackRequest,
  KbzPay,
  KbzPayConfig,
  KbzPaySigner,
  PaymentStatus,
} from '@laranex/myanmar-payments';

const config = new KbzPayConfig({
  appId: 'kp1',
  appKey: 'kbz-secret',
  merchantCode: '1',
  timeoutSeconds: 5,
});

function signedKbzCallback(
  fields: Record<string, string>,
): CallbackRequest {
  const signed = { ...fields, sign_type: 'SHA256' };
  const sign = new KbzPaySigner('kbz-secret').sign(signed);
  return CallbackRequest.fromJson({ Request: { ...signed, sign } });
}

test('verifies a KBZ Pay callback', () => {
  const request = signedKbzCallback({
    merch_order_id: 'ORDER_1',
    mm_order_id: 'MM_1',
    total_amount: '10000',
    trade_status: 'PAY_SUCCESS',
  });

  const callback = new KbzPay(config).handleCallback(request);

  assert.equal(callback.status, PaymentStatus.Successful);
  assert.equal(callback.acknowledgement.body, 'success');
});
```

A modified payload must be rejected: change `total_amount` after signing and `handleCallback()` throws `SignatureVerificationError`. To exercise your real callback route, post the same JSON with your framework's test client, e.g. supertest's `request(app).post('/payments/kbz/callback').type('json').send(body)` for Express, Fastify's `app.inject({ method: 'POST', url: '/payments/kbz/callback', payload: body })` or Hono's `app.request('/payments/kbz/callback', { method: 'POST', body })`.

The other gateways sign with HMAC-SHA256 over documented fields, as described on their [gateway pages](/node-myanmar-payments/drivers/wave-money). To replay a call you stored, rebuild it from the stored raw body and headers: `CallbackRequest.from({ body: storedBody, headers: storedHeaders })`.

## Testing Your Own Logic

To test fulfillment code without signatures, build the callback yourself:

```ts
import { test } from 'node:test';
import { PaymentCallback, PaymentStatus } from '@laranex/myanmar-payments';

import { fulfill } from './payments.js';

test('fulfills a paid order', async () => {
  const callback = new PaymentCallback({
    orderId: 'ORDER_1',
    status: PaymentStatus.Successful,
    gatewayStatus: 'PAY_SUCCESS',
    amount: '10000',
  });

  await fulfill(callback);
});
```

`PaymentStatusResult`, `RedirectPayment`, `FormPayment`, `QrPayment` and `AppPayment` take their fields as an object the same way, so you can return them from a mocked gateway (e.g. `mock.method(kbz, 'pwa', async () => new RedirectPayment({ ... }))` with `node:test`, or `vi.spyOn` in Vitest) when a test only covers your own routes.
