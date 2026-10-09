---
title: Testing
description: Test an app that uses PHP Myanmar Payments - fake the gateways' HTTP calls with a PSR-18 client or Guzzle's MockHandler, replay signed callbacks with CallbackRequest, and build PaymentCallback objects for your own code.
---

# Testing

Every gateway call goes through the PSR-18 client you pass, and callbacks are plain `CallbackRequest` objects, so apps that use the package are tested with Pest or PHPUnit and your framework's test client like any other code. Nothing below needs network access.

## Faking Gateway Calls

Pass a PSR-18 client that answers from your test. This one hands every request the gateway sends to a closure, which returns a canned response:

```php
// tests/FakeClient.php
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

final class FakeClient implements ClientInterface
{
    /** @param Closure(RequestInterface): ResponseInterface $handler */
    public function __construct(private readonly Closure $handler)
    {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        return ($this->handler)($request);
    }
}
```

```php
use GuzzleHttp\Psr7\Response;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayConfig;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPayPaymentData;
use Psr\Http\Message\RequestInterface;

function kbzConfig(): KbzPayConfig
{
    return new KbzPayConfig(
        appId: 'kp1',
        appKey: 'kbz-secret',
        merchantCode: '1',
    );
}

it('starts a KBZ Pay QR payment', function () {
    $client = new FakeClient(function (RequestInterface $request) {
        $body = json_decode((string) $request->getBody(), true);
        expect($request->getUri()->getPath())->toEndWith('/precreate')
            ->and($body['Request']['biz_content']['merch_order_id'])
            ->toBe('ORDER_1');

        return new Response(200, [], json_encode(['Response' => [
            'result' => 'SUCCESS',
            'code' => '0',
            'prepay_id' => 'PREPAY_1',
            'qrCode' => 'kbz-qr',
        ]]));
    });
    $kbz = new KbzPay(kbzConfig(), $client);

    $data = new KbzPayPaymentData(
        orderId: 'ORDER_1',
        amount: 10000,
        callbackUrl: 'https://shop.test/payments/kbz/callback',
    );
    $payment = $kbz->qr($data);

    expect($payment->qrString)->toBe('kbz-qr')
        ->and($payment->reference)->toBe('PREPAY_1');
});
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{apiUrl}/precreate`, `{apiUrl}/queryorder` |
| Wave Money | `{baseUrl}/payment` |
| AYA Pay | `{baseUrl}/v1/payment/services`, `{baseUrl}/v1/payment/enquiry` (`initiate()` is local) |
| Yoma MMQR | `{baseUrl}/token`, then `{baseUrl}/payment-gateway/{apiVersion}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/php-myanmar-payments/drivers/kbz-pay). To test failures, return an error body (e.g. `{"Response": {"result": "FAIL", "code": "ORDER_ID_USED"}}`) and assert that your code handles the `ApiException`; throw a `Psr\Http\Client\ClientExceptionInterface`, such as Guzzle's `ConnectException`, from the closure to simulate an unreachable gateway.

When your app builds gateways with `MyanmarPayments::fromEnv()`, pass a test environment and the fake client instead of touching the real environment:

```php
use Laranex\PhpMyanmarPayments\MyanmarPayments;

const TEST_ENV = [
    'KBZ_PAY_APP_ID' => 'kp1',
    'KBZ_PAY_APP_KEY' => 'kbz-secret',
    'KBZ_PAY_MERCHANT_CODE' => '1',
];

function makePayments(Closure $handler): MyanmarPayments
{
    return MyanmarPayments::fromEnv(TEST_ENV, new FakeClient($handler));
}
```

### With Guzzle

Guzzle's [`MockHandler`](https://docs.guzzlephp.org/en/stable/testing.html) answers from a queue, and its history middleware records what was sent:

```php
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;

it('reports a paid order', function () {
    $sent = [];
    $stack = HandlerStack::create(new MockHandler([
        new Response(200, [], json_encode(['Response' => [
            'result' => 'SUCCESS',
            'code' => '0',
            'merch_order_id' => 'ORDER_1',
            'trade_status' => 'PAY_SUCCESS',
            'total_amount' => '10000',
        ]])),
    ]));
    $stack->push(Middleware::history($sent));

    $kbz = new KbzPay(kbzConfig(), new Client(['handler' => $stack]));
    $result = $kbz->status('ORDER_1');

    expect($result->isSuccessful())->toBeTrue()
        ->and((string) $sent[0]['request']->getUri())
        ->toEndWith('/queryorder');
});
```

## Replaying Signed Callbacks

To run a callback through real verification, sign it with the secret from your test configuration. KBZ Pay's signer is public (`KbzPaySigner`, also available as `$kbz->signer`); `CallbackRequest::fromArray` encodes the payload as a JSON body:

```php
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPaySigner;

/** @param array<string, string> $fields */
function signedKbzCallback(array $fields): CallbackRequest
{
    $fields['sign_type'] = 'SHA256';
    $fields['sign'] = (new KbzPaySigner('kbz-secret'))->sign($fields);

    return CallbackRequest::fromArray(['Request' => $fields]);
}

it('verifies a KBZ Pay callback', function () {
    $request = signedKbzCallback([
        'merch_order_id' => 'ORDER_1',
        'mm_order_id' => 'MM_1',
        'total_amount' => '10000',
        'trade_status' => 'PAY_SUCCESS',
    ]);

    $callback = (new KbzPay(kbzConfig()))->handleCallback($request);

    expect($callback->status)->toBe(PaymentStatus::Successful)
        ->and($callback->acknowledgement->body)->toBe('success');
});
```

A modified payload must be rejected: change `total_amount` after signing and `handleCallback()` throws `SignatureVerificationException`. To exercise your real callback route, post the same JSON with your framework's test client, e.g. Symfony's `$client->request('POST', '/payments/kbz/callback', server: ['CONTENT_TYPE' => 'application/json'], content: $body)` or Slim's `$app->handle()` with a PSR-7 server request carrying the body.

The other gateways sign with HMAC-SHA256 over documented fields, as described on their [gateway pages](/php-myanmar-payments/drivers/wave-money). To replay a call you stored, rebuild it from the stored raw body and headers: `new CallbackRequest($storedBody, $storedHeaders)`.

## Testing Your Own Logic

To test fulfillment code without signatures, build the callback yourself:

```php
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;
use Laranex\PhpMyanmarPayments\Results\PaymentCallback;

it('fulfills a paid order', function () {
    $callback = new PaymentCallback(
        orderId: 'ORDER_1',
        status: PaymentStatus::Successful,
        gatewayStatus: 'PAY_SUCCESS',
        amount: '10000',
    );

    fulfill($callback);
});
```

`PaymentStatusResult`, `RedirectPayment`, `FormPayment`, `QrPayment` and `AppPayment` take their properties as named arguments the same way, so you can return them from a mocked gateway (`$this->createMock(KbzPay::class)` in PHPUnit, or Mockery) when a test only covers your own controllers.
