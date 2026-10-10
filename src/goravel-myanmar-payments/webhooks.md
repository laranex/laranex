---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a Goravel app - verify, store, acknowledge, then process once in a queued job with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `paymentsfacades.MyanmarPayments().HandleCallback(gateway, request)`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `payments.Acknowledge(ctx, callback)`, so the gateway stops retrying.
4. **Process once** in a queued job: skip what is already processed, lock the order, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'Your app', 'Queue worker']"
  :steps="[
    { from: 'Gateway', to: 'Your app', label: 'Webhook', detail: 'POST /webhooks/payments/{gateway}' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'HandleCallback(gateway, request)' },
    { from: 'Your app', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: '*SignatureVerificationError', response: true },
    { from: 'Your app', to: 'Your app', label: 'Store the call', detail: 'facades.Orm().Query().Create()' },
    { from: 'Your app', to: 'Queue worker', label: 'Dispatch the job', detail: 'ProcessPaymentWebhook' },
    { from: 'Your app', to: 'Gateway', label: 'Acknowledge immediately', detail: 'payments.Acknowledge(ctx, callback)', response: true },
    { from: 'Queue worker', to: 'Queue worker', label: 'Lock the order, skip duplicates', detail: 'facades.Cache().Lock(), status' },
    { from: 'Queue worker', to: 'Queue worker', label: 'Fulfill once, or retry with backoff', detail: 'ShouldRetry(), attempts, last_error' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own `Order` model. It needs a real queue connection (`database` or Redis) with a running worker, and a cache store that supports locks. The examples import your application's packages as `yourapp/app/...`; replace `yourapp` with your module name.

## Migration

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

## Model

`app/models/payment_webhook.go`. The raw body is kept byte for byte, so a stored row can always be verified again. Old rows are pruned on a schedule, see [Replay and Prune](#replay-and-prune).

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

## Route and Controller

One route serves every gateway. Gateways post from their own servers, so register it in `routes/web.go` without authentication or CSRF middleware:

```go
import (
	"yourapp/app/facades"
	"yourapp/app/http/controllers"
)

facades.Route().Post(
	"/webhooks/payments/{gateway}",
	controllers.NewPaymentWebhookController().Store,
)
```

Use `https://shop.test/webhooks/payments/kbz-pay` as the gateway's callback URL: pass it as `CallbackURL` when you start a payment (KBZ Pay, Wave Money, CyberSource) or register it in the gateway's merchant portal (AYA Pay, Yoma MMQR). The names are the ones `payments.GatewayNames()` returns: `kbz-pay`, `wave-money`, `aya-pay`, `yoma-mmqr`, `cyber-source`.

`app/http/controllers/payment_webhook_controller.go`:

```go
package controllers

import (
	"errors"
	"fmt"

	"github.com/goravel/framework/contracts/http"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	payments "github.com/laranex/goravel-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
	"yourapp/app/jobs"
	"yourapp/app/models"
)

// PaymentWebhookController receives gateway callbacks the recommended way:
// verify, store the raw request, acknowledge at once, process in a queued job.
type PaymentWebhookController struct{}

func NewPaymentWebhookController() *PaymentWebhookController {
	return &PaymentWebhookController{}
}

// Store handles POST /webhooks/payments/{gateway}.
func (r *PaymentWebhookController) Store(ctx http.Context) http.Response {
	gateway := ctx.Request().Route("gateway")
	request, err := payments.CallbackRequestFromContext(ctx)
	if err != nil {
		return ctx.Response().String(http.StatusBadRequest, "bad request")
	}

	webhook := models.NewPaymentWebhook(gateway, ctx.Request().Ip(), request)
	callback, err := paymentsfacades.MyanmarPayments().
		HandleCallback(gateway, request)

	var signatureError *myanmarpayments.SignatureVerificationError
	switch {
	case errors.Is(err, payments.ErrUnknownGateway):
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

## Job

The job is where the order is fulfilled. It is safe to run more than once:

- **Lock:** `facades.Cache().Lock()` lets one worker at a time process a given order. Use a shared cache store (Redis, database) when you run several workers.
- **Idempotent:** a row that is already processed, or another processed row with the same gateway, order and gateway status, is skipped; the order itself is checked again inside a transaction.
- **Retries:** `ShouldRetry` retries failures with the `webhookBackoff` delays up to `MaxWebhookAttempts`; every attempt is counted and the last error is kept. After the last attempt the row is `failed`.

`app/jobs/process_payment_webhook.go`:

```go
package jobs

import (
	"errors"
	"fmt"
	"time"

	"github.com/goravel/framework/contracts/database/orm"
	"github.com/goravel/framework/contracts/queue"
	"github.com/goravel/framework/support/carbon"
	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
	paymentsfacades "github.com/laranex/goravel-myanmar-payments/v4/facades"

	"yourapp/app/facades"
	"yourapp/app/models"
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

// FulfillPayment is the app's business logic for a verified callback: it
// marks the order paid once. It runs at most once per gateway + order +
// gateway status; adapt it to your own Order model.
var FulfillPayment = func(
	webhook *models.PaymentWebhook,
	callback *myanmarpayments.PaymentCallback,
) error {
	if !callback.IsSuccessful() {
		return nil // record failures, cancellations, ... as your app needs
	}

	return facades.Orm().Transaction(func(tx orm.Query) error {
		var order models.Order
		err := tx.LockForUpdate().
			Where("number = ?", callback.OrderID).
			FirstOrFail(&order)
		if err != nil {
			return err
		}
		if order.PaidAt != nil {
			return nil
		}
		expected, err := myanmarpayments.ParseAmount(order.Amount)
		if err != nil {
			return err
		}
		// Yoma MMQR's callback carries no amount; its amount was fixed
		// at checkout.
		if callback.Amount != "" && !expected.Equals(callback.Amount) {
			return fmt.Errorf(
				"paid %s, expected %s for order %s",
				callback.Amount, order.Amount, order.Number,
			)
		}

		order.PaidAt = carbon.NewDateTime(carbon.Now())
		order.GatewayReference = callback.GatewayReference

		return tx.Save(&order)
	})
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
	callback, err := paymentsfacades.MyanmarPayments().HandleCallback(
		webhook.Gateway, webhook.CallbackRequest(),
	)
	if err != nil {
		return err
	}

	return FulfillPayment(webhook, callback)
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as a decimal string, and nullable `paid_at` and `gateway_reference`.

Register the job, the replay command and the pruning schedule in `bootstrap/payment_webhooks.go`:

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

With the `sync` queue driver the job runs inside the request and is not retried: fine for local development and tests, not for production.

## Replay and Prune

A failed row keeps `last_error` and the status `failed`. After fixing the cause, process it again with `app/console/commands/replay_payment_webhooks.go`:

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

The schedule above deletes rows older than 90 days. Every delivery is a row, so the database answers most questions:

```sql
-- What happened to an order?
SELECT id, status, gateway_status, attempts, last_error, created_at
FROM payment_webhooks
WHERE gateway = 'kbz-pay' AND order_id = 'ORDER_1'
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

To inspect a stored delivery in code, verify it again: `paymentsfacades.MyanmarPayments().HandleCallback(webhook.Gateway, webhook.CallbackRequest())` returns the same typed callback the controller saw.

## Testing

With the `sync` queue the job runs inside the request, so a feature test can post a signed callback and assert on the row:

```go
import (
	"bytes"
	"encoding/json"

	"github.com/laranex/go-myanmar-payments/v4/kbzpay"

	"yourapp/app/facades"
	"yourapp/app/models"
)

func (s *PaymentWebhooksTestSuite) TestKbzPayWebhook() {
	fields := map[string]any{
		"merch_order_id": "ORDER_1",
		"mm_order_id":    "MM1",
		"total_amount":   "10000",
		"trade_status":   "PAY_SUCCESS",
		"nonce_str":      "n",
		"sign_type":      "SHA256",
	}
	// "test-app-key" is KBZ_PAY_APP_KEY in your test configuration
	fields["sign"] = kbzpay.NewSigner("test-app-key").Sign(fields)
	body, _ := json.Marshal(map[string]any{"Request": fields})

	response, err := s.Http(s.T()).
		WithHeader("Content-Type", "application/json").
		Post("/webhooks/payments/kbz-pay", bytes.NewReader(body))
	s.Require().NoError(err)
	response.AssertOk()

	var webhook models.PaymentWebhook
	query := facades.Orm().Query().Where("order_id = ?", "ORDER_1")
	s.Require().NoError(query.First(&webhook))
	s.Equal(models.WebhookProcessed, webhook.Status)
}
```

Post the same body twice to test duplicates, a modified body to test rejection, and call `(&jobs.ProcessPaymentWebhook{}).Handle(id)` directly to test retries. To sign other gateways' payloads, compute the signature in the test with your sandbox secret, as described on each gateway's page.
