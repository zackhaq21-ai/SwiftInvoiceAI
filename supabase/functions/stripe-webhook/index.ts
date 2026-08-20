import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Swift Invoice AI',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const jsonResponse = (body: object | string, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return jsonResponse('Method not allowed', 405);
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return jsonResponse('No signature found', 400);
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Webhook signature verification failed: ${message}`);
      return jsonResponse(`Webhook signature verification failed`, 400);
    }

    // Idempotency: check if this event was already processed
    const { data: existingEvent } = await supabase
      .from('stripe_events')
      .select('stripe_event_id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      console.info(`Duplicate event ${event.id} — skipping`);
      return jsonResponse({ received: true, duplicate: true });
    }

    // Mark event as processed BEFORE handling to prevent race conditions
    const { error: insertErr } = await supabase
      .from('stripe_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
      });

    if (insertErr) {
      // Unique constraint violation means another instance processed it
      if (insertErr.code === '23505') {
        console.info(`Duplicate event ${event.id} caught by constraint — skipping`);
        return jsonResponse({ received: true, duplicate: true });
      }
      console.error('Failed to record event:', insertErr);
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};
  if (!stripeData || !('customer' in stripeData)) return;

  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  // Handle checkout session expiration — mark checkout locks as expired
  if (event.type === 'checkout.session.expired') {
    const session = stripeData as Stripe.Checkout.Session;
    const lockId = session.metadata?.checkout_lock_id;
    if (lockId) {
      const { error: lockExpireErr } = await supabase
        .from('checkout_locks')
        .update({ status: 'expired' })
        .eq('id', lockId);
      if (lockExpireErr) {
        console.error(`Failed to mark checkout lock ${lockId} as expired:`, lockExpireErr);
      } else {
        console.info(`Checkout lock ${lockId} marked as expired (session expired)`);
      }
    }
    return;
  }

  // Handle subscription lifecycle events
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = stripeData as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    if (!customerId) {
      console.error(`No customer on subscription event: ${event.id}`);
      return;
    }

    // Look up the user who owns this customer
    const { data: customerRow } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!customerRow?.user_id) {
      console.error(`No user found for customer ${customerId} on event ${event.id}`);
      return;
    }

    const periodEnd = subscription.current_period_end;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const subStatus = subscription.status;

    // Sync stripe_subscriptions table
    await supabase.from('stripe_subscriptions').upsert({
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: subscription.items.data[0]?.price.id ?? null,
      current_period_start: subscription.current_period_start,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      status: subStatus,
    }, { onConflict: 'customer_id' });

    // Update local subscriptions table from verified Stripe data
    if (event.type === 'customer.subscription.deleted') {
      // Subscription fully deleted — revert to free
      await supabase
        .from('subscriptions')
        .update({
          tier: 'free',
          status: 'cancelled',
          cancel_at_period_end: false,
          stripe_subscription_id: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', customerRow.user_id);

      await supabase.from('audit_logs').insert({
        user_id: customerRow.user_id,
        action: 'subscription_cancelled',
        entity_type: 'subscription',
        entity_id: subscription.id,
        details: { event_id: event.id },
      });
      console.info(`Subscription ${subscription.id} deleted for user ${customerRow.user_id} — reverted to free`);
    } else {
      // Subscription updated — sync cancel_at_period_end and period
      const newStatus = subStatus === 'active' ? 'active' : subStatus;
      await supabase
        .from('subscriptions')
        .update({
          status: newStatus,
          cancel_at_period_end: cancelAtPeriodEnd,
          stripe_subscription_id: subscription.id,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', customerRow.user_id);

      await supabase.from('audit_logs').insert({
        user_id: customerRow.user_id,
        action: cancelAtPeriodEnd ? 'subscription_cancel_scheduled' : 'subscription_updated',
        entity_type: 'subscription',
        entity_id: subscription.id,
        details: { status: subStatus, cancel_at_period_end: cancelAtPeriodEnd, event_id: event.id },
      });
      console.info(`Subscription ${subscription.id} updated for user ${customerRow.user_id} — cancel_at_period_end: ${cancelAtPeriodEnd}`);
    }
    return;
  }

  const { customer: customerId } = stripeData;
  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${event.id}`);
    return;
  }

  let isSubscription = true;

  if (event.type === 'checkout.session.completed') {
    const { mode } = stripeData as Stripe.Checkout.Session;
    isSubscription = mode === 'subscription';
    console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
  }

  const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

  if (isSubscription) {
    console.info(`Starting subscription sync for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId);

    const session = stripeData as Stripe.Checkout.Session;
    const plan = session.metadata?.plan || session.subscription_data?.metadata?.plan;

    // ============================================================
    // CHECKOUT LOCK RECONCILIATION: mark the lock as completed so
    // the user can start a new checkout later (e.g., upgrade again).
    // The lock_id is stored in the session metadata by the edge function.
    // ============================================================
    const lockId = session.metadata?.checkout_lock_id;
    if (lockId) {
      const { error: lockUpdateErr } = await supabase
        .from('checkout_locks')
        .update({ status: 'completed' })
        .eq('id', lockId);
      if (lockUpdateErr) {
        console.error(`Failed to mark checkout lock ${lockId} as completed:`, lockUpdateErr);
      } else {
        console.info(`Checkout lock ${lockId} marked as completed`);
      }
    }

    if (plan && ['pro', 'business', 'enterprise'].includes(plan)) {
      const { data: customerRow } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (customerRow?.user_id) {
        // ============================================================
        // DUPLICATE DETECTION: Check for multiple active subscriptions
        // across ALL Stripe customers mapped to this user. Log for admin
        // review but do NOT cancel or refund — safe detection only.
        // ============================================================
        await detectDuplicateSubscriptions(customerRow.user_id, customerId, event.id);

        const { error: tierError } = await supabase
          .from('subscriptions')
          .update({
            tier: plan,
            status: 'active',
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', customerRow.user_id);

        if (tierError) {
          console.error('Error updating subscription tier:', tierError);
        } else {
          console.info(`Updated subscription tier to ${plan} for user ${customerRow.user_id}`);
          // Audit log
          await supabase.from('audit_logs').insert({
            user_id: customerRow.user_id,
            action: 'subscription_activated',
            entity_type: 'subscription',
            entity_id: customerId,
            details: { plan, event_id: event.id },
          });
        }
      }
    }
  } else if (mode === 'payment' && payment_status === 'paid') {
    try {
      const {
        id: checkout_session_id,
        payment_intent,
        amount_total,
      } = stripeData as Stripe.Checkout.Session;

      const session = stripeData as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id;

      if (invoiceId) {
        const { data: dbInvoice, error: invLookupError } = await supabase
          .from('invoices')
          .select('id, total, payment_status, stripe_checkout_session_id, user_id')
          .eq('id', invoiceId)
          .maybeSingle();

        if (invLookupError || !dbInvoice) {
          console.error(`Invoice ${invoiceId} not found for session ${checkout_session_id}`);
          return;
        }

        if (dbInvoice.stripe_checkout_session_id !== checkout_session_id) {
          console.error(`Session ID mismatch for invoice ${invoiceId}`);
          return;
        }

        const expectedAmountCents = Math.round(Number(dbInvoice.total) * 100);
        if (amount_total !== expectedAmountCents) {
          console.error(`Amount mismatch for invoice ${invoiceId}: expected ${expectedAmountCents}, got ${amount_total}`);
          return;
        }

        if (dbInvoice.payment_status === 'paid') {
          console.info(`Invoice ${invoiceId} already paid — skipping`);
          return;
        }

        const { error: invUpdateError } = await supabase
          .from('invoices')
          .update({
            payment_status: 'paid',
            status: 'paid',
            stripe_payment_intent_id: typeof payment_intent === 'string' ? payment_intent : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (invUpdateError) {
          console.error('Error marking invoice as paid:', invUpdateError);
        } else {
          console.info(`Invoice ${invoiceId} marked as paid`);
          // Audit log
          await supabase.from('audit_logs').insert({
            user_id: dbInvoice.user_id,
            action: 'invoice_paid',
            entity_type: 'invoice',
            entity_id: invoiceId,
            details: { amount: amount_total, session_id: checkout_session_id, event_id: event.id },
          });
        }
      }
    } catch (error) {
      console.error('Error processing one-time payment:', error);
    }
  }
}

/**
 * Detects duplicate active subscriptions for a user by searching all Stripe
 * customers mapped to that user. Logs duplicates for admin review but does
 * NOT cancel, refund, or modify any subscription — safe detection only.
 */
async function detectDuplicateSubscriptions(userId: string, currentCustomerId: string, eventId: string) {
  try {
    const { data: customerRows } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!customerRows || customerRows.length === 0) return;

    const blockingStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);
    let activeCount = 0;
    const activeSubs: { customerId: string; subId: string; status: string }[] = [];

    for (const row of customerRows) {
      if (!row.customer_id) continue;
      const subs = await stripe.subscriptions.list({
        customer: row.customer_id,
        limit: 100,
        status: 'all',
      });
      for (const sub of subs.data) {
        if (blockingStatuses.has(sub.status) || (sub.status === 'active' && sub.cancel_at_period_end)) {
          activeCount++;
          activeSubs.push({ customerId: row.customer_id, subId: sub.id, status: sub.status });
        }
      }
    }

    if (activeCount > 1) {
      console.warn(
        `DUPLICATE SUBSCRIPTION DETECTED — user ${userId} has ${activeCount} active/trialing/past_due subscriptions. ` +
        `Subscriptions: ${JSON.stringify(activeSubs)}. ` +
        `Triggered by event ${eventId} for customer ${currentCustomerId}. ` +
        `No action taken — for admin review only.`
      );
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'duplicate_subscription_detected',
        entity_type: 'subscription',
        entity_id: currentCustomerId,
        details: {
          event_id: eventId,
          active_subscription_count: activeCount,
          subscriptions: activeSubs,
          note: 'No action taken — safe detection for admin review',
        },
      });
    }
  } catch (error) {
    console.error(`Error during duplicate subscription detection for user ${userId}:`, error);
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        { onConflict: 'customer_id' },
      );
      if (noSubError) console.error('Error updating subscription status:', noSubError);
      return;
    }

    const subscription = subscriptions.data[0];

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      { onConflict: 'customer_id' },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
    } else {
      console.info(`Successfully synced subscription for customer: ${customerId}`);
    }
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
  }
}
