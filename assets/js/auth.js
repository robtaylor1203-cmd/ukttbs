/**
 * Authentication helpers for non-account pages (admin, checkout return, etc.)
 *
 * NOTE: account.html owns the primary sign-in flow and writes our self-managed
 * session via direct REST. These helpers are read-only conveniences — they
 * never call into supabase.auth.* (GoTrueClient is dormant; see supabase.js).
 */
import { supabase, $, getStoredSession, clearStoredSession } from "./supabase.js";

export async function getSession() {
  return getStoredSession();
}

export async function signInWithEmail(email, redirectTo = `${location.origin}/account.html`) {
  // Magic-link via direct REST. We only use this on legacy mount points; the
  // canonical sign-in path is the password form on account.html.
  const cfg = window.UKTTBS_CONFIG || {};
  return fetch(`${cfg.SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      create_user: true,
      data: { app: "ukttbs" },
      options: { emailRedirectTo: redirectTo },
    }),
  });
}

export async function signOut() {
  const session = getStoredSession();
  const cfg = window.UKTTBS_CONFIG || {};
  if (session) {
    try {
      fetch(`${cfg.SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => {});
    } catch (_) { /* ignore */ }
  }
  clearStoredSession();
  location.href = "/";
}

/** Renders a basic sign-in form at the mount point. */
export function mountSignIn(mount) {
  mount.innerHTML = `
    <form class="stack" data-signin>
      <div class="field">
        <label for="auth-email">Email address</label>
        <input class="input" id="auth-email" type="email" autocomplete="email" required>
      </div>
      <button class="btn btn--lg btn--block" type="submit">Send sign-in link</button>
      <p class="muted" style="font-size:.88rem">
        We'll email you a secure link — no password needed. If you already have an account, just use the same email.
      </p>
      <div class="alert alert--info hidden" data-msg></div>
    </form>
  `;
  const form = mount.querySelector("[data-signin]");
  const msg = mount.querySelector("[data-msg]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.querySelector("#auth-email").value.trim();
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Sending…";
    const { error } = await signInWithEmail(email);
    btn.disabled = false;
    btn.textContent = "Send sign-in link";
    msg.classList.remove("hidden", "alert--error", "alert--success");
    if (error) {
      msg.classList.add("alert--error");
      msg.textContent = error.message;
    } else {
      msg.classList.add("alert--success");
      msg.textContent = `Check ${email} for your sign-in link.`;
    }
  });
}
