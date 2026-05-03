/**
 * Calls the Supabase Edge Function `create-checkout-session`, which creates
 * a Stripe Checkout Session server-side and returns a URL we redirect to.
 *
 * The function accepts one of three shapes in `payload`:
 *   { kind: "tickets", event_id, quantity }
 *   { kind: "raffle",  event_id, quantity }      // £1 each
 *   { kind: "hundred_club", tier: "monthly" | "annual" }
 */
import { supabase, getStoredSession } from "./supabase.js";

export async function startCheckout(payload) {
  const session = getStoredSession();
  const accessToken = session?.access_token;

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      ...payload,
      success_url: `${location.origin}/thank-you.html?kind=${payload.kind}`,
      cancel_url: location.href,
    },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Checkout session did not return a URL.");
  window.location.href = data.url;
}

