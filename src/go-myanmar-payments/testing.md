---
title: Testing
description: Test an app that uses Go Myanmar Payments - fake the gateways' HTTP calls with an HTTPDoer or httptest.Server, replay signed callbacks with CallbackRequest, and build PaymentCallback values for your own code.
---

# Testing

Every gateway call goes through the `HTTPDoer` you pass to `New`, and callbacks are plain `*myanmarpayments.CallbackRequest` values, so apps that use the package are tested with `go test` and `net/http/httptest` like any other code. Nothing below needs network access.

## Faking Gateway Calls

Pass a fake `HTTPDoer` as the client. It receives every request the gateway sends and returns a canned response:

```go
package shop_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

var config = kbzpay.Config{
	AppID: "kp1", AppKey: "kbz-secret", MerchantCode: "1",
}

// doerFunc turns a function into a myanmarpayments.HTTPDoer.
type doerFunc func(*http.Request) (*http.Response, error)

func (f doerFunc) Do(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": {"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestStartsAKBZPayQRPayment(t *testing.T) {
	precreate := doerFunc(func(r *http.Request) (*http.Response, error) {
		var body struct {
			Request struct {
				BizContent map[string]string `json:"biz_content"`
			}
		}
		json.NewDecoder(r.Body).Decode(&body)
		if !strings.HasSuffix(r.URL.Path, "/precreate") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if body.Request.BizContent["merch_order_id"] != "ORDER_1" {
			t.Errorf("unexpected order %v", body.Request.BizContent)
		}
		return jsonResponse(`{"Response": {"result": "SUCCESS",
			"code": "0", "prepay_id": "PREPAY_1", "qrCode": "kbz-qr"}}`), nil
	})
	kbz, err := kbzpay.New(config, precreate)
	if err != nil {
		t.Fatal(err)
	}

	payment, err := kbz.QR(context.Background(), kbzpay.PaymentData{
		OrderID:     "ORDER_1",
		Amount:      myanmarpayments.Kyat(10000),
		CallbackURL: "https://shop.test/payments/kbz/callback",
	})
	if err != nil {
		t.Fatal(err)
	}

	if payment.QRString != "kbz-qr" || payment.Reference != "PREPAY_1" {
		t.Errorf("unexpected payment %+v", payment)
	}
}
```

| Gateway | Endpoints to fake |
|---|---|
| KBZ Pay | `{APIURL}/precreate`, `{APIURL}/queryorder` |
| Wave Money | `{BaseURL}/payment` |
| AYA Pay | `{BaseURL}/v1/payment/services`, `{BaseURL}/v1/payment/enquiry` (`Initiate` is local) |
| Yoma MMQR | `{BaseURL}/token`, then `{BaseURL}/payment-gateway/{APIVersion}/api/` + `payment/checkout`, `qr/generate`, `payment/check-status` |
| CyberSource | None: forms are signed locally |

Response bodies are described on each [gateway page](/go-myanmar-payments/drivers/kbz-pay). To test failures, return an error body (e.g. `{"Response": {"result": "FAIL", "code": "ORDER_ID_USED"}}`) and assert that your code handles the `*myanmarpayments.APIError`; return an error from `Do`, e.g. `errors.New("down")`, to simulate an unreachable gateway.

When your app builds gateways with `payments.FromEnv`, pass a test lookup function and the fake `HTTPDoer` instead of touching the process environment:

```go
import (
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/payments"
)

var testEnv = map[string]string{
	"KBZ_PAY_APP_ID":        "kp1",
	"KBZ_PAY_APP_KEY":       "kbz-secret",
	"KBZ_PAY_MERCHANT_CODE": "1",
}

func makePayments(doer myanmarpayments.HTTPDoer) *payments.Gateways {
	getenv := func(key string) string { return testEnv[key] }
	return payments.FromEnv(getenv, payments.Options{HTTPClient: doer})
}
```

### With httptest.Server

