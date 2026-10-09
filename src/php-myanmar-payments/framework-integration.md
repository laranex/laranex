---
title: Framework Integration
description: Use PHP Myanmar Payments with Symfony, any PSR-7/PSR-15 framework, or Laravel. Bring your own PSR-18 client and PSR-16 cache.
---

# Framework Integration

The package only needs three things from your framework: the raw incoming request for callbacks, a PSR-18 HTTP client and, for Yoma MMQR, a PSR-16 cache.

## Laravel

Use [`laranex/laravel-myanmar-payments`](/laravel-myanmar-payments/introduction). It configures every gateway from `.env`, accepts the Laravel `Request` in callbacks, routes HTTP through Laravel's `Http` client (so `Http::fake()` works) and keeps Yoma tokens in your cache store.

## Symfony

Symfony HttpClient provides a PSR-18 client through `Psr18Client` (it needs a PSR-17 implementation such as `nyholm/psr7`), and Symfony Cache provides PSR-16 through `Psr16Cache`:

```php
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqr;
use Laranex\PhpMyanmarPayments\YomaMmqr\YomaMmqrConfig;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Cache\Psr16Cache;
use Symfony\Component\HttpClient\Psr18Client;

$yomaMmqr = new YomaMmqr(
    YomaMmqrConfig::fromArray($yomaSettings),
    new Psr18Client(),
    new Psr16Cache(new FilesystemAdapter('myanmar-payments')),
);
```

Build the `CallbackRequest` from the HttpFoundation request in your controller:

```php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

public function kbzCallback(Request $request): Response
{
    $callback = $this->kbzPay->handleCallback(new CallbackRequest(
        body: $request->getContent(),
        headers: array_map(
            fn (array $values): string => implode(', ', $values),
            $request->headers->all(),
        ),
        query: $request->query->all(),
    ));

    // fulfill the order ...

    $ack = $callback->acknowledgement();

    return new Response($ack->body, $ack->status, $ack->headers);
}
```

## PSR-7 / PSR-15

Any framework built on PSR-7 (Slim, Mezzio, …) can pass its server request straight in:

```php
use Laranex\PhpMyanmarPayments\Http\CallbackRequest;
use Laranex\PhpMyanmarPayments\KbzPay\KbzPay;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class KbzCallbackHandler implements RequestHandlerInterface
{
    public function __construct(
        private KbzPay $kbzPay,
        private ResponseFactoryInterface $responses,
    ) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $callback = $this->kbzPay->handleCallback(
            CallbackRequest::fromPsr7($request),
        );

        // fulfill the order ...

        $ack = $callback->acknowledgement();
        $response = $this->responses->createResponse($ack->status);
        $response->getBody()->write($ack->body);

        foreach ($ack->headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response;
    }
}
```
