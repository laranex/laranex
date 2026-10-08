---
title: Testing
description: Fake gateway HTTP calls with Goravel's HTTP client fakes, sign callbacks in tests and follow auto-submit form links.
---

# Testing

## Faking gateway calls

Every gateway call goes through Goravel's HTTP client, so `Fake` intercepts it. Match the gateway endpoint your test configuration resolves to, and prevent stray requests so nothing reaches a real gateway:

```go
func (s *CheckoutTestSuite) TestKbzPayQR() {
	http := facades.Http() // client.Factory
	http.Fake(map[string]any{
		"http://api-uat.kbzpay.com/payment/gateway/uat/precreate": http.Response().Json(200, map[string]any{
			"Response": map[string]any{"result": "SUCCESS", "code": "0", "prepay_id": "prepay-1", "qrCode": "kbz-qr"},
		}),
	}).PreventStrayRequests()
	defer http.Reset()

	response, err := s.Http(s.T()).Get("/checkout/kbzpay/qr")
	s.Require().NoError(err)
	response.AssertOk()

	s.True(http.AssertSent(func(request client.Request) bool {
		return strings.Contains(request.Body(), `"merch_order_id"`)
	}))
}
```

If your application's `facades.Http()` returns `client.Request` (older application skeletons), use `facades.App().MakeHttp()` to get the factory.

Fakes registered after a gateway was built still apply: the package resolves the Goravel client on every request. Pointing a gateway's base URL at a test host (`KBZ_PAY_BASE_URL`, `WAVE_MONEY_BASE_URL`, `AYA_PAY_BASE_URL`, `YOMA_MMQR_BASE_URL`, or the same keys under `myanmar_payments.*`) keeps the fake patterns short.

Gateways are built once per process from the configuration, so set test credentials before the first gateway is requested, for example in `SetupSuite`, and use the same values in every suite of the package.

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{api}/precreate`, `{api}/queryorder` |
| Wave Money | `{base}/payment` |
| AYA Pay | `{base}/v1/payment/services`, `{base}/v1/payment/enquiry` (`Initiate` is local) |
| Yoma MMQR | `{base}/token`, `{base}/payment-gateway/v1rc/api/payment/checkout`, `.../qr/generate`, `.../payment/check-status` |
| CyberSource | none: forms are signed locally |

Response bodies are described on each [driver page](/go-myanmar-payments/drivers/kbz-pay).

## Signing callbacks

Post a correctly signed payload to your callback route. KBZ Pay's signer is exported:

```go
fields := map[string]any{"merch_order_id": "ORDER_1", "total_amount": "1000", "trade_status": "PAY_SUCCESS" /* ... */}
fields["sign"] = kbzpay.NewSigner("your-test-app-key").Sign(fields)
body, _ := json.Marshal(map[string]any{"Request": fields})
```

The other gateways sign with HMAC-SHA256 as described on their driver pages; compute the value in your test with the secret from your test configuration. A modified body must be rejected with `*myanmarpayments.SignatureVerificationError`.

## Following form links

`AutoSubmitURL` returns an absolute link; request its path and query on the test server:

```go
response, _ := s.Http(s.T()).Get("/checkout/aya-pay")
location, _ := url.Parse(response.Headers().Get("Location"))
form, _ := s.Http(s.T()).Get(location.RequestURI())
form.AssertOk().AssertSee([]string{`action="https://uat-pgw.ayainnovation.com/v1/payment/request"`}, false)
```

A tampered or expired link answers `410 Gone`.
