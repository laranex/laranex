---
title: Testing
description: Fake gateway calls with Http::fake(), send signed callbacks to your routes, mock the facade and follow auto-submit form links in your Laravel tests.
---

# Testing

## Faking gateway calls

Every gateway call goes through Laravel's `Http` client, so `Http::fake()` intercepts it and `Http::assertSent()` sees it. Call `Http::preventStrayRequests()` so nothing reaches a real gateway:

```php
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('starts a KBZ Pay QR payment', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/precreate' => Http::response(['Response' => ['result' => 'SUCCESS', 'code' => '0', 'prepay_id' => 'PREPAY1', 'qrCode' => 'kbz-qr']]),
    ]);

    $this->post('/checkout/kbz-qr')->assertOk()->assertSee('kbz-qr');

    Http::assertSent(fn (Request $request) => $request['Request']['biz_content']['merch_order_id'] === 'ORDER_1');
});
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{api_url}/precreate`, `{api_url}/queryorder` |
| Wave Money | `{base_url}/payment` |
| AYA Pay | `{base_url}/v1/payment/services`, `{base_url}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{base_url}/token`, then `{base_url}/payment-gateway/{api_version}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/laravel-myanmar-payments/drivers/kbz-pay). Gateways are configured on first use, so set test credentials in `phpunit.xml` or `config()->set('myanmar-payments.kbz_pay', [...])` before the first call. Yoma access tokens are kept in your cache store; the `array` store that tests usually run on starts empty in every test.

## Sending signed callbacks

To exercise your real callback route, post a payload signed with the secret from your test configuration. KBZ Pay signs every non-empty field except `sign` and `sign_type`, sorted by key, with `&key=<app key>` appended:

```php
it('marks the order paid from a KBZ Pay callback', function () {
    config()->set('myanmar-payments.kbz_pay.app_key', 'test-app-key');

    $fields = ['merch_order_id' => 'ORDER_1', 'mm_order_id' => 'MM1', 'total_amount' => '1000', 'trade_status' => 'PAY_SUCCESS', 'nonce_str' => 'n'];
    ksort($fields);
    $fields['sign_type'] = 'SHA256';
    $fields['sign'] = strtoupper(hash('sha256', urldecode(http_build_query(array_diff_key($fields, ['sign_type' => 1]))).'&key=test-app-key'));

    $this->postJson('/payments/kbz/callback', ['Request' => $fields])
        ->assertOk()
        ->assertContent('success');
});
```

The other gateways sign with HMAC-SHA256 as described on their gateway pages. A modified payload must be rejected: `handleCallback()` throws `SignatureVerificationException`.

## Mocking the facade

To test only your own handling, without signed payloads, mock the facade and return a `PaymentCallback` you build yourself:

```php
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;
use Laranex\PhpMyanmarPayments\Results\PaymentCallback;

MyanmarPayments::shouldReceive('kbzPay->handleCallback')->andReturn(new PaymentCallback(
    orderId: 'ORDER_1',
    status: PaymentStatus::Successful,
    gatewayStatus: 'PAY_SUCCESS',
    amount: '1000',
));
```

## Following form links

`autoSubmitUrl` points at the package's form route, so a test can follow it:

```php
$payment = MyanmarPayments::ayaPay()->initiate($data);

$this->get($payment->autoSubmitUrl)
    ->assertOk()
    ->assertSee('action="https://uat-pgw.ayainnovation.com/v1/payment/request"', false);
```

A tampered link, or one older than `form_route.ttl_minutes` (try `$this->travel(31)->minutes()`), answers `410 Gone`.
