---
title: Handling webhooks (recommended)
description: The recommended way to handle payment callbacks in Goravel. Verify with the package, store the raw request in your own table, acknowledge at once, then process each order status once in a queued job with retries, replays and pruning.
---

# Handling webhooks (recommended)

Gateways deliver payment results as server-to-server callbacks (webhooks). They retry until they get the acknowledgement they expect, can deliver the same result more than once, and give you only a few seconds to answer. The flow below handles all of that and leaves a record you can debug and replay:

1. **Receive**: verify the callback with the package, then store the raw request (body, headers, query) in your own table. Bad signatures are stored as `rejected` for debugging and never processed.
2. **Acknowledge** at once with `payments.Acknowledge`, before any business logic runs.
3. **Process once** in a queued job: skip a gateway + order + status that was already processed, lock the order against concurrent workers, record attempts and the last error.
4. **Retry** with backoff on failure. Failed rows stay for debugging; replay them with a command and prune old rows on a schedule.

The package itself stores nothing: everything on this page is application code you copy into your app and adapt. The Laranex playground app runs this exact code under its tests.

<SequenceDiagram
  title="A stored webhook, from delivery to fulfillment"
  :participants="['Gateway', 'Webhook route', 'Database', 'Queue job', 'Your logic']"
  :steps="[
    { from: 'Gateway', to: 'Webhook route', label: 'POST /payments/webhooks/kbzpay', detail: 'payment notification' },
    { from: 'Webhook route', to: 'Webhook route', label: 'Verify the signature', detail: 'gateway.HandleCallback(request)' },
    { from: 'Webhook route', to: 'Database', label: 'Store the raw request', detail: 'received, or rejected for a bad signature' },
    { from: 'Webhook route', to: 'Gateway', label: 'Acknowledge at once', detail: 'payments.Acknowledge(ctx, callback)', response: true },
    { from: 'Webhook route', to: 'Queue job', label: 'Dispatch', detail: 'ProcessPaymentWebhook(id)' },
    { from: 'Queue job', to: 'Database', label: 'Lock the order, skip duplicates', detail: 'gateway + order + status already processed?' },
    { from: 'Queue job', to: 'Your logic', label: 'Verify again and fulfill once', detail: 'compare the amount, mark the order paid' },
    { from: 'Queue job', to: 'Database', label: 'Processed, or retry with backoff', detail: 'failed after 5 attempts; replay later' },
  ]"
/>

The examples import your application's packages as `yourapp/app/...`; replace `yourapp` with your module name.

## 1. Migration

`database/migrations/20261008120000_create_payment_webhooks_table.go`, registered in `bootstrap/migrations.go`:

```go
package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"yourapp/app/facades"
)

type M20261008120000CreatePaymentWebhooksTable struct{}

// Signature The unique signature for the migration.
func (r *M20261008120000CreatePaymentWebhooksTable) Signature() string {
	return "20261008120000_create_payment_webhooks_table"
}

// Up Run the migrations.
func (r *M20261008120000CreatePaymentWebhooksTable) Up() error {
	if facades.Schema().HasTable("payment_webhooks") {
		return nil
	}

	return facades.Schema().Create("payment_webhooks", func(
		table schema.Blueprint,
	) {
		table.ID()
		table.String("gateway", 32)
		table.String("order_id").Nullable()
		table.String("gateway_reference").Nullable()
		table.String("gateway_status").Nullable()
		table.String("payment_status", 16).Nullable()
		// received, rejected, processing, processed, failed
		table.String("status", 16).Default("received")
		table.Text("headers")
		table.LongText("body")
		table.Text("query")
		table.String("ip", 45).Nullable()
		table.Text("signature_error").Nullable()
		table.UnsignedInteger("attempts").Default(0)
		table.LongText("last_error").Nullable()
		table.TimestampTz("processed_at").Nullable()
		table.TimestampTz("failed_at").Nullable()
		table.TimestampsTz()
		table.Index("gateway", "order_id", "gateway_status")
		table.Index("status")
		table.Index("created_at")
	})
}

// Down Reverse the migrations.
func (r *M20261008120000CreatePaymentWebhooksTable) Down() error {
	return facades.Schema().DropIfExists("payment_webhooks")
}
```

