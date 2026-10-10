---
title: Handling Webhooks (recommended)
description: The recommended way to handle gateway webhooks in a Laravel app - verify, store, acknowledge, then process once in a queued job with retries, a lock and replay.
---

# Handling Webhooks (recommended)

The package verifies a webhook and builds the acknowledgement; what you do with it lives in your app. The flow below is the one we recommend for production: it answers the gateway fast, never loses a notification, and fulfills each order exactly once even when the gateway retries.

1. **Verify** the webhook with `MyanmarPayments::handleCallback($gateway, $request)`.
2. **Store** the raw call in your own table, including rejected ones for debugging.
3. **Acknowledge** right away with `MyanmarPayments::acknowledge($callback)`, so the gateway stops retrying.
4. **Process once** in a queued job: skip what is already processed, lock the order, retry with backoff, keep the last error.

<SequenceDiagram
  title="Verify, store, acknowledge, process once"
  :participants="['Gateway', 'Your app', 'Queue worker']"
  :steps="[
    { from: 'Gateway', to: 'Your app', label: 'Webhook', detail: 'POST /webhooks/payments/{gateway}' },
    { from: 'Your app', to: 'Your app', label: 'Verify the signature', detail: 'handleCallback($request)' },
    { from: 'Your app', to: 'Gateway', label: 'Invalid: store as rejected, 400', detail: 'SignatureVerificationException', response: true },
    { from: 'Your app', to: 'Your app', label: 'Store the call', detail: 'PaymentWebhook::create()' },
    { from: 'Your app', to: 'Queue worker', label: 'Dispatch the job', detail: 'ProcessPaymentWebhook' },
    { from: 'Your app', to: 'Gateway', label: 'Acknowledge immediately', detail: 'acknowledge($callback)', response: true },
    { from: 'Queue worker', to: 'Queue worker', label: 'Lock the order, skip duplicates', detail: 'Cache::lock(), processed_at' },
    { from: 'Queue worker', to: 'Queue worker', label: 'Fulfill once, or retry with backoff', detail: 'tries, backoff(), last_error' },
  ]"
/>

None of this is part of the package: copy the code into your app and adapt the fulfillment to your own `Order` model. It needs a real queue (`QUEUE_CONNECTION=database`, `redis`, ...) and a cache store that supports [atomic locks](https://laravel.com/docs/cache#atomic-locks).

## Migration

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('gateway');
            $table->string('order_id')->nullable();
            $table->string('status')->nullable(); // PaymentStatus value
            $table->string('gateway_status')->nullable();
            $table->string('gateway_reference')->nullable();
            $table->string('amount')->nullable(); // as sent, never a float
            $table->boolean('verified');
            $table->longText('body'); // the raw request body
            $table->json('headers');
            $table->unsignedInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['gateway', 'order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhooks');
    }
};
```

## Model

`MassPrunable` deletes old processed and rejected rows; failed rows stay until you replay or delete them.

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;

class PaymentWebhook extends Model
{
    use MassPrunable;

    protected $guarded = [];

    protected $casts = [
        'status' => PaymentStatus::class,
        'verified' => 'boolean',
        'headers' => 'array',
        'processed_at' => 'datetime',
    ];

    public function prunable(): Builder
    {
        return static::query()
            ->where('created_at', '<', now()->subDays(90))
            ->where(fn (Builder $query) => $query
                ->whereNotNull('processed_at')
                ->orWhere('verified', false));
    }
}
```

## Route and Controller

One route serves every gateway. Gateways post from their own servers, so exclude it from CSRF verification.

```php
use App\Http\Controllers\PaymentWebhookController;

Route::post('/webhooks/payments/{gateway}', PaymentWebhookController::class)
    ->whereIn('gateway', [
        'kbz-pay', 'wave-money', 'aya-pay', 'yoma-mmqr', 'cyber-source',
    ])
    ->name('payments.webhook');
```

Use `route('payments.webhook', 'kbz-pay')` as the gateway's callback URL. The names are the ones `MyanmarPayments::gateways()` returns.

```php
namespace App\Http\Controllers;

use App\Jobs\ProcessPaymentWebhook;
use App\Models\PaymentWebhook;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laranex\LaravelMyanmarPayments\Facades\MyanmarPayments;
use Laranex\LaravelMyanmarPayments\Http\CallbackResponse;
use Laranex\PhpMyanmarPayments\Exceptions\SignatureVerificationException;

class PaymentWebhookController extends Controller
{
    public function __invoke(
        Request $request,
        string $gateway,
    ): Response|CallbackResponse {
        $raw = [
            'gateway' => $gateway,
            'body' => $request->getContent(),
            'headers' => $request->headers->all(),
        ];

        try {
            $callback = MyanmarPayments::handleCallback($gateway, $request);
        } catch (SignatureVerificationException $e) {
            PaymentWebhook::create($raw + [
                'verified' => false,
                'last_error' => $e->getMessage(),
            ]);

            return response('invalid signature', 400);
        }

        $webhook = PaymentWebhook::create($raw + [
            'verified' => true,
            'order_id' => $callback->orderId,
            'status' => $callback->status,
            'gateway_status' => $callback->gatewayStatus,
            'gateway_reference' => $callback->gatewayReference,
            'amount' => $callback->amount,
        ]);

        ProcessPaymentWebhook::dispatch($webhook);

        return MyanmarPayments::acknowledge($callback);
    }
}
```

