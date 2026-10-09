---
title: net/http Integration
description: Wire Go Myanmar Payments into a net/http server with Go 1.22 routing patterns, one handler per gateway callback, and error handling with errors.As.
---

# net/http Integration

The package uses only `net/http` types, so it plugs into the standard library server and any router built on `http.Handler`. Create each gateway once at startup and share it across requests: gateways are safe for concurrent use, and Yoma's token cache stays warm.

```go
package main

import (
	"errors"
	"log"
	"net/http"
	"os"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	"github.com/laranex/go-myanmar-payments/v4/ayapay"
	"github.com/laranex/go-myanmar-payments/v4/kbzpay"
)

type server struct {
	kbz *kbzpay.Gateway
	aya *ayapay.Gateway
}

func main() {
	kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		log.Fatal(err)
	}
	aya, err := ayapay.New(ayapay.ConfigFromEnv(os.Getenv), nil)
	if err != nil {
		log.Fatal(err)
	}
	s := &server{kbz: kbz, aya: aya}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /checkout/{orderID}", s.checkout)
	mux.HandleFunc("POST /payments/callback/kbz", s.kbzCallback)
	mux.HandleFunc("POST /payments/callback/aya", s.ayaCallback)
	mux.HandleFunc("GET /payments/aya/return", s.ayaReturn)

	log.Fatal(http.ListenAndServe(":8080", mux))
}

func (s *server) checkout(w http.ResponseWriter, r *http.Request) {
	payment, err := s.aya.Initiate(ayapay.PaymentData{
		OrderID:   "ORDER" + r.PathValue("orderID"),
		Amount:    myanmarpayments.Kyat(8000),
		Channel:   "aya_pay",
		Method:    ayapay.MethodQR,
		ReturnURL: "https://shop.test/payments/aya/return",
	})
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(payment.HTML()))
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

func (s *server) ayaCallback(w http.ResponseWriter, r *http.Request) {
	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		writeError(w, err)
		return
	}
	callback, err := s.aya.HandleCallback(request)
	if err != nil {
		writeError(w, err)
		return
	}
	callback.Acknowledgement.Write(w)
}

// ayaReturn shows the right page; fulfillment still happens in ayaCallback.
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
		w.Write([]byte("Thank you, your payment was received."))
		return
	}
	w.Write([]byte("Payment " + string(result.Status) + "."))
}

func writeError(w http.ResponseWriter, err error) {
	var (
		invalidErr *myanmarpayments.InvalidPaymentDataError
		sigErr     *myanmarpayments.SignatureVerificationError
		apiErr     *myanmarpayments.APIError
	)
	switch {
	case errors.As(err, &invalidErr):
		http.Error(w, err.Error(), http.StatusUnprocessableEntity)
	case errors.As(err, &sigErr):
		http.Error(w, "invalid signature", http.StatusBadRequest)
	case errors.As(err, &apiErr):
		http.Error(w, err.Error(), http.StatusBadGateway)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
```

Gateway callbacks are server-to-server posts: exclude these routes from any CSRF protection your middleware applies.

## Other Servers

For servers that don't expose an `*http.Request`, build the request from the raw parts with `myanmarpayments.NewCallbackRequest(body, header, query)`, then write `callback.Acknowledgement.Status`, `Headers` and `Body` with your server's response API.

## Playground

The playground repository contains a runnable demo app with a route per gateway and flow, callbacks and status checks. It reads the same environment variables as `ConfigFromEnv`.
