// supabase/functions/create-checkout-session/index.ts
//
// Creates a Stripe Checkout Session for:
//   - event tickets       (kind: "tickets",      event_id, quantity)
//   - raffle tickets £1ea (kind: "raffle",       event_id, quantity)
//   - 100 Club subs       (kind: "hundred_club", tier: "monthly" | "annual")
//
// Deploy:
//   supabase functions deploy create-checkout-session --no-verify-jwt
// Set secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set HUNDRED_CLUB_MONTHLY_PRICE_ID=price_...
//   supabase secrets set HUNDRED_CLUB_ANNUAL_PRICE_ID=price_...
//   supabase secrets set SITE_URL=https://ukttbs.org.uk
//
// Raffle uses a price of £1 created on-the-fly (price_data), no Stripe Price
// object needed.

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { kind, success_url, cancel_url } = body;

    // Best-effort: resolve signed-in user (not required for guest checkout).
    let userId: string | null = null;
    let email: string | undefined;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
        db: { schema: "ukttbs" },
      });
      const { data } = await sb.auth.getUser();
      if (data.user) {
        userId = data.user.id;
        email = data.user.email ?? undefined;
      }

      // Hard-stop: only UKTTBS members may create checkout sessions.
      // (auth.users is shared with another app on this Supabase project.)
      if (userId) {
        const { data: profile } = await sb
          .from("profiles")
          .select("id, is_ukttbs_member")
          .eq("id", userId)
          .maybeSingle();
        if (!profile || !profile.is_ukttbs_member) {
          return new Response(
            JSON.stringify({ error: "This account is not a UKTTBS member." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Admin (service-role) client for writes — pinned to ukttbs schema.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "ukttbs" } }
    );

    let session: Stripe.Checkout.Session;

    if (kind === "tickets" || kind === "raffle") {
      const { event_id, quantity } = body;
      const qty = Math.max(1, Math.min(kind === "raffle" ? 100 : 10, Number(quantity) || 1));

      const { data: ev, error } = await admin
        .from("events")
        .select("id, title, ticket_price_pence, stripe_ticket_price_id, stripe_raffle_price_id, raffle_enabled, tickets_available, status")
        .eq("id", event_id)
        .single();
      if (error || !ev) throw new Error("Event not found");
      if (ev.status !== "published") throw new Error("Event is not published");
      if (kind === "raffle" && !ev.raffle_enabled) throw new Error("Raffle not enabled for this event");

      const unitPence = kind === "tickets" ? ev.ticket_price_pence : 100;

      // Create a pending order row
      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert({
          user_id: userId,
          email: email ?? "pending@ukttbs.org.uk",
          kind,
          event_id: ev.id,
          quantity: qty,
          amount_pence: unitPence * qty,
          status: "pending",
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [
          {
            quantity: qty,
            price_data: {
              currency: "gbp",
              unit_amount: unitPence,
              product_data: {
                name: kind === "tickets" ? `${ev.title} — Ticket` : `${ev.title} — Raffle ticket`,
              },
            },
          },
        ],
        success_url,
        cancel_url,
        metadata: { order_id: order.id, kind, event_id: ev.id, user_id: userId ?? "" },
        payment_intent_data: {
          metadata: { order_id: order.id, kind, event_id: ev.id, user_id: userId ?? "" },
        },
      });

      await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    } else if (kind === "hundred_club") {
      const tier = body.tier === "annual" ? "annual" : "monthly";
      const price = tier === "annual"
        ? Deno.env.get("HUNDRED_CLUB_ANNUAL_PRICE_ID")
        : Deno.env.get("HUNDRED_CLUB_MONTHLY_PRICE_ID");
      if (!price) throw new Error("100 Club price not configured");

      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email,
        line_items: [{ price, quantity: 1 }],
        success_url,
        cancel_url,
        metadata: { kind, tier, user_id: userId ?? "" },
        subscription_data: {
          metadata: { kind, tier, user_id: userId ?? "" },
        },
        allow_promotion_codes: true,
      });

    } else {
      throw new Error(`Unknown checkout kind: ${kind}`);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