## Job

The job is where the order is fulfilled. It is safe to run more than once:

- **Lock:** `Cache::lock()` lets one worker at a time process a given order.
- **Idempotent:** a row that is already processed, or another processed row with the same gateway, order and status, is skipped; the order itself is checked again inside a transaction.
- **Retries:** `$tries` and `backoff()` retry failures; every attempt is counted and the last error is kept.

```php
namespace App\Jobs;

use App\Models\Order;
use App\Models\PaymentWebhook;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laranex\PhpMyanmarPayments\Amount;
use Laranex\PhpMyanmarPayments\Enums\PaymentStatus;
use RuntimeException;
use Throwable;

class ProcessPaymentWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public function __construct(public PaymentWebhook $webhook) {}

    /**
     * Seconds to wait before each retry.
     *
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(): void
    {
        $key = "payment-webhook:{$this->webhook->gateway}"
            .":{$this->webhook->order_id}";

        // One worker per order at a time; waits up to 10 s, otherwise the
        // attempt fails and is retried.
        Cache::lock($key, 120)->block(10, fn () => $this->process());
    }

    private function process(): void
    {
        $webhook = $this->webhook->fresh();

        if ($webhook->processed_at !== null) {
            return; // already done, e.g. a replay
        }

        $webhook->increment('attempts');

        $alreadyProcessed = PaymentWebhook::query()
            ->whereKeyNot($webhook->getKey())
            ->where('gateway', $webhook->gateway)
            ->where('order_id', $webhook->order_id)
            ->where('status', $webhook->status)
            ->whereNotNull('processed_at')
            ->exists();

        try {
            if (! $alreadyProcessed) {
                $this->fulfill($webhook);
            }
        } catch (Throwable $e) {
            $webhook->update(['last_error' => $e->getMessage()]);

            throw $e; // the queue retries with backoff()
        }

        $webhook->update(['processed_at' => now(), 'last_error' => null]);
    }

    private function fulfill(PaymentWebhook $webhook): void
    {
        if ($webhook->status !== PaymentStatus::Successful) {
            return; // record failures, cancellations, ... as your app needs
        }

        DB::transaction(function () use ($webhook) {
            $order = Order::query()
                ->where('number', $webhook->order_id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($order->paid_at !== null) {
                return;
            }

            // Yoma MMQR's callback carries no amount; its amount was fixed
            // at checkout.
            if (
                $webhook->amount !== null
                && ! Amount::parse($order->amount)->equals($webhook->amount)
            ) {
                throw new RuntimeException(
                    "Paid {$webhook->amount}, expected {$order->amount}"
                    ." for order {$order->number}.",
                );
            }

            $order->update([
                'paid_at' => now(),
                'gateway_reference' => $webhook->gateway_reference,
            ]);
        });
    }

    public function failed(Throwable $e): void
    {
        $this->webhook->update(['last_error' => $e->getMessage()]);
    }
}
```

The sample assumes an `orders` table with a unique `number`, the `amount` as a decimal string, and nullable `paid_at` and `gateway_reference`.

## Replay and Prune

A failed row keeps `last_error` and `processed_at = null`. After fixing the cause, process it again; in `routes/console.php`:

```php
use App\Jobs\ProcessPaymentWebhook;
use App\Models\PaymentWebhook;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('payments:replay-webhook {id}', function (string $id) {
    $webhook = PaymentWebhook::query()
        ->where('verified', true)
        ->findOrFail($id);
    $webhook->update(['processed_at' => null]);

    ProcessPaymentWebhook::dispatch($webhook);

    $this->info("Replaying {$webhook->gateway} webhook {$webhook->id}"
        ." for order {$webhook->order_id}.");
})->purpose('Process a stored payment webhook again');

Schedule::command('model:prune', [
    '--model' => [PaymentWebhook::class],
])->daily();
```

On Laravel 10, schedule `model:prune` in `app/Console/Kernel.php` instead: `$schedule->command('model:prune', ['--model' => [PaymentWebhook::class]])->daily();`.

Find failed rows with `PaymentWebhook::whereNull('processed_at')->where('verified', true)->get()`, and rejected ones with `where('verified', false)`.

## Testing

Fake the queue to check that the webhook is stored and acknowledged, then run the job yourself:

```php
use App\Jobs\ProcessPaymentWebhook;
use App\Models\PaymentWebhook;
use Illuminate\Support\Facades\Queue;

it('stores, acknowledges and processes a webhook', function () {
    Queue::fake();

    $this->postJson('/webhooks/payments/wave-money', $signedWavePayload)
        ->assertOk();

    Queue::assertPushed(ProcessPaymentWebhook::class);

    (new ProcessPaymentWebhook(PaymentWebhook::sole()))->handle();

    expect(PaymentWebhook::sole()->processed_at)->not->toBeNull();
});
```

To send a signed payload, compute the gateway's signature in the test with the secret from your test configuration, as described on each gateway's page.
