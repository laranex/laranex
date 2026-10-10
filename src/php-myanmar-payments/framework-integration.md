---
title: Framework Integration
description: Use PHP Myanmar Payments with Symfony, Slim and any PSR-7 / PSR-15 framework, or Laravel. Create gateways once, build the CallbackRequest from the raw body, and return the acknowledgement.
---

# Framework Integration

The package needs only two things from your framework: the raw incoming request for callbacks and a way to write the acknowledgement. Create each gateway once (or one `MyanmarPayments`), e.g. as a service in your container, and share it across requests. Pass a shared [PSR-16 cache](/php-myanmar-payments/configuration#token-cache) so Yoma's token survives between requests.

| Framework | Build the request | Acknowledge |
|---|---|---|
| Plain PHP | `CallbackRequest::fromGlobals()` | `$ack->send()` |
| Symfony | `new CallbackRequest(body: $request->getContent(), headers: ..., query: $request->query->all())` | `new Response($ack->body, $ack->status, $ack->headers)` |
| Slim, Mezzio, any PSR-15 | `CallbackRequest::fromPsr7($request)` | `$responseFactory->createResponse($ack->status)`, then the body and headers |

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your framework applies.

## Laravel

Use [`laranex/laravel-myanmar-payments`](/laravel-myanmar-payments/introduction). It configures every gateway from `.env`, accepts the Laravel `Request` in callbacks, routes HTTP through Laravel's `Http` client (so `Http::fake()` works) and keeps Yoma tokens in your cache store.

## Symfony

Register the facade as a service, with Symfony HttpClient as the PSR-18 client (`Psr18Client` needs a PSR-17 implementation such as `nyholm/psr7`) and Symfony Cache as the PSR-16 cache:

```yaml
# config/services.yaml
services:
    Laranex\PhpMyanmarPayments\MyanmarPayments:
        arguments:
            $config:
                kbz_pay:
                    app_id: '%env(KBZ_PAY_APP_ID)%'
                    app_key: '%env(KBZ_PAY_APP_KEY)%'
                    merchant_code: '%env(KBZ_PAY_MERCHANT_CODE)%'
                    timeout_in_seconds: '%env(MYANMAR_PAYMENTS_HTTP_TIMEOUT)%'
                aya_pay:
                    app_key: '%env(AYA_PAY_APP_KEY)%'
                    app_secret: '%env(AYA_PAY_APP_SECRET)%'
                    timeout_in_seconds: '%env(MYANMAR_PAYMENTS_HTTP_TIMEOUT)%'
            $httpClient: '@Symfony\Component\HttpClient\Psr18Client'
            $cache: '@app.payments_cache'

    Symfony\Component\HttpClient\Psr18Client: ~

    app.payments_cache:
        class: Symfony\Component\Cache\Psr16Cache
        arguments: ['@cache.app']
```

```php
// src/Controller/PaymentController.php
namespace App\Controller;

use Laranex\PhpMyanmarPayments\AyaPay\AyaPayMethod;
use Laranex\PhpMyanmarPayments\AyaPay\AyaPayPaymentData;
use Laranex\PhpMyanmarPayments\Exceptions\ApiException;
use Laranex\PhpMyanmarPayments\Exceptions\InvalidPaymentDataException;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\MyanmarPayments;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class PaymentController
{
    public function __construct(private readonly MyanmarPayments $payments)
    {
    }

    #[Route('/checkout/{orderId}', methods: ['GET'])]
    public function checkout(int $orderId): Response
    {
        try {
            $data = new AyaPayPaymentData(
                orderId: 'ORDER_'.$orderId,
                amount: 10000,
                channel: 'aya_pay',
                method: AyaPayMethod::Qr,
                returnUrl: 'https://shop.test/payments/aya/return',
            );
        } catch (InvalidPaymentDataException $e) {
            return new JsonResponse(['errors' => $e->errors()], 422);
        }

        // no network call: it only signs
        $payment = $this->payments->ayaPay()->initiate($data);

        return new Response($payment->toHtml());
    }

    #[Route('/payments/kbz/callback', methods: ['POST'])]
    public function kbzCallback(Request $request): Response
    {
        try {
            $callback = $this->payments->kbzPay()
                ->handleCallback($this->callbackRequest($request));
        } catch (SignatureVerificationException) {
            return new Response('invalid signature', 400);
        }
        // fulfill $callback->orderId when $callback->isSuccessful()
        // and the amount matches
        $ack = $callback->acknowledgement;

        return new Response($ack->body, $ack->status, $ack->headers);
    }

    #[Route('/payments/aya/return', methods: ['GET'])]
    public function ayaReturn(Request $request): Response
    {
        try {
            $result = $this->payments->ayaPay()
                ->verifyRedirect($this->callbackRequest($request));
        } catch (SignatureVerificationException) {
            return new Response('invalid return', 400);
        }

        return new Response($result->isSuccessful()
            ? 'Thank you, your payment was received.'
            : "Payment {$result->status->value}.");
    }

    #[Route('/payments/kbz/status/{orderId}', methods: ['GET'])]
    public function kbzStatus(int $orderId): Response
    {
        try {
            $result = $this->payments->kbzPay()->status('ORDER_'.$orderId);
        } catch (ApiException $e) {
            return new JsonResponse([
                'code' => $e->gatewayCode,
                'message' => $e->gatewayMessage,
            ], 502);
        }

        return new JsonResponse(['status' => $result->status->value]);
    }

    private function callbackRequest(Request $request): CallbackRequest
    {
        return new CallbackRequest(
            body: $request->getContent(),
            headers: array_map(
                fn (array $values): string => implode(', ', $values),
                $request->headers->all(),
            ),
            query: $request->query->all(),
        );
    }
}
```

`$request->getContent()` returns the raw body even after Symfony parsed a form into `$request->request`; never rebuild the request from `$request->request->all()` or `$request->toArray()`.

## PSR-7 / PSR-15

Any framework built on PSR-7 (Slim, Mezzio, …) passes its server request straight in. With Slim:

```php
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\MyanmarPayments;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrPaymentData;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

$payments = MyanmarPayments::fromEnv();
$app = AppFactory::create();

$app->post(
    '/payments/yoma/callback',
    function (Request $request, Response $response) use ($payments) {
        try {
            $callback = $payments->yomaMmqr()
                ->handleCallback(CallbackRequest::fromPsr7($request));
        } catch (SignatureVerificationException) {
            $response->getBody()->write('invalid signature');

            return $response->withStatus(400);
        }
        $ack = $callback->acknowledgement;
        $response->getBody()->write($ack->body);
        foreach ($ack->headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response->withStatus($ack->status);
    },
);

$app->get(
    '/payments/yoma/{orderId}',
    function (Request $request, Response $response, array $args)
        use ($payments) {
        $data = new YomaMmqrPaymentData(
            orderId: 'ORDER_'.$args['orderId'],
            amount: 10000,
            description: 'Order #'.$args['orderId'],
        );
        $payment = $payments->yomaMmqr()->initiate($data);
        $src = htmlspecialchars((string) $payment->qrImageDataUri());
        $response->getBody()->write("<img src=\"{$src}\" alt=\"Scan to pay\">");

        return $response;
    },
);

$app->run();
```

`fromPsr7()` reads the raw body stream, so Slim's `BodyParsingMiddleware` can stay; never build the request from `getParsedBody()`.

## Other Frameworks

For any other framework, build the request from its parts with `new CallbackRequest(body: ..., headers: ..., query: ...)` (the raw body as a `string`, the headers as name => value, the query parameters as an array), then write `$ack->status`, `$ack->headers` and `$ack->body` with your framework's response API.

## Testing Your App

See [Testing](/php-myanmar-payments/testing) to replace the gateways' HTTP calls with a fake PSR-18 client or Guzzle's `MockHandler`, replay signed callbacks and build `PaymentCallback` objects for your own code.
