/**
 * Raffle page: shows the current/next raffle window and lets users buy £1 tickets.
 *
 * Rules (configurable in config.js):
 *   - Opens N hours before the event start (default: 7 days).
 *   - Closes N hours after event start (default: 4h — i.e. during the event itself).
 *   - Outside these windows, the UI shows a countdown / "not yet open".
 */
import { supabase, formatEventDate, $ } from "./supabase.js";
import { startCheckout } from "./checkout.js";

const cfg = window.UKTTBS_CONFIG?.RAFFLE_WINDOW ?? { opensHoursBefore: 168, closesHoursAfterStart: 4 };
const mount = document.querySelector("[data-raffle]");

const HOUR = 60 * 60 * 1000;

async function load() {
  // Next event with a raffle enabled.
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, starts_at, raffle_enabled, raffle_entries_count")
    .eq("status", "published")
    .eq("raffle_enabled", true)
    .gte("starts_at", new Date(Date.now() - cfg.closesHoursAfterStart * HOUR).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);

  if (error) {
    mount.innerHTML = `<div class="alert alert--error">Couldn't load the raffle: ${error.message}</div>`;
    return;
  }

  const ev = events?.[0];
  if (!ev) {
    mount.innerHTML = `
      <div class="raffle center">
        <span class="pill">No raffle running</span>
        <h3 class="mt-2">There isn't a raffle open right now</h3>
        <p class="muted">The raffle opens one week before each of our events. Check the <a href="/events.html">events page</a> for what's next.</p>
      </div>`;
    return;
  }

  render(ev);
}

function render(ev) {
  const start = new Date(ev.starts_at);
  const opensAt = new Date(start.getTime() - cfg.opensHoursBefore * HOUR);
  const closesAt = new Date(start.getTime() + cfg.closesHoursAfterStart * HOUR);
  const now = new Date();

  const isOpen = now >= opensAt && now < closesAt;
  const isLive = now >= start && now < closesAt;

  let statusHTML;
  if (isLive) statusHTML = `<span class="pill pill--live">Live at the event</span>`;
  else if (isOpen) statusHTML = `<span class="pill">Raffle open</span>`;
  else statusHTML = `<span class="pill" style="background:var(--ink-100);color:var(--ink-700)">Opens soon</span>`;

  mount.innerHTML = `
    <div class="raffle">
      <div class="raffle__status">
        ${statusHTML}
        <span class="muted">for ${escape(ev.title)}</span>
      </div>
      <h3 style="margin-bottom:.25rem">Win great prizes — support the Society</h3>
      <p class="muted">Event: ${formatEventDate(start)}</p>

      <div class="grid grid--2 mt-2" style="align-items:end">
        <div>
          <p class="muted mb-0" style="font-size:.85rem">Tickets sold so far</p>
          <div class="raffle__total" data-total>${ev.raffle_entries_count ?? 0}</div>
          <p class="muted" style="font-size:.85rem">Every ticket is <strong>£1</strong>. Winners are drawn at the event.</p>
        </div>
        <div class="stack">
          <label class="field">
            <span>How many tickets?</span>
            <div class="stepper" role="group" aria-label="Quantity">
              <button type="button" data-dec aria-label="Decrease">−</button>
              <input type="number" min="1" max="100" value="5" data-qty inputmode="numeric">
              <button type="button" data-inc aria-label="Increase">+</button>
            </div>
          </label>
          <button class="btn btn--lg btn--block" data-buy ${!isOpen ? "disabled" : ""}>
            ${isOpen ? "Buy raffle tickets" : "Raffle not yet open"}
          </button>
          ${!isOpen ? `<p class="muted" style="font-size:.85rem">Opens ${formatEventDate(opensAt)}</p>` : ""}
        </div>
      </div>
    </div>
  `;

  const qty = mount.querySelector("[data-qty]");
  mount.querySelector("[data-inc]").addEventListener("click", () => {
    qty.value = Math.min(100, Number(qty.value || 1) + 1);
  });
  mount.querySelector("[data-dec]").addEventListener("click", () => {
    qty.value = Math.max(1, Number(qty.value || 1) - 1);
  });

  const btn = mount.querySelector("[data-buy]");
  if (btn && isOpen) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Redirecting…";
      try {
        await startCheckout({
          kind: "raffle",
          event_id: ev.id,
          quantity: Math.max(1, Math.min(100, Number(qty.value) || 1)),
        });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = original;
        alert(e.message || "Something went wrong — please try again.");
      }
    });
  }
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (mount) load();
