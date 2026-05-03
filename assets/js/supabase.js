/**
 * Supabase client initialisation and small helpers used across the site.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.UKTTBS_CONFIG || {};

// IMPORTANT: This Supabase project is shared with another app, so all
// UKTTBS tables live in a dedicated `ukttbs` Postgres schema. Pinning
// the client here ensures we can never accidentally read/write the
// other project's `public` tables.
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  db: { schema: "ukttbs" },
});

/** Format a Date (or ISO string) as e.g. "Sat 14 March 2026, 7:00pm". */
export function formatEventDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d).toLowerCase().replace(/\s/g, "");
  return `${date}, ${time}`;
}

export function formatMoney(pence, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format((pence || 0) / 100);
}

/** Tiny DOM helper. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
