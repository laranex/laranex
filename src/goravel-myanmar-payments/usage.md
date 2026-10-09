---
title: Usage
description: Get gateways from the MyanmarPayments facade, start KBZ Pay, Wave Money, Yoma MMQR, AYA Pay and CyberSource payments from Goravel handlers, and redirect to the auto-submit form route.
---

# Usage

## The facade

```go
import paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

manager := paymentsfacades.MyanmarPayments() // *payments.Manager
```

The manager returns the SDK's own gateway types, so everything in the [Go Myanmar Payments](/go-myanmar-payments/payment-flows) docs applies unchanged:

| Method | Returns | Gateway methods |
|---|---|---|
| `KbzPay()` | `(*kbzpay.Gateway, error)` | `PWA`, `QR`, `App`, `Status`, `HandleCallback` |
| `WaveMoney()` | `(*wavemoney.Gateway, error)` | `Initiate`, `HandleCallback` |
| `AyaPay()` | `(*ayapay.Gateway, error)` | `Services`, `Initiate`, `Status`, `HandleCallback`, `VerifyRedirect` |
| `YomaMmqr()` | `(*yomammqr.Gateway, error)` | `Initiate`, `RenewQR`, `Status`, `HandleCallback`, `ForgetToken` |
| `CyberSource()` | `(*cybersource.Gateway, error)` | `Initiate`, `HandleCallback` |

Each gateway is built from the [configuration](/goravel-myanmar-payments/configuration) the first time you request it and reused afterwards; gateways are safe for concurrent use. The error is a `*myanmarpayments.ConfigurationError` naming the missing setting. A failed build is not cached, so a fixed configuration takes effect on the next call.

`paymentsfacades.MyanmarPayments()` panics only when the service provider is not registered. Outside Goravel's facades, `payments.Registered()` and `payments.Resolve(app)` return the manager with an error instead.

Goravel's `http.Context` is a `context.Context`, so pass `ctx` straight to gateway calls that hit the network. Amounts are exact [`myanmarpayments.Amount`](/go-myanmar-payments/amounts) values such as `myanmarpayments.Kyat(10000)` or `myanmarpayments.MustParseAmount("10000.50")`.

## Redirect payments (KBZ Pay PWA, Wave Money)

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavemoney"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (c *CheckoutController) Wave(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	wave, err := paymentsfacades.MyanmarPayments().WaveMoney()
	if err != nil {
		return paymentError(ctx, err)
	}
	data := &wavemoney.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		CallbackURL: "https://shop.test/payments/callback/wave-money",
		ReturnURL:   fmt.Sprintf("https://shop.test/orders/%d", order.ID),
		Description: fmt.Sprintf("Order #%d", order.ID),
		Items: []wavemoney.Item{
			{Name: "Product A", Amount: myanmarpayments.Kyat(6000)},
			{Name: "Product B", Amount: myanmarpayments.Kyat(4000)},
		},
	}
	payment, err := wave.Initiate(ctx, data)
	if err != nil {
		return paymentError(ctx, err)
	}
	// data.MerchantReferenceID is filled in; store it with the order
	return ctx.Response().Redirect(http.StatusFound, payment.URL)
}
```

KBZ Pay's `PWA` works the same way with `kbzpay.PaymentData`. See [KBZ Pay](/go-myanmar-payments/drivers/kbz-pay) and [Wave Money](/go-myanmar-payments/drivers/wave-money) for the fields and limits.

## QR and in-app payments

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

kbz, _ := paymentsfacades.MyanmarPayments().KbzPay()
data := kbzpay.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	Amount:      myanmarpayments.Kyat(10000),
	CallbackURL: "https://shop.test/payments/callback/kbzpay",
}

qr, err := kbz.QR(ctx, data)
// qr.QRString: encode it into a QR image

app, err := kbz.App(ctx, data)
// orderId, orderInfo, sign and signType for the mobile SDK
return ctx.Response().Json(http.StatusOK, app)

yoma, _ := paymentsfacades.MyanmarPayments().YomaMmqr()
payment, err := yoma.Initiate(ctx, yomammqr.PaymentData{
	OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
	Amount:      myanmarpayments.Kyat(10000),
	Description: fmt.Sprintf("Order #%d", order.ID),
})
// <img src="{{ payment.QRImageDataURI("") }}">, payable until
// payment.ExpiresAt; renew it with yoma.RenewQR(ctx, payment.OrderID)
```

## Form payments (AYA Pay and CyberSource)

AYA Pay and CyberSource sign a form that the customer's browser must POST to the gateway. Hand the form to `payments.AutoSubmitURL` and redirect to the link it returns:

