---
title: Framework Integration
description: Use Go Myanmar Payments with net/http, chi, Gin and Echo. Create gateways once, build the CallbackRequest from the raw request, and write the acknowledgement.
---

# Framework Integration

The package needs only two things from your framework: the raw incoming request for callbacks and a way to write the acknowledgement. Both are standard library types (`*http.Request` and `http.ResponseWriter`), so it plugs into `net/http` and every router built on it. Create each gateway once at startup (or one [`*payments.Gateways`](/go-myanmar-payments/configuration#one-object-for-every-gateway)) and share it across requests, so the HTTP connections and Yoma's token cache stay warm; both are safe for concurrent use.

| Framework | Build the request | Acknowledge |
|---|---|---|
| `net/http`, chi | `myanmarpayments.NewCallbackRequestFromHTTP(r)` | `callback.Acknowledgement.Write(w)` |
| Gin | `myanmarpayments.NewCallbackRequestFromHTTP(c.Request)` | `callback.Acknowledgement.Write(c.Writer)` |
| Echo | `myanmarpayments.NewCallbackRequestFromHTTP(c.Request())` | `callback.Acknowledgement.Write(c.Response())` |

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your framework applies.

## net/http

Build the gateways once from the facade, then register the routes. Go 1.22 routing patterns are enough for every payment route:

```go
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/ayapay"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
	"github.com/laranex/go-myanmar-payments/v4/payments"
)

type server struct {
	kbz *kbzpay.Gateway
	aya *ayapay.Gateway
}

func main() {
	gateways := payments.FromEnv(os.Getenv, payments.Options{})
	kbz, err := gateways.KBZPay()
	if err != nil {
		log.Fatal(err)
	}
	aya, err := gateways.AYAPay()
	if err != nil {
		log.Fatal(err)
	}
	s := &server{kbz: kbz, aya: aya}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /checkout/{orderID}", s.checkout)
	mux.HandleFunc("POST /payments/kbz/callback", s.kbzCallback)
	mux.HandleFunc("GET /payments/aya/return", s.ayaReturn)
	mux.HandleFunc("GET /payments/kbz/status/{orderID}", s.kbzStatus)

	log.Fatal(http.ListenAndServe(":8080", mux))
}

func (s *server) checkout(w http.ResponseWriter, r *http.Request) {
	payment, err := s.aya.Initiate(ayapay.PaymentData{
		OrderID:   "ORDER_" + r.PathValue("orderID"),
		Amount:    myanmarpayments.Kyat(10000),
		Channel:   "aya_pay",
		Method:    ayapay.MethodQR,
		ReturnURL: "https://shop.test/payments/aya/return",
	})
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.WriteString(w, payment.HTML())
}

func (s *server) kbzCallback(w http.ResponseWriter, r *http.Request) {
	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		writeError(w, err)
		return
	}
	callback, err := s.kbz.HandleCallback(request)
	if err != nil {
		writeError(w, err)
		return
	}
	// fulfill callback.OrderID when callback.IsSuccessful()
	// and the amount matches
	callback.Acknowledgement.Write(w)
}

func (s *server) ayaReturn(w http.ResponseWriter, r *http.Request) {
	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		writeError(w, err)
		return
	}
	result, err := s.aya.VerifyRedirect(request)
	if err != nil {
		writeError(w, err)
		return
	}
	if result.IsSuccessful() {
		io.WriteString(w, "Thank you, your payment was received.")
		return
	}
	io.WriteString(w, "Payment "+string(result.Status)+".")
}

func (s *server) kbzStatus(w http.ResponseWriter, r *http.Request) {
	orderID := "ORDER_" + r.PathValue("orderID")
	result, err := s.kbz.Status(r.Context(), orderID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": result.Status})
}

func writeError(w http.ResponseWriter, err error) {
	var (
		invalidErr *myanmarpayments.InvalidPaymentDataError
		sigErr     *myanmarpayments.SignatureVerificationError
		apiErr     *myanmarpayments.APIError
	)
	switch {
	case errors.As(err, &invalidErr):
		writeJSON(w, http.StatusUnprocessableEntity,
			map[string]any{"errors": invalidErr.Errors})
	case errors.As(err, &sigErr):
		http.Error(w, "invalid signature", http.StatusBadRequest)
	case errors.As(err, &apiErr):
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"code":    apiErr.GatewayCode,
			"message": apiErr.GatewayMessage,
		})
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
```

`NewCallbackRequestFromHTTP` reads the body once and puts it back, so later middleware can still read `r.Body`. Never call `r.ParseForm()` or decode the body before it: the signature needs the body bytes exactly as the gateway sent them.

## chi

chi handlers are plain `http.HandlerFunc`s, so the `net/http` code works unchanged:

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/wavemoney"
)

func main() {
	wave, err := wavemoney.New(wavemoney.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		log.Fatal(err)
	}

	router := chi.NewRouter()
	router.Post("/payments/wave/callback", func(
		w http.ResponseWriter, r *http.Request,
	) {
		request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
		if err != nil {
			http.Error(w, "invalid callback", http.StatusBadRequest)
			return
		}
		callback, err := wave.HandleCallback(request)
		if err != nil {
			http.Error(w, "invalid signature", http.StatusBadRequest)
			return
		}
		// fulfill callback.OrderID when callback.IsSuccessful()
		// and the amount matches
		callback.Acknowledgement.Write(w)
	})

	log.Fatal(http.ListenAndServe(":8080", router))
}
```

Read route parameters with `chi.URLParam(r, "orderID")` where the `net/http` sample uses `r.PathValue("orderID")`.

## Gin

Pass `c.Request` to the package and `c.Writer` to the acknowledgement:

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/yomammqr"
)

func main() {
	// Create it once at startup: the token cache lives on the gateway.
	yoma, err := yomammqr.New(yomammqr.ConfigFromEnv(os.Getenv), nil, nil)
	if err != nil {
		log.Fatal(err)
	}

	router := gin.Default()

	router.POST("/payments/yoma/callback", func(c *gin.Context) {
		request, err := myanmarpayments.NewCallbackRequestFromHTTP(c.Request)
		if err != nil {
			c.String(http.StatusBadRequest, "invalid callback")
			return
		}
		callback, err := yoma.HandleCallback(request)
		if err != nil {
			c.String(http.StatusBadRequest, "invalid signature")
			return
		}
		callback.Acknowledgement.Write(c.Writer)
	})

	router.GET("/payments/yoma/:orderID", func(c *gin.Context) {
		id := c.Param("orderID")
		payment, err := yoma.Initiate(c.Request.Context(),
			yomammqr.PaymentData{
				OrderID:     "ORDER_" + id,
				Amount:      myanmarpayments.Kyat(10000),
				Description: "Order #" + id,
			})
		if err != nil {
			c.String(http.StatusBadGateway, err.Error())
			return
		}
		img := `<img src="` + payment.QRImageDataURI("") +
			`" alt="Scan to pay">`
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(img))
	})

	log.Fatal(router.Run(":8080"))
}
```

Take the callback from `c.Request`, not from `c.ShouldBind` or `c.ShouldBindJSON`: the signature needs the body bytes exactly as the gateway sent them.

## Echo

Pass `c.Request()` to the package and `c.Response()` to the acknowledgement:

```go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

