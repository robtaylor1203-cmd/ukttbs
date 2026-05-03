/**
 * Supabase client initialisation and small helpers used across the site.
 *
 * AUTH STRATEGY (deliberate, after extensive debugging):
 * We do NOT use supabase-js's GoTrueClient for sign-in / sign-out / session
 * persistence, because it has been observed to wedge on second login attempts
 * (lock/queue state machine never resolves). Instead, we:
 *   1. Hit the Supabase auth REST API directly with plain `fetch`.
 *   2. Store the resulting session in our own localStorage key.
 *   3. Construct the supabase-js client with the access token statically
 *      injected as an Authorization header — so all PostgREST queries from
 *      any page run as the signed-in user without ever touching GoTrue.
 *   4. Disable persistSession / autoRefreshToken / detectSessionInUrl so
 *      GoTrueClient is effectively dormant.
 *
 * On token expiry the user simply signs in again. (We can add silent refresh
 * later via direct REST to /auth/v1/token?grant_type=refresh_token.)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.UKTTBS_CONFIG || {};

export const UKTTBS_SESSION_KEY = "ukttbs.session";

/** Read our self-managed session from localStorage. Returns null if missing
 *  or expired. */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(UKTTBS_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.access_token || !s.user) return null;
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 5_000) {
      // Treat as expired (5s safety margin).
      return null;
    }
    return s;
  } catch (_) {
    return null;
  }
}

export function setStoredSession(session) {
  localStorage.setItem(UKTTBS_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(UKTTBS_SESSION_KEY);
  // Also wipe any lingering supabase-js managed keys from earlier code.
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.toLowerCase().includes("supabase"))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* ignore */ }
}

const stored = getStoredSession();

// IMPORTANT: This Supabase project is shared with another app, so all
// UKTTBS tables live in a dedicated `ukttbs` Postgres schema. Pinning
// the client here ensures we can never accidentally read/write the
// other project's `public` tables.
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: {
    // Keep GoTrueClient idle — we manage auth ourselves.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: { schema: "ukttbs" },
  global: stored
    ? { headers: { Authorization: `Bearer ${stored.access_token}` } }
    : {},
});

/** Convenience: the currently signed-in user (from our stored session), or
 *  null. Pages can use this without ever calling supabase.auth.* */
export const currentUser = stored ? stored.user : null;

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