```go
import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/ayapay"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

func (c *CheckoutController) Aya(ctx http.Context) http.Response {
	order := findOrder(ctx) // your own order lookup

	aya, err := paymentsfacades.MyanmarPayments().AyaPay()
	if err != nil {
		return paymentError(ctx, err)
	}
	form, err := aya.Initiate(ayapay.PaymentData{
		OrderID:     fmt.Sprintf("ORDER_%d", order.ID),
		Amount:      myanmarpayments.Kyat(10000),
		Channel:     "aya_pay",
		Method:      ayapay.MethodQR,
		ReturnURL:   "https://shop.test/payments/aya-pay/done",
		Description: fmt.Sprintf("Order #%d", order.ID),
	})
	if err != nil {
		return paymentError(ctx, err)
	}

	// or paymentsfacades.MyanmarPayments().AutoSubmitURL(form)
	link, err := payments.AutoSubmitURL(form)
	if err != nil {
		return paymentError(ctx, err)
	}
	return ctx.Response().Redirect(http.StatusFound, link)
}
```

The link points at the [form route](/goravel-myanmar-payments/configuration#auto-submit-form-route). It carries the signed form encrypted with Goravel's crypt facade (`APP_KEY`) and expires after `ttl_minutes`. The route answers with the SDK's own `FormPayment.HTML()` page, which posts the form as soon as it loads, with `Cache-Control: no-store`. A tampered, foreign or expired link answers `410 Gone`.

The Go SDK has no auto-submit URL of its own; this is the Goravel counterpart of Laravel Myanmar Payments' `$payment->autoSubmitUrl`.

| Error | When |
|---|---|
| `payments.ErrFormRouteDisabled` | `form_route.enabled` is false |
| `payments.ErrCryptNotAvailable` | The crypt facade is not registered |

Without the route you can still serve the form yourself:

```go
html := []byte(form.HTML())
return ctx.Response().Data(http.StatusOK, "text/html; charset=utf-8", html)
```

`Manager.ResolveFormPayment(payload)` and `Manager.ServeForm(ctx)` expose the route's internals if you register your own route.

After paying, AYA sends the customer to `ReturnURL` with a signed query string. Verify it with `aya.VerifyRedirect` to show the result, and fulfill the order from the backend callback ([Handling webhooks](/goravel-myanmar-payments/webhooks)):

```go
import payments "github.com/laranex/goravel-myanmar-payments/v4"

request, err := payments.CallbackRequestFromContext(ctx)
result, err := aya.VerifyRedirect(request)
```

## Handling errors

The SDK's [errors](/go-myanmar-payments/references/errors) come back unchanged. A handler can map them onto HTTP statuses:

```go
import (
	"errors"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

func paymentError(ctx http.Context, err error) http.Response {
	var (
		invalid       *myanmarpayments.InvalidPaymentDataError
		apiError      *myanmarpayments.APIError
		configuration *myanmarpayments.ConfigurationError
	)
	response := ctx.Response()
	switch {
	case errors.As(err, &invalid):
		return response.Json(http.StatusUnprocessableEntity, http.Json{
			"message": err.Error(),
			"errors":  invalid.Errors,
		})
	case errors.As(err, &apiError):
		return response.Json(http.StatusBadGateway, http.Json{
			"message":     err.Error(),
			"gatewayCode": apiError.GatewayCode,
		})
	case errors.As(err, &configuration):
		return response.Json(http.StatusInternalServerError, http.Json{
			"message": err.Error(),
		})
	default:
		return response.Json(http.StatusInternalServerError, http.Json{
			"message": err.Error(),
		})
	}
}
```

Callback and return URLs must be absolute http or https URLs. The packages accept plain http, but Wave Money and CyberSource may require HTTPS in production, so an HTTPS tunnel as `APP_URL` helps when testing against them.

## Package reference

Everything the `payments` package exports besides the helpers above. Most applications only need the facade.

| Name | What it is |
|---|---|
| `payments.ServiceProvider` | The provider `package:install` registers. It binds the `*Manager`, publishes the config and registers the form route |
| `payments.NewManager(payments.Options{...})` | Builds a `*Manager` outside the container. `Options` holds `Config` (required), `HTTPClient` (nil uses the SDK's default client), `TokenCache` (nil uses the SDK's in-memory cache), `Crypt` (nil disables `AutoSubmitURL`) and `Now` (nil uses `time.Now`) |
| `payments.NewHTTPClient(factory, name, timeout)` | The `myanmarpayments.HTTPDoer` the provider uses: each request goes through the Goravel HTTP client `name` (empty means the default) with `timeout`. A nil factory sends requests with a plain `*http.Client` |
| `payments.NewTokenCache(store)` | The `myanmarpayments.TokenCache` the provider uses for Yoma MMQR tokens, backed by a Goravel cache store |
| `payments.ErrInvalidFormLink` | Returned by `Manager.ResolveFormPayment` for a tampered, foreign or expired link |
| `payments.Binding` | The container key of the manager, `laranex.myanmar_payments` |
| `payments.PackageName` | The name for `vendor:publish --package`, `github.com/laranex/goravel-myanmar-payments/v4` |
| `payments.ConfigKey` | The config root, `myanmar_payments` |
| `payments.FormRouteName` | The form route's name, `myanmar-payments.form` |
| `payments.DefaultFormRoutePath`, `DefaultFormRouteTTL`, `DefaultHTTPTimeout` | The defaults without a published config: `myanmar-payments/form`, 30 minutes and 30 seconds |
