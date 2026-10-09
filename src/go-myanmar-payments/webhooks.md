---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a Go service - verify, store, acknowledge, then process once in a worker goroutine with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The module verifies a webhook and builds the acknowledgement; what you do with it lives in your service. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `HandleCallback`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `callback.Acknowledgement.Write(w)`, so the gateway stops retrying.
4. **Process once** in a worker goroutine: claim the row, skip what is already fulfilled, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'HTTP handler', 'Worker']"
  :steps="[
    { from: 'Gateway', to: 'HTTP handler', label: 'Webhook', detail: 'POST /webhooks/payments/{gateway}' },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Verify the signature', detail: 'gateway.HandleCallback(request)' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: '*SignatureVerificationError', response: true },
    { from: 'HTTP handler', to: 'HTTP handler', label: 'Store the call', detail: 'INSERT INTO payment_webhooks' },
    { from: 'HTTP handler', to: 'Gateway', label: 'Acknowledge immediately', detail: 'callback.Acknowledgement.Write(w)', response: true },
    { from: 'Worker', to: 'Worker', label: 'Claim the next row', detail: 'locked_until, attempts + 1' },
    { from: 'Worker', to: 'Worker', label: 'Fulfill once, or retry with backoff', detail: 'paid_at IS NULL, available_at' },
  ]"
/>

None of this is part of the module: copy the code into your service and adapt the fulfillment to your own orders table. It uses `database/sql` with `?` placeholders (MySQL, SQLite); use `$1`, `$2`, ... on PostgreSQL.

## Table

```sql
CREATE TABLE payment_webhooks (
    -- BIGINT AUTO_INCREMENT on MySQL, BIGSERIAL on PostgreSQL
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gateway VARCHAR(32) NOT NULL,
    order_id VARCHAR(64) NULL,
    status VARCHAR(16) NULL,               -- PaymentStatus value
    gateway_status VARCHAR(64) NULL,
    gateway_reference VARCHAR(128) NULL,
    amount VARCHAR(32) NULL,               -- as sent, never a float
    verified SMALLINT NOT NULL,
    body TEXT NOT NULL,                    -- the raw request body
    headers TEXT NOT NULL,                 -- JSON
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    available_at INTEGER NOT NULL,         -- unix time of the next attempt
    locked_until INTEGER NULL,
    processed_at INTEGER NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX payment_webhooks_order
    ON payment_webhooks (gateway, order_id, status);
```

## Handler

```go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	myanmarpayments "github.com/laranex/go-myanmar-payments/v4"
)

// Verifier is what every gateway (*kbzpay.Gateway, *wavemoney.Gateway,
// ...) has in common.
type Verifier interface {
	HandleCallback(
		request *myanmarpayments.CallbackRequest,
	) (*myanmarpayments.PaymentCallback, error)
}

type Webhooks struct {
	DB       *sql.DB
	Gateways map[string]Verifier // "kbz-pay" => kbz, "wave-money" => wave, ...
}

// Handle verifies, stores and acknowledges. Processing happens in Work.
// Register it with
// mux.HandleFunc("POST /webhooks/payments/{gateway}", webhooks.Handle).
func (h *Webhooks) Handle(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("gateway")
	gateway, ok := h.Gateways[name]
	if !ok {
		http.NotFound(w, r)
		return
	}

	request, err := myanmarpayments.NewCallbackRequestFromHTTP(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	headers, _ := json.Marshal(request.Header)
	now := time.Now().Unix()

	callback, err := gateway.HandleCallback(request)
	if err != nil {
		var sigErr *myanmarpayments.SignatureVerificationError
		if !errors.As(err, &sigErr) {
			http.Error(w, "invalid callback", http.StatusBadRequest)
			return
		}
		_, _ = h.DB.ExecContext(r.Context(), `INSERT INTO payment_webhooks
			(gateway, verified, body, headers, last_error,
			 available_at, created_at)
			VALUES (?, 0, ?, ?, ?, ?, ?)`,
			name, string(request.Body), string(headers), sigErr.Error(),
			now, now)
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	_, err = h.DB.ExecContext(r.Context(), `INSERT INTO payment_webhooks
		(gateway, order_id, status, gateway_status, gateway_reference,
		 amount, verified, body, headers, available_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
		name, callback.OrderID, string(callback.Status),
		callback.GatewayStatus, callback.GatewayReference, callback.Amount,
		string(request.Body), string(headers), now, now)
	if err != nil {
		// Not stored: answer 500 so the gateway retries later.
		http.Error(w, "try again", http.StatusInternalServerError)
		return
	}

	if err := callback.Acknowledgement.Write(w); err != nil {
		log.Printf("write acknowledgement: %v", err)
	}
}
```

## Worker

`Work` processes stored webhooks one at a time and is safe to run in several goroutines or processes:

- **Lock:** a worker claims a row by setting `locked_until`; a crashed worker's claim expires after `lockFor`.
- **Idempotent:** the order is only marked paid while `paid_at IS NULL`, so a retried or duplicated webhook never fulfills twice.
- **Retries:** a failure keeps `last_error` and waits `backoff` before the next attempt, up to `maxAttempts`.

```go
const (
	maxAttempts = 5
	lockFor     = 2 * time.Minute
)

// backoff is the wait before each retry.
var backoff = []time.Duration{
	10 * time.Second, time.Minute, 5 * time.Minute, 15 * time.Minute,
}