## 2. Model

`app/models/payment_webhook.go`. The raw body is kept byte for byte, so a stored row can always be verified again:

```go
package models

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/goravel/framework/database/orm"
	"github.com/goravel/framework/support/carbon"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

// Statuses of a stored payment webhook.
const (
	// WebhookReceived: stored and verified, waiting for the job.
	WebhookReceived = "received"
	// WebhookRejected: failed signature verification; never processed.
	WebhookRejected = "rejected"
	// WebhookProcessing: a job is working on it.
	WebhookProcessing = "processing"
	// WebhookProcessed: done, or a duplicate of a processed delivery.
	WebhookProcessed = "processed"
	// WebhookFailed: every attempt failed; replay it after fixing the cause.
	WebhookFailed = "failed"
)

// PaymentWebhook is one delivery of a gateway callback, stored exactly as
// received so it can be debugged and replayed.
type PaymentWebhook struct {
	orm.Model
	Gateway          string           `json:"gateway"`
	OrderID          string           `json:"order_id"`
	GatewayReference string           `json:"gateway_reference"`
	GatewayStatus    string           `json:"gateway_status"`
	PaymentStatus    string           `json:"payment_status"`
	Status           string           `json:"status"`
	Headers          string           `json:"headers"`
	Body             string           `json:"body"`
	Query            string           `json:"query"`
	IP               string           `gorm:"column:ip" json:"ip"`
	SignatureError   string           `json:"signature_error"`
	Attempts         int              `json:"attempts"`
	LastError        string           `json:"last_error"`
	ProcessedAt      *carbon.DateTime `json:"processed_at"`
	FailedAt         *carbon.DateTime `json:"failed_at"`
}

// NewPaymentWebhook stores the raw request of a delivery.
func NewPaymentWebhook(
	gateway, ip string,
	request *myanmarpayments.CallbackRequest,
) PaymentWebhook {
	headers, _ := json.Marshal(request.Header)
	query, _ := json.Marshal(request.Query)

	return PaymentWebhook{
		Gateway: gateway,
		Status:  WebhookReceived,
		Headers: string(headers),
		Body:    string(request.Body),
		Query:   string(query),
		IP:      ip,
	}
}

// CallbackRequest rebuilds the request the gateway sent, to verify it again.
func (w *PaymentWebhook) CallbackRequest() *myanmarpayments.CallbackRequest {
	header := http.Header{}
	query := url.Values{}
	_ = json.Unmarshal([]byte(w.Headers), &header)
	_ = json.Unmarshal([]byte(w.Query), &query)

	return myanmarpayments.NewCallbackRequest([]byte(w.Body), header, query)
}

// Fill copies the verified callback's fields.
func (w *PaymentWebhook) Fill(callback *myanmarpayments.PaymentCallback) {
	w.OrderID = callback.OrderID
	w.GatewayReference = callback.GatewayReference
	w.GatewayStatus = callback.GatewayStatus
	w.PaymentStatus = string(callback.Status)
}
```

## 3. Verifying any gateway

`app/services/payment_callbacks.go` maps the gateway name in the URL to the package's gateways. Each `HandleCallback` verifies the signature and returns the typed callback:

```go
package services

import (
	"errors"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"
)

// ErrUnknownGateway is returned for a gateway name the app does not accept.
var ErrUnknownGateway = errors.New("unknown payment gateway")

// VerifyPaymentCallback verifies a callback with the named gateway.
func VerifyPaymentCallback(
	gateway string,
	request *myanmarpayments.CallbackRequest,
) (*myanmarpayments.PaymentCallback, error) {
	manager := paymentsfacades.MyanmarPayments()

	switch gateway {
	case "kbzpay":
		g, err := manager.KbzPay()
		if err != nil {
			return nil, err
		}
		return g.HandleCallback(request)
	case "wave-money":
		g, err := manager.WaveMoney()
		if err != nil {
			return nil, err
		}
		return g.HandleCallback(request)
	case "aya-pay":
		g, err := manager.AyaPay()
		if err != nil {
			return nil, err
		}
		return g.HandleCallback(request)
	case "yoma-mmqr":
		g, err := manager.YomaMmqr()
		if err != nil {
			return nil, err
		}
		return g.HandleCallback(request)
	case "cyber-source":
		g, err := manager.CyberSource()
		if err != nil {
			return nil, err
		}
		return g.HandleCallback(request)
	default:
		return nil, ErrUnknownGateway
	}
}
```

