---
title: Testing
description: Fake gateway calls with Goravel's HTTP client fakes, send signed callbacks to your routes, test your own handling with callbacks you build and follow auto-submit form links in your Goravel tests.
---

# Testing

## Faking Gateway Calls

Every gateway call goes through Goravel's HTTP client, so `Fake()` intercepts it and `AssertSent()` sees it. Call `PreventStrayRequests()` so nothing reaches a real gateway:

```go
import (
	"strings"

	"github.com/goravel/framework/contracts/http/client"

	"yourapp/app/facades"
)

func (s *CheckoutTestSuite) TestKbzPayQR() {
	const precreate = "http://api-uat.kbzpay.com/payment/gateway/uat/precreate"

	fake := facades.App().MakeHttp() // client.Factory
	fake.Fake(map[string]any{
		precreate: fake.Response().Json(200, map[string]any{
			"Response": map[string]any{
				"result":    "SUCCESS",
				"code":      "0",
				"prepay_id": "PREPAY1",
				"qrCode":    "kbz-qr",
			},
		}),
	}).PreventStrayRequests()
	defer fake.Reset()

	response, err := s.Http(s.T()).Post("/checkout/kbz-qr", nil)
	s.Require().NoError(err)
	response.AssertOk().AssertSee([]string{"kbz-qr"})

	s.True(fake.AssertSent(func(request client.Request) bool {
		return strings.Contains(
			request.Body(), `"merch_order_id":"ORDER_1"`,
		)
	}))
}
```

`facades.App().MakeHttp()` returns the `client.Factory` that holds the fakes. The `facades.Http()` that Goravel 1.18 generates in `app/facades` returns a `client.Request`, which has no `Fake`; if yours returns `client.Factory`, use it instead. Fakes registered after a gateway was built still apply: the package resolves the Goravel client on every request.

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{api_url}/precreate`, `{api_url}/queryorder` |
| Wave Money | `{base_url}/payment` |
| AYA Pay | `{base_url}/v1/payment/services`, `{base_url}/v1/payment/enquiry` (`Initiate()` is local) |
| Yoma MMQR | `{base_url}/token`, then `{base_url}/payment-gateway/{api_version}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/goravel-myanmar-payments/drivers/kbz-pay). Gateways are configured on first use and then reused for the whole process, so set test credentials in your test `.env` or with `facades.Config().Add("myanmar_payments.kbz_pay", ...)` before the first gateway is requested, for example in `SetupSuite`, and use the same values in every suite of the package. Pointing a gateway's base URL at a test host (`KBZ_PAY_BASE_URL`, `WAVE_MONEY_BASE_URL`, `AYA_PAY_BASE_URL`, `YOMA_MMQR_BASE_URL`) keeps the fake patterns short. Yoma access tokens are kept in your cache store; clear it between tests that fake the token call.

## Sending Signed Callbacks

To exercise your real callback route, post a payload signed with the secret from your test configuration. KBZ Pay signs every non-empty field except `sign` and `sign_type`, sorted by key, with `&key=<app key>` appended; the SDK exports that signer:

```go
import (
	"bytes"
	"encoding/json"

	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

func (s *CallbackTestSuite) TestKbzPayCallback() {
	// "test-app-key" is KBZ_PAY_APP_KEY in your test configuration
	fields := map[string]any{
		"merch_order_id": "ORDER_1",
		"mm_order_id":    "MM1",
		"total_amount":   "10000",
		"trade_status":   "PAY_SUCCESS",
		"nonce_str":      "n",
		"sign_type":      "SHA256",
	}
	fields["sign"] = kbzpay.NewSigner("test-app-key").Sign(fields)
	body, _ := json.Marshal(map[string]any{"Request": fields})

	response, err := s.Http(s.T()).
		WithHeader("Content-Type", "application/json").
		Post("/payments/kbz/callback", bytes.NewReader(body))
	s.Require().NoError(err)
	response.AssertOk().AssertSee([]string{"success"})
}
```

The other gateways sign with HMAC-SHA256 as described on their gateway pages. A modified payload must be rejected: `HandleCallback()` returns a `*myanmarpayments.SignatureVerificationError`.

## Mocking the Gateways

To test only your own handling, without signed payloads, keep it in a function that takes the verified callback (like `FulfillPayment` in [Handling Webhooks](/goravel-myanmar-payments/webhooks#job)), and call it with a `PaymentCallback` you build yourself:

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"

	"yourapp/app/jobs"
	"yourapp/app/models"
)

func (s *FulfillmentTestSuite) TestPaidOrder() {
	// seed an order numbered ORDER_1 for 10000 first
	callback := &myanmarpayments.PaymentCallback{
		OrderID:       "ORDER_1",
		Status:        myanmarpayments.StatusSuccessful,
		GatewayStatus: "PAY_SUCCESS",
		Amount:        "10000",
	}

	webhook := &models.PaymentWebhook{Gateway: "kbz-pay"}
	s.NoError(jobs.FulfillPayment(webhook, callback))
}
```

Go has no facade mocks: the manager behind `paymentsfacades.MyanmarPayments()` is the real one, and HTTP fakes are how you replace the gateways themselves.

## Following Form Links

`payments.AutoSubmitURL(form)` returns a link to the package's form route, so a test can follow it:

```go
import "net/url"

const action = `action="https://uat-pgw.ayainnovation.com/v1/payment/request"`

response, _ := s.Http(s.T()).Get("/checkout/aya-pay")
location, _ := url.Parse(response.Headers().Get("Location"))

form, _ := s.Http(s.T()).Get(location.RequestURI())
form.AssertOk().AssertSee([]string{action}, false)
```

A tampered link, or one older than `form_route.ttl_minutes`, answers `410 Gone`.