[`httptest.Server`](https://pkg.go.dev/net/http/httptest#Server) runs a real local server. Point the gateway at it with the config's URL override, and the gateway sends real HTTP requests to your handler:

```go
package shop_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

func TestReportsAPaidOrder(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/queryorder" {
				http.NotFound(w, r)
				return
			}
			io.WriteString(w, `{"Response": {"result": "SUCCESS",
				"code": "0", "merch_order_id": "ORDER_1",
				"trade_status": "PAY_SUCCESS", "total_amount": "10000"}}`)
		},
	))
	defer server.Close()

	kbz, err := kbzpay.New(kbzpay.Config{
		AppID:        "kp1",
		AppKey:       "kbz-secret",
		MerchantCode: "1",
		APIURL:       server.URL,
	}, server.Client())
	if err != nil {
		t.Fatal(err)
	}

	result, err := kbz.Status(context.Background(), "ORDER_1")
	if err != nil {
		t.Fatal(err)
	}

	if !result.IsSuccessful() {
		t.Errorf("status = %s", result.Status)
	}
}
```

Every config has a URL override: `APIURL` (KBZ Pay) and `BaseURL` (Wave Money, AYA, Yoma, CyberSource).

## Replaying Signed Callbacks

To run a callback through real verification, sign it with the secret from your test configuration. KBZ Pay's signer is public (`kbzpay.NewSigner`, or `kbz.Signer()` on a gateway); `NewCallbackRequestFromJSON` encodes the payload as a JSON body:

```go
package shop_test

import (
	"testing"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

var config = kbzpay.Config{
	AppID: "kp1", AppKey: "kbz-secret", MerchantCode: "1",
}

func signedKBZCallback(
	t *testing.T, fields map[string]any,
) *myanmarpayments.CallbackRequest {
	fields["sign_type"] = "SHA256"
	fields["sign"] = kbzpay.NewSigner("kbz-secret").Sign(fields)
	request, err := myanmarpayments.NewCallbackRequestFromJSON(
		map[string]any{"Request": fields}, nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	return request
}

func TestVerifiesAKBZPayCallback(t *testing.T) {
	request := signedKBZCallback(t, map[string]any{
		"merch_order_id": "ORDER_1",
		"mm_order_id":    "MM_1",
		"total_amount":   "10000",
		"trade_status":   "PAY_SUCCESS",
	})
	kbz, err := kbzpay.New(config, nil)
	if err != nil {
		t.Fatal(err)
	}

	callback, err := kbz.HandleCallback(request)
	if err != nil {
		t.Fatal(err)
	}

	if callback.Status != myanmarpayments.StatusSuccessful {
		t.Errorf("status = %s", callback.Status)
	}
	if callback.Acknowledgement.Body != "success" {
		t.Errorf("acknowledgement = %q", callback.Acknowledgement.Body)
	}
}
```

A modified payload must be rejected: change `total_amount` after signing and `HandleCallback` returns `*myanmarpayments.SignatureVerificationError`. To exercise your real callback handler, post the same JSON through it with `httptest`: `httptest.NewRequest("POST", "/payments/kbz/callback", bytes.NewReader(request.Body))`, then `handler.ServeHTTP(recorder, req)` with an `httptest.NewRecorder()`. Gin's `*gin.Engine` and Echo's `*echo.Echo` are `http.Handler`s too.

The other gateways sign with HMAC-SHA256 over documented fields, as described on their [gateway pages](/go-myanmar-payments/drivers/wave-money). To replay a call you stored, rebuild it from the stored raw body and headers: `myanmarpayments.NewCallbackRequest(storedBody, storedHeader, nil)`.

## Testing Your Own Logic

To test fulfillment code without signatures, build the callback yourself:

```go
package shop_test

import (
	"testing"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"

	"example.com/shop/orders"
)

func TestFulfillsAPaidOrder(t *testing.T) {
	callback := &myanmarpayments.PaymentCallback{
		OrderID:       "ORDER_1",
		Status:        myanmarpayments.StatusSuccessful,
		GatewayStatus: "PAY_SUCCESS",
		Amount:        "10000",
	}

	orders.Fulfill(callback)
}
```

`PaymentStatusResult`, `RedirectPayment`, `FormPayment`, `QrPayment` and `AppPayment` are plain structs too, so you can return them from a fake that implements your own interface over the gateway methods you call when a test only covers your own handlers.
