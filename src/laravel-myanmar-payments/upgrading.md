---
title: Upgrading
description: Upgrade Laravel Myanmar Payments from v2.2.7 to v4.0.0. New facade and config file, typed accessors, typed request and result classes, Request-based callbacks and a mapped PaymentStatus.
---

# Upgrading

## From v2.2.7 to v4.0.0

v4 is a rewrite on top of [`laranex/php-myanmar-payments`](/php-myanmar-payments/introduction). The rewrite was developed as v3, but v3 was never released: upgrade straight from v2.2.7 to v4.0.0. Every gateway now takes a typed request object and returns a typed result, and every exception extends `PaymentException`.

### Requirements

PHP 8.1+ and Laravel 10 to 13. The package now requires `guzzlehttp/guzzle` ^7.4 or ^8.

```bash
composer require laranex/laravel-myanmar-payments:^4.0
```

### Facade and service provider

| v2.2.7 | v4.0.0 |
|---|---|
| `Laranex\LaravelMyanmarPayments\LaravelMyanmarPaymentsFacade` | `Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments` |
| Alias `LaravelMyanmarPayments` | Alias `MyanmarPayments` |
| `LaravelMyanmarPaymentsServiceProvider` | `MyanmarPaymentsServiceProvider` |
| `channel('...')` | Typed accessors: `kbzPay()`, `waveMoney()`, `ayaPay()`, `yomaMmqr()`, `cyberSource()` |

Both are auto-discovered. If you registered the old provider or alias by hand, replace them.

### Starting payments

String channels and positional arguments are replaced with typed accessors and one request class per gateway, in `Laranex\PhpMyanmarPayments\<Gateway>\<Gateway>PaymentData`.

| v2.2.7 | v4.0.0 |
|---|---|
| `channel('kbz_pay.pwaapp')->getPaymentScreenUrl($orderId, $amount, $nonceStr, $backendResultUrl)` | `kbzPay()->pwa(new KbzPayPaymentData(...))` → `RedirectPayment` |
| `channel('kbz_pay.qr')->getPaymentQr(...)` | `kbzPay()->qr($data)` → `QrPayment` (`qrString`) |
| `channel('kbz_pay.app')->getPaymentData(...)` | `kbzPay()->app($data)` → `AppPayment` (`toArray()`) |
| `channel('kbz_pay.*')->queryOrder($orderId, $nonceStr)` | `kbzPay()->status($orderId)` → `PaymentStatusResult` |
| `channel('wave_money')->getPaymentScreenUrl($items, $orderId, $amount, $merchantReferenceId, $backendResultUrl, ...)` | `waveMoney()->initiate(new WaveMoneyPaymentData(...))` → `RedirectPayment` |
| `channel('aya_pgw')->getPaymentServices()` | `ayaPay()->services()` → `list<AyaPayService>` |
| `channel('aya_pgw')->paymentRequest($orderId, $amount, $channel, $method, ...)` | `ayaPay()->initiate(new AyaPayPaymentData(...))` → `FormPayment` |
| `channel('aya_pgw')->paymentEnquiry($orderId)` | `ayaPay()->status($orderId)` → `PaymentStatusResult` |
| `channel('cyber_source.secure_acceptance')->getPaymentData($transactionId, $referenceNumber, $amount, ...)` | `cyberSource()->initiate(new CyberSourcePaymentData(...))` → `FormPayment` |
| `channel('yoma_mmqr')->getPaymentQr($orderNumber, $amount, $description)` | `yomaMmqr()->initiate(new YomaMmqrPaymentData(...))` → `QrPayment` (`qrImage`) |
| `channel('yoma_mmqr')->checkoutOrder(...)` + `generateQr($orderNumber)` | `yomaMmqr()->initiate($data)` once, then `yomaMmqr()->renewQr($orderId)` |
| `channel('yoma_mmqr')->checkPaymentStatus($refLabel)` | `yomaMmqr()->status($payment->reference)` → `PaymentStatusResult` |

Parameters share one vocabulary across gateways:

- The order id is `orderId`; the server-to-server URL is `callbackUrl`; the customer's return URL is `returnUrl`.
- KBZ Pay's `$nonceStr`, CyberSource's `$transactionId` (`transaction_uuid`) and AYA's `$currencyCode` are handled internally. CyberSource's `$referenceNumber` is now `orderId`.
- Wave Money items are `WaveMoneyItem` objects, the total defaults to their sum, and `merchantReferenceId` defaults to a random id. `returnUrl` and `description` are required (v2 fell back to `APP_URL` and the app name).
- AYA takes an `AyaPayMethod` enum for `method`.
- Amounts are `Amount|int`, never floats or numeric strings. See [Amounts](/laravel-myanmar-payments/amounts).
- Request data is validated against each gateway's documented rules when it is built, and throws `InvalidPaymentDataException`.

### Results

v2 returned strings and arrays; v4 returns one class per flow. See [Payment Flows](/laravel-myanmar-payments/payment-flows).