## 4. Route and controller

`app/http/controllers/payment_webhook_controller.go`:

```go
package controllers

import (
	"errors"
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	payments "github.com/laranex/goravel-myanmar-payments/v4"

	"yourapp/app/facades"
	"yourapp/app/jobs"
	"yourapp/app/models"
	"yourapp/app/services"
)

// PaymentWebhookController receives gateway callbacks the recommended way:
// verify, store the raw request, acknowledge at once, process in a queued job.
type PaymentWebhookController struct{}

func NewPaymentWebhookController() *PaymentWebhookController {
	return &PaymentWebhookController{}
}

// Store handles POST /payments/webhooks/{gateway}.
func (r *PaymentWebhookController) Store(ctx http.Context) http.Response {
	gateway := ctx.Request().Route("gateway")
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}

	webhook := models.NewPaymentWebhook(gateway, ctx.Request().Ip(), request)
	callback, err := services.VerifyPaymentCallback(gateway, request)

	var signatureError *myanmarpayments.SignatureVerificationError
	switch {
	case errors.Is(err, services.ErrUnknownGateway):
		return ctx.Response().String(http.StatusNotFound, "unknown gateway")
	case errors.As(err, &signatureError):
		// Keep rejected deliveries for debugging; they are never processed.
		webhook.Status = models.WebhookRejected
		webhook.SignatureError = signatureError.Message
		if err := facades.Orm().Query().Create(&webhook); err != nil {
			facades.Log().Error(
				fmt.Sprintf("store rejected %s webhook: %v", gateway, err),
			)
		}
		return ctx.Response().String(http.StatusBadRequest, "invalid signature")
	case err != nil:
		// e.g. missing credentials: answer 500 so the gateway retries later
		return ctx.Response().
			String(http.StatusInternalServerError, "cannot verify the callback")
	}

	webhook.Fill(callback)
	if err := facades.Orm().Query().Create(&webhook); err != nil {
		// Not stored: let the gateway retry instead of acknowledging.
		return ctx.Response().
			String(http.StatusInternalServerError, "cannot store the callback")
	}

	if err := jobs.DispatchPaymentWebhook(webhook.ID); err != nil {
		// Stored: acknowledge anyway and replay it later.
		facades.Log().Error(
			fmt.Sprintf("dispatch %s webhook %d: %v", gateway, webhook.ID, err),
		)
	}

	return payments.Acknowledge(ctx, callback)
}
```

Register it in `routes/web.go` without authentication or CSRF middleware; gateways call it from their servers:

```go
facades.Route().Post(
	"/payments/webhooks/{gateway}",
	controllers.NewPaymentWebhookController().Store,
)
```

Use `https://shop.test/payments/webhooks/<gateway>` as the callback URL: pass it as `CallbackURL` when you start a payment (KBZ Pay, Wave Money, CyberSource) or register it in the gateway's merchant portal (AYA Pay, Yoma MMQR). The gateway names are the ones `VerifyPaymentCallback` accepts: `kbzpay`, `wave-money`, `aya-pay`, `yoma-mmqr`, `cyber-source`.

## 5. Queue job

`app/jobs/process_payment_webhook.go`. Replace `FulfillPayment` with your business logic:

