// supabase/functions/stripe-webhook/index.ts
//
// Receives Stripe webhooks, marks orders paid, allocates raffle ticket
// numbers, and upserts 100 Club subscriptions.
//
// Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Set secrets:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Then in Stripe Dashboard add endpoint:
//   https://<project>.supabase.co/functions/v1/stripe-webhook
// Events to listen for:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, whSecret);
  } catch (e) {
    return new Response(`Webhook signature failed: ${(e as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object as Stripe.Subscription);
        break;
    }
    return new Response("ok");
  } catch (e) {
    console.error("Webhook handler error", e);
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind;
  const userId = session.metadata?.user_id || null;
  const email = session.customer_details?.email || session.customer_email || "unknown@ukttbs.org.uk";

  if (kind === "tickets" || kind === "raffle") {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;

    await admin
      .from("orders")
      .update({
        status: "paid",
        email,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", orderId);

    if (kind === "raffle") {
      const eventId = session.metadata?.event_id;
      const { data: order } = await admin.from("orders").select("quantity, user_id").eq("id", orderId).single();
      if (order && eventId) {
        // Allocate sequential ticket numbers
        const { data: next } = await admin.rpc("next_raffle_ticket_number", { p_event: eventId });
        const start = Number(next) || 1;
        const rows = Array.from({ length: order.quantity }, (_, i) => ({
          event_id: eventId,
          order_id: orderId,
          user_id: order.user_id,
          email,
          ticket_number: start + i,
        }));
        await admin.from("raffle_entries").insert(rows);

        // Update denormalised count
        const { count } = await admin
          .from("raffle_entries")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);
        await admin.from("events").update({ raffle_entries_count: count ?? 0 }).eq("id", eventId);
      }
    }
  } else if (kind === "hundred_club") {
    // Subscription events will follow shortly — just ensure the profile has the customer id.
    if (userId && session.customer && typeof session.customer === "string") {
      await admin.from("profiles").update({ stripe_customer_id: session.customer }).eq("id", userId);
    }
  }
}

async function handleSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id || null;
  const tier = (sub.metadata?.tier === "annual" ? "annual" : "monthly") as "monthly" | "annual";

  // If no user_id in metadata, try to match via stripe_customer_id
  let resolvedUserId = userId;
  if (!resolvedUserId && typeof sub.customer === "string") {
    const { data: p } = await admin.from("profiles").select("id").eq("stripe_customer_id", sub.customer).maybeSingle();
    resolvedUserId = p?.id ?? null;
  }
  if (!resolvedUserId) {
    console.warn("No user for subscription", sub.id);
    return;
  }

  let portalUrl: string | null = null;
  try {
    if (typeof sub.customer === "string") {
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.customer,
        return_url: `${Deno.env.get("SITE_URL") ?? "https://ukttbs.org.uk"}/account.html`,
      });
      portalUrl = portal.url;
    }
  } catch (_) { /* portal config may not be set yet */ }

  await admin.from("subscriptions").upsert(
    {
      user_id: resolvedUserId,
      tier,
      status: sub.status,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
      stripe_subscription_id: sub.id,
      stripe_customer_portal_url: portalUrl,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
}
