---
title: Testing
description: Fake gateway calls with Http::fake(), send signed callbacks to your routes, mock the facade and follow auto-submit form links in your Laravel tests.
---

# Testing

## Faking Gateway Calls

Every gateway call goes through Laravel's `Http` client, so `Http::fake()` intercepts it and `Http::assertSent()` sees it. Call `Http::preventStrayRequests()` so nothing reaches a real gateway:

```php
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('starts a KBZ Pay QR payment', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/precreate' => Http::response(['Response' => [
            'result' => 'SUCCESS',
            'code' => '0',
            'prepay_id' => 'PREPAY1',
            'qrCode' => 'kbz-qr',
        ]]),
    ]);

    $this->post('/checkout/kbz-qr')->assertOk()->assertSee('kbz-qr');

    Http::assertSent(function (Request $request) {
        $biz = $request['Request']['biz_content'];

        return $biz['merch_order_id'] === 'ORDER_1';
    });
});
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{api_url}/precreate`, `{api_url}/queryorder` |
| Wave Money | `{base_url}/payment` |
| AYA Pay | `{base_url}/v1/payment/services`, `{base_url}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{base_url}/token`, then `{base_url}/payment-gateway/{api_version}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/laravel-myanmar-payments/drivers/kbz-pay). Gateways are configured on first use, so set every required setting of the gateways under test in `phpunit.xml` or with `config()->set('myanmar-payments.kbz_pay', [...])` before the first call:

```xml
<php>
    <env name="MYANMAR_PAYMENTS_HTTP_TIMEOUT" value="5"/>
    <env name="MYANMAR_PAYMENTS_FORM_TTL_MINUTES" value="30"/>
    <env name="KBZ_PAY_APP_ID" value="kp1"/>
    <env name="KBZ_PAY_APP_KEY" value="test-app-key"/>
    <env name="KBZ_PAY_MERCHANT_CODE" value="1"/>
</php>
```

Yoma access tokens are kept in your cache store; the `array` store that tests usually run on starts empty in every test.

## Sending Signed Callbacks

To exercise your real callback route, post a payload signed with the secret from your test configuration. KBZ Pay signs every non-empty field except `sign` and `sign_type`, sorted by key, with `&key=<app key>` appended; the SDK's `KbzPaySigner` does exactly that:

```php
use Laranex\PhpMyanmarPayments\KbzPay\KbzPaySigner;

it('marks the order paid from a KBZ Pay callback', function () {
    config()->set('myanmar-payments.kbz_pay.app_key', 'test-app-key');

    $fields = [
        'merch_order_id' => 'ORDER_1',
        'mm_order_id' => 'MM1',
        'total_amount' => '10000',
        'trade_status' => 'PAY_SUCCESS',
        'nonce_str' => 'n',
        'sign_type' => 'SHA256',
    ];
    $fields['sign'] = (new KbzPaySigner('test-app-key'))->sign($fields);

    $this->postJson('/payments/kbz/callback', ['Request' => $fields])
        ->assertOk()
        ->assertContent('success');
});
```

The other gateways sign with HMAC-SHA256 as described on their gateway pages. A modified payload must be rejected: `handleCallback()` throws `SignatureVerificationException`.

## Mocking the Gateways

To test only your own handling, without signed payloads, mock the facade and return a `PaymentCallback` you build yourself:

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;
use Laranex\PhpMyanmarPayments\Results\PaymentCallback;

$callback = new PaymentCallback(
    orderId: 'ORDER_1',
    status: PaymentStatus::Successful,
    gatewayStatus: 'PAY_SUCCESS',
    amount: '10000',
);

MyanmarPayments::shouldReceive('kbzPay->handleCallback')
    ->andReturn($callback);
```

## Following Form Links

`autoSubmitUrl` points at the package's form route, so a test can follow it:

```php
$payment = MyanmarPayments::ayaPay()->initiate($data);

$this->get($payment->autoSubmitUrl)
    ->assertOk()
    ->assertSee(
        'action="https://pgw.ayainnovation.com/v1/payment/request"',
        false,
    );
```

A tampered link, or one older than `form_route.ttl_minutes` (with `ttl_minutes` set to 30, try `$this->travel(31)->minutes()`), answers `410 Gone`.