```go
package jobs

import (
	"errors"
	"fmt"
	"time"

	"github.com/goravel/framework/contracts/queue"
	"github.com/goravel/framework/support/carbon"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"

	"yourapp/app/facades"
	"yourapp/app/models"
	"yourapp/app/services"
)

// MaxWebhookAttempts is how many times a stored webhook is processed before
// it is failed.
const MaxWebhookAttempts = 5

// webhookBackoff is the wait before each retry.
var webhookBackoff = []time.Duration{
	10 * time.Second, time.Minute, 5 * time.Minute, 15 * time.Minute,
}

// errWebhookLocked means another worker is processing the same order; retry
// later.
var errWebhookLocked = errors.New("another worker is processing this order")

// FulfillPayment is the app's business logic for a verified callback. Replace
// it with your own: find the order by callback.OrderID, compare
// callback.Amount, mark it paid. It runs at most once per gateway + order +
// gateway status.
var FulfillPayment = func(
	webhook *models.PaymentWebhook,
	callback *myanmarpayments.PaymentCallback,
) error {
	facades.Log().Info(fmt.Sprintf(
		"[%s] order %s is %s (%s)",
		webhook.Gateway, callback.OrderID, callback.Status, callback.Amount,
	))

	return nil
}

// ProcessPaymentWebhook processes a stored payment webhook once, with retries.
type ProcessPaymentWebhook struct{}

// DispatchPaymentWebhook queues the processing of a stored webhook.
func DispatchPaymentWebhook(id uint) error {
	args := []queue.Arg{{Type: "uint", Value: id}}

	return facades.Queue().Job(&ProcessPaymentWebhook{}, args).Dispatch()
}

// Signature The name and signature of the job.
func (r *ProcessPaymentWebhook) Signature() string {
	return "process_payment_webhook"
}

// ShouldRetry retries with backoff until MaxWebhookAttempts.
func (r *ProcessPaymentWebhook) ShouldRetry(
	_ error,
	attempt int,
) (bool, time.Duration) {
	if attempt >= MaxWebhookAttempts {
		return false, 0
	}

	return true, webhookBackoff[min(attempt, len(webhookBackoff))-1]
}

// Handle Execute the job.
func (r *ProcessPaymentWebhook) Handle(args ...any) error {
	id, ok := args[0].(uint)
	if !ok {
		return fmt.Errorf(
			"process_payment_webhook: expected a uint id, got %T", args[0],
		)
	}

	var webhook models.PaymentWebhook
	if err := facades.Orm().Query().FindOrFail(&webhook, id); err != nil {
		return err
	}
	if webhook.Status == models.WebhookProcessed ||
		webhook.Status == models.WebhookRejected {
		return nil
	}

	// One worker per order at a time.
	key := "payment-webhook:" + webhook.Gateway + ":" + webhook.OrderID
	lock := facades.Cache().Lock(key, time.Minute)
	if !lock.Get() {
		return errWebhookLocked
	}
	defer lock.Release()

	// Process once per gateway + order + gateway status: gateways retry and
	// resend.
	duplicate, err := facades.Orm().Query().Model(&models.PaymentWebhook{}).
		Where(
			"gateway = ? AND order_id = ? AND gateway_status = ?"+
				" AND status = ? AND id <> ?",
			webhook.Gateway, webhook.OrderID, webhook.GatewayStatus,
			models.WebhookProcessed, webhook.ID,
		).
		Exists()
	if err != nil {
		return err
	}
	if duplicate {
		webhook.Status = models.WebhookProcessed
		webhook.LastError = "duplicate of an already processed delivery"
		webhook.ProcessedAt = carbon.NewDateTime(carbon.Now())

		return facades.Orm().Query().Save(&webhook)
	}

	webhook.Attempts++
	webhook.Status = models.WebhookProcessing
	if err := facades.Orm().Query().Save(&webhook); err != nil {
		return err
	}

	if err := process(&webhook); err != nil {
		webhook.LastError = err.Error()
		webhook.Status = models.WebhookReceived
		if webhook.Attempts >= MaxWebhookAttempts {
			webhook.Status = models.WebhookFailed
			webhook.FailedAt = carbon.NewDateTime(carbon.Now())
		}
		if saveErr := facades.Orm().Query().Save(&webhook); saveErr != nil {
			return errors.Join(err, saveErr)
		}

		return err // the queue worker retries with ShouldRetry
	}

	webhook.Status = models.WebhookProcessed
	webhook.LastError = ""
	webhook.ProcessedAt = carbon.NewDateTime(carbon.Now())

	return facades.Orm().Query().Save(&webhook)
}

// process verifies the stored request again and runs the business logic.
func process(webhook *models.PaymentWebhook) error {
	callback, err := services.VerifyPaymentCallback(
		webhook.Gateway, webhook.CallbackRequest(),
	)
	if err != nil {
		return err
	}

	return FulfillPayment(webhook, callback)
}
```

