/**
 * Authentication helpers — wraps Supabase Auth.
 * Uses magic-link email sign-in (no passwords to manage).
 */
import { supabase, $ } from "./supabase.js";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithEmail(email, redirectTo = `${location.origin}/account.html`) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      // Tag the user as a UKTTBS signup so the DB trigger creates a ukttbs.profiles row.
      data: { app: "ukttbs" },
    },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
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