func main() {
	kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		log.Fatal(err)
	}

	e := echo.New()

	e.POST("/payments/kbz/callback", func(c echo.Context) error {
		request, err := myanmarpayments.NewCallbackRequestFromHTTP(
			c.Request(),
		)
		if err != nil {
			return c.String(http.StatusBadRequest, "invalid callback")
		}
		callback, err := kbz.HandleCallback(request)
		if err != nil {
			return c.String(http.StatusBadRequest, "invalid signature")
		}
		// fulfill callback.OrderID when callback.IsSuccessful()
		// and the amount matches
		return callback.Acknowledgement.Write(c.Response())
	})

	e.GET("/checkout/:orderID", func(c echo.Context) error {
		payment, err := kbz.PWA(c.Request().Context(), kbzpay.PaymentData{
			OrderID:     "ORDER_" + c.Param("orderID"),
			Amount:      myanmarpayments.Kyat(10000),
			CallbackURL: "https://shop.test/payments/kbz/callback",
		})
		if err != nil {
			return err
		}
		return c.Redirect(http.StatusFound, payment.URL)
	})

	log.Fatal(e.Start(":8080"))
}
```

Take the callback from `c.Request()`, not from `c.Bind`: the signature needs the body bytes exactly as the gateway sent them.

## Other Frameworks

For any other framework, build the request from its parts with `myanmarpayments.NewCallbackRequest(body, header, query)` (the raw body as `[]byte`, the headers as an `http.Header`, the query string as `url.Values`), then write `ack.Status`, `ack.Headers` and `ack.Body` with your framework's response API.

## Testing Your App

See [Testing](/go-myanmar-payments/testing) to replace the gateways' HTTP calls with `httptest.Server` or a fake `HTTPDoer`, replay signed callbacks and build `PaymentCallback` values for your own code.