// Work processes stored webhooks until ctx is canceled. It is safe to run
// in several goroutines or processes.
func (h *Webhooks) Work(ctx context.Context) {
	for ctx.Err() == nil {
		found, err := h.processNext(ctx)
		if err != nil {
			log.Printf("payment webhooks: %v", err)
		}
		if !found || err != nil {
			select {
			case <-ctx.Done():
			case <-time.After(2 * time.Second):
			}
		}
	}
}

type webhook struct {
	ID               int64
	OrderID          string
	Status           myanmarpayments.PaymentStatus
	GatewayReference string
	Amount           string
	Attempts         int
}

func (h *Webhooks) processNext(ctx context.Context) (bool, error) {
	now := time.Now().Unix()

	var wh webhook
	var status string
	err := h.DB.QueryRowContext(ctx, `SELECT
		id, order_id, status, gateway_reference, amount, attempts
		FROM payment_webhooks
		WHERE verified = 1 AND processed_at IS NULL
		  AND attempts < ? AND available_at <= ?
		  AND (locked_until IS NULL OR locked_until < ?)
		ORDER BY id LIMIT 1`, maxAttempts, now, now).
		Scan(&wh.ID, &wh.OrderID, &status, &wh.GatewayReference,
			&wh.Amount, &wh.Attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	wh.Status = myanmarpayments.PaymentStatus(status)

	// Claim the row; a worker that read it at the same time affects 0 rows
	// and moves on.
	res, err := h.DB.ExecContext(ctx, `UPDATE payment_webhooks
		SET locked_until = ?, attempts = attempts + 1
		WHERE id = ? AND processed_at IS NULL
		  AND (locked_until IS NULL OR locked_until < ?)`,
		now+int64(lockFor.Seconds()), wh.ID, now)
	if err != nil {
		return true, err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return true, nil
	}

	if err := h.fulfill(ctx, wh); err != nil {
		delay := backoff[min(wh.Attempts, len(backoff)-1)]
		_, dbErr := h.DB.ExecContext(ctx, `UPDATE payment_webhooks
			SET last_error = ?, available_at = ?, locked_until = NULL
			WHERE id = ?`,
			err.Error(), time.Now().Add(delay).Unix(), wh.ID)
		return true, dbErr
	}

	_, err = h.DB.ExecContext(ctx, `UPDATE payment_webhooks
		SET processed_at = ?, last_error = NULL, locked_until = NULL
		WHERE id = ?`,
		time.Now().Unix(), wh.ID)
	return true, err
}

func (h *Webhooks) fulfill(ctx context.Context, wh webhook) error {
	if wh.Status != myanmarpayments.StatusSuccessful {
		return nil // record failures, cancellations, ... as your app needs
	}

	var amount string
	var paidAt sql.NullInt64
	err := h.DB.QueryRowContext(ctx,
		`SELECT amount, paid_at FROM orders WHERE number = ?`, wh.OrderID,
	).Scan(&amount, &paidAt)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("order %s not found", wh.OrderID)
	}
	if err != nil {
		return err
	}
	if paidAt.Valid {
		return nil // already fulfilled by an earlier webhook
	}
	if normalizeAmount(wh.Amount) != normalizeAmount(amount) {
		return fmt.Errorf("paid %s, expected %s for order %s",
			wh.Amount, amount, wh.OrderID)
	}

	// The paid_at IS NULL condition keeps this idempotent even if two
	// webhooks for one order run at once.
	_, err = h.DB.ExecContext(ctx, `UPDATE orders
		SET paid_at = ?, gateway_reference = ?
		WHERE number = ? AND paid_at IS NULL`,
		time.Now().Unix(), wh.GatewayReference, wh.OrderID)
	return err
}

// normalizeAmount makes "1000", "1000.0" and "1000.00" compare equal.
func normalizeAmount(amount string) string {
	if strings.Contains(amount, ".") {
		return strings.TrimRight(strings.TrimRight(amount, "0"), ".")
	}
	return amount
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as a decimal string, and nullable `paid_at` and `gateway_reference`.

## Wiring It Up

```go
kbz, err := kbzpay.New(kbzpay.ConfigFromEnv(os.Getenv), nil)
if err != nil {
	log.Fatal(err)
}
wave, err := wavemoney.New(wavemoney.ConfigFromEnv(os.Getenv), nil)
if err != nil {
	log.Fatal(err)
}

webhooks := &Webhooks{
	DB:       db,
	Gateways: map[string]Verifier{"kbz-pay": kbz, "wave-money": wave},
}

mux := http.NewServeMux()
mux.HandleFunc("POST /webhooks/payments/{gateway}", webhooks.Handle)

go webhooks.Work(ctx)
```

Use `https://shop.test/webhooks/payments/kbz-pay` (and so on) as each gateway's callback URL.

## Replay and Prune

A row that ran out of attempts keeps `last_error` and `processed_at IS NULL`. After fixing the cause, make it available again and a worker picks it up:

```sql
UPDATE payment_webhooks
SET attempts = 0, available_at = 0, last_error = NULL
WHERE id = 42;
```

Delete old processed and rejected rows once a day; failed rows stay until you replay or delete them:

```go
cutoff := time.Now().AddDate(0, 0, -90).Unix()
_, err := db.ExecContext(ctx, `DELETE FROM payment_webhooks
	WHERE created_at < ? AND (processed_at IS NOT NULL OR verified = 0)`,
	cutoff)
```