| v2.2.7 | v4.0.0 |
|---|---|
| KBZ PWA / Wave URL string | `RedirectPayment::$url` |
| KBZ QR string | `QrPayment::$qrString` |
| KBZ App `['orderInfo', 'sign', 'signType']` | `AppPayment::toArray()` |
| AYA / CyberSource `['url' => ..., 'data' => ...]` | `FormPayment::$action` / `$fields`, or simply `redirect($payment->autoSubmitUrl)` |
| Yoma `['refLabel', 'qrString', 'expiresInSeconds']` | `QrPayment::$reference`, `$qrImage`, `$expiresAt` |

AYA Pay and CyberSource forms no longer need a page of your own: the package's [auto-submit form route](/laravel-myanmar-payments/configuration#auto-submit-form-route) renders and posts them.

### Callbacks

The `verify*()` methods returned a `bool` (or AYA's decoded payload). `handleCallback()` takes the request, throws `SignatureVerificationException` when verification fails and returns a `PaymentCallback`:

```php
// v2.2.7
abort_unless(LaravelMyanmarPaymentsFacade::channel('kbz_pay.qr')->verifySignature($request), 401);

// v4.0.0
$callback = MyanmarPayments::kbzPay()->handleCallback($request);

if ($callback->isSuccessful()) {
    // $callback->orderId, $callback->gatewayReference, $callback->amount
}

return MyanmarPayments::acknowledge($callback);
```

| v2.2.7 | v4.0.0 |
|---|---|
| `channel('kbz_pay.*')->verifySignature($request)` | `kbzPay()->handleCallback($request)` |
| `channel('wave_money')->verifyWaveSignature($request)` | `waveMoney()->handleCallback($request)` |
| `channel('aya_pgw')->verifySignature($payload, $checkSum)` | `ayaPay()->handleCallback($request)`, or `ayaPay()->verifyRedirect($request)` on the return page |
| `channel('cyber_source.secure_acceptance')->verifySignature($request)` | `cyberSource()->handleCallback($request)` |
| `channel('yoma_mmqr')->verifySignature($request)` | `yomaMmqr()->handleCallback($request)` |

- Branch on `$callback->status` (`PaymentStatus`) or `isSuccessful()`. v2's Wave check returned `false` for any status but `PAYMENT_CONFIRMED`; v4 verifies every status and maps it.
- Return `MyanmarPayments::acknowledge($callback)` so each gateway gets the response it expects (KBZ Pay's plain `success`) and stops retrying.
- Callback verification for KBZ Pay, Wave Money and AYA was fixed against their official specifications.
- Yoma's `status()` returns `PaymentStatus::Expired` for an expired QR instead of throwing, and Yoma access tokens are now cached in your cache store.

See [Callbacks & Status](/laravel-myanmar-payments/callbacks).

### Configuration

The config file is now `config/myanmar-payments.php` (publish tag `myanmar-payments-config`), replacing `config/laravel-myanmar-payments.php` (tag `laravel-myanmar-payments`). Publish the new file and move your changes over:

```bash
php artisan vendor:publish --tag="myanmar-payments-config"
```

- Each gateway has a `*_SANDBOX` switch (default `true`) that selects its endpoints. The `*_BASE_URL` variables (required for AYA and CyberSource in v2) are now optional overrides. **Set `*_SANDBOX=false` in production**, even if you keep your base URL overrides: the other endpoints of a gateway (KBZ's PWA page, Wave's authenticate redirect) follow the switch.
- The AYA block is renamed `aya_pgw` → `aya_pay`, read from `AYA_PAY_*` with the `AYA_PGW_*` names as fallbacks.
- KBZ Pay's `base_url` and `pwa.base_redirect_url` keys are now `api_url` and `pwa_url`; the `KBZ_PAY_BASE_URL` and `KBZ_PAY_PWA_BASE_REDIRECT_URL` env names are unchanged. `KBZ_PAY_MERCHANT_NAME` is no longer used.
- Wave Money redirects the customer to `WAVE_MONEY_AUTHENTICATE_URL` (the Wave host without the API port) instead of the API base URL.
- `MYANMAR_PAYMENTS_HTTP_TIMEOUT`, `MYANMAR_PAYMENTS_CACHE_STORE` and the `form_route` options are new.

See [Configuration](/laravel-myanmar-payments/configuration).

### Exceptions

v2 threw plain `Exception`s. v4 throws `PaymentException` subclasses: `InvalidPaymentDataException`, `ApiException` (with the gateway's code and message), `SignatureVerificationException` and `ConfigurationException`. See [Errors](/laravel-myanmar-payments/references/errors).

### Removed

- `LaravelMyanmarPayments::channel()` and the per-channel classes (`KbzPayPwa`, `KbzPayQr`, `KbzPayApp`, `WaveMoney`, `AyaPgw`, `CyberSourceSecureAcceptance`, `YomaMmqr`) in the `Laranex\LaravelMyanmarPayments` namespace.
- KBZ Pay's refund query (`queryOrder()` with `$refundRequestNo`).
- Yoma's public `getAccessToken()`; tokens are fetched and cached internally (`yomaMmqr()->forgetToken()` drops the cached one).