- **Once per order status.** Gateways retry and resend, so every delivery is stored but only the first of each gateway + order + gateway status is processed. A later status of the same order (for example `WAIT_PAY`, then `PAY_SUCCESS`) is processed on its own.
- **One worker per order.** `facades.Cache().Lock` keeps two workers from handling the same order at the same time. Use a shared cache store (Redis, database) when you run several workers.
- **Retries.** `ShouldRetry` makes the queue worker retry with the `webhookBackoff` delays up to `MaxWebhookAttempts`. The row keeps `attempts` and `last_error`; after the last attempt it is `failed`.
- **Fulfill idempotently anyway.** Check the order's state inside `FulfillPayment` (skip an order that is already paid) and compare `callback.Amount` with the order total before marking it paid.

## 6. Register the job, the replay command and pruning

`bootstrap/payment_webhooks.go`:

```go
package bootstrap

import (
	"fmt"

	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/queue"
	"github.com/goravel/framework/contracts/schedule"
	"github.com/goravel/framework/support/carbon"

	"yourapp/app/console/commands"
	"yourapp/app/facades"
	"yourapp/app/jobs"
	"yourapp/app/models"
)

func Jobs() []queue.Job {
	return []queue.Job{
		&jobs.ProcessPaymentWebhook{},
	}
}

func Commands() []console.Command {
	return []console.Command{
		&commands.ReplayPaymentWebhooks{},
	}
}

func Schedule() []schedule.Event {
	return []schedule.Event{
		// Prune stored payment webhooks after 90 days.
		facades.Schedule().Call(func() {
			cutoff := carbon.Now().SubDays(90)
			_, err := facades.Orm().Query().
				Where("created_at < ?", cutoff).
				Delete(&models.PaymentWebhook{})
			if err != nil {
				facades.Log().
					Error(fmt.Sprintf("prune payment webhooks: %v", err))
			}
		}).Daily(),
	}
}
```

and in `bootstrap/app.go`:

```go
return foundation.Setup().
	WithMigrations(Migrations).
	WithJobs(Jobs).
	WithCommands(Commands).
	WithSchedule(Schedule).
	// ...
	Create()
```

Process jobs with a real queue connection (`database` or Redis) and a running worker, as described in Goravel's queue documentation. With the `sync` driver the job runs inside the request and is not retried: fine for local development and tests, not for production.

## 7. Replaying

`app/console/commands/replay_payment_webhooks.go` re-dispatches stored webhooks after you fix the cause of a failure:

```go
package commands

import (
	"fmt"
	"strconv"

	"github.com/goravel/framework/contracts/console"
	"github.com/goravel/framework/contracts/console/command"

	"yourapp/app/facades"
	"yourapp/app/jobs"
	"yourapp/app/models"
)

// ReplayPaymentWebhooks re-dispatches stored webhooks: one by ID, or every
// failed one.
type ReplayPaymentWebhooks struct{}

// Signature The name and signature of the console command.
func (r *ReplayPaymentWebhooks) Signature() string {
	return "payments:webhooks:replay"
}

// Description The console command description.
func (r *ReplayPaymentWebhooks) Description() string {
	return "Process stored payment webhooks again"
}

// Extend The console command extend.
func (r *ReplayPaymentWebhooks) Extend() command.Extend {
	return command.Extend{
		ArgsUsage: "[id]",
		Flags: []command.Flag{
			&command.BoolFlag{
				Name:  "failed",
				Usage: "replay every failed webhook",
			},
		},
	}
}

// Handle Execute the console command.
func (r *ReplayPaymentWebhooks) Handle(ctx console.Context) error {
	query := facades.Orm().Query().Where("status <> ?", models.WebhookRejected)
	if id := ctx.Argument(0); id != "" {
		query = query.Where("id = ?", id)
	} else if ctx.OptionBool("failed") {
		query = query.Where("status = ?", models.WebhookFailed)
	} else {
		ctx.Error("Pass an id or --failed")
		return nil
	}

	var webhooks []models.PaymentWebhook
	if err := query.Get(&webhooks); err != nil {
		return err
	}
	for _, webhook := range webhooks {
		// A replay starts over: reset the status and attempts.
		_, err := facades.Orm().Query().Model(&webhook).Update(map[string]any{
			"status": models.WebhookReceived, "attempts": 0, "failed_at": nil,
		})
		if err != nil {
			return err
		}
		if err := jobs.DispatchPaymentWebhook(webhook.ID); err != nil {
			ctx.Error(fmt.Sprintf("webhook %d: %v", webhook.ID, err))
			continue
		}
		id := strconv.FormatUint(uint64(webhook.ID), 10)
		ctx.Info("Replayed webhook " + id)
	}

	return nil
}
```

```bash
./artisan payments:webhooks:replay 42        # one webhook
./artisan payments:webhooks:replay --failed  # every failed webhook
```

## Debugging

Every delivery is a row, so the database answers most questions:

```sql
-- What happened to an order?
SELECT id, status, gateway_status, attempts, last_error, created_at
FROM payment_webhooks
WHERE gateway = 'kbzpay' AND order_id = 'ORDER_1'
ORDER BY id;

-- What is failing?
SELECT gateway, last_error, COUNT(*)
FROM payment_webhooks
WHERE status = 'failed'
GROUP BY gateway, last_error;

-- Who sent a bad signature?
SELECT id, gateway, ip, signature_error, created_at
FROM payment_webhooks
WHERE status = 'rejected'
ORDER BY id DESC
LIMIT 20;
```

To inspect a stored delivery in code, verify it again: `services.VerifyPaymentCallback(webhook.Gateway, webhook.CallbackRequest())` returns the same typed callback the controller saw.

## Testing

With the `sync` queue the job runs inside the request, so a feature test can post a signed callback and assert on the row:

```go
func (s *PaymentWebhooksTestSuite) TestKbzPayWebhook() {
	fields := map[string]any{
		"appid":          "kp-app",
		"merch_code":     "200001",
		"merch_order_id": "ORDER_1",
		"mm_order_id":    "MM1",
		"total_amount":   "10000",
		"trans_currency": "MMK",
		"trade_status":   "PAY_SUCCESS",
		"nonce_str":      "n",
		"sign_type":      "SHA256",
	}
	// "kbz-secret" is the app key of your test config
	fields["sign"] = kbzpay.NewSigner("kbz-secret").Sign(fields)
	body, _ := json.Marshal(map[string]any{"Request": fields})

	response, err := s.Http(s.T()).
		WithHeader("Content-Type", "application/json").
		Post("/payments/webhooks/kbzpay", bytes.NewReader(body))
	s.Require().NoError(err)
	response.AssertOk()

	var webhook models.PaymentWebhook
	query := facades.Orm().Query().Where("order_id = ?", "ORDER_1")
	s.Require().NoError(query.First(&webhook))
	s.Equal(models.WebhookProcessed, webhook.Status)
}
```

Post the same body twice to test duplicates, a modified body to test rejection, and call `(&jobs.ProcessPaymentWebhook{}).Handle(id)` directly to test retries. See [Testing](/goravel-myanmar-payments/testing) for faking gateway HTTP calls.

## Handling callbacks inline

For a prototype you can verify and fulfill inside the request instead; see [Callbacks](/goravel-myanmar-payments/callbacks). You lose the stored record, the retries and the replays, and slow business logic can make the gateway time out and resend.
