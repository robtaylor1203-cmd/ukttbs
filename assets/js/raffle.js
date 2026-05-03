/**
 * Raffle page: shows a card for every upcoming raffle-enabled event
 * (typically the next Spring + Autumn cocktail parties) and lets users
 * buy £1 tickets via the shared purchase modal.
 *
 * Deep link: ?event=<slug> auto-opens the modal pre-filled to that event,
 * so QR codes around a venue can drop scanners straight into checkout.
 *
 * Window rules (configurable in config.js):
 *   - Opens N hours before the event start (default: 7 days = 168h).
 *   - Closes N hours after event start (default: 4h — i.e. during the event).
 */
import { supabase, formatEventDate } from "./supabase.js";
import { startCheckout } from "./checkout.js";

const cfg = window.UKTTBS_CONFIG?.RAFFLE_WINDOW ?? { opensHoursBefore: 168, closesHoursAfterStart: 4 };
const HOUR = 60 * 60 * 1000;
const mount = document.querySelector("[data-raffle]");

async function load() {
  if (!mount) return;

  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, title, description, starts_at, raffle_enabled, raffle_entries_count")
    .eq("status", "published")
    .eq("raffle_enabled", true)
    .gte("starts_at", new Date(Date.now() - cfg.closesHoursAfterStart * HOUR).toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    mount.innerHTML = `<div class="alert alert--error" style="padding:1.5rem;background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);border-radius:8px;color:#fff;">Couldn't load the raffle: ${esc(error.message)}</div>`;
    return;
  }

  if (!events || !events.length) {
    mount.innerHTML = `
      <div style="text-align:center; padding: 3rem 2rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
        <span style="display:inline-block; padding: 0.4rem 0.9rem; background: rgba(255,255,255,0.06); border-radius: 50px; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 1.5rem;">No raffle running</span>
        <h3 style="margin: 0 0 1rem; font-size: 1.5rem; color: #fff;">There isn't a raffle open right now</h3>
        <p style="color: rgba(255,255,255,0.5); margin: 0;">Our raffles run alongside the <a href="/events.html" style="color:#c9a96e;">Spring &amp; Autumn cocktail parties</a>. Tickets open one week before each event.</p>
      </div>`;
    return;
  }

  mount.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
      ${events.map((ev) => renderCard(ev)).join("")}
    </div>
  `;

  // Wire up buttons.
  events.forEach((ev) => {
    const btn = mount.querySelector(`[data-open-buy="${ev.id}"]`);
    if (btn) btn.addEventListener("click", () => openModal(ev));
  });

  wireModal();

  // Deep link: ?event=<slug>
  const params = new URLSearchParams(location.search);
  const wantSlug = params.get("event");
  if (wantSlug) {
    const target = events.find((e) => e.slug === wantSlug);
    if (target) openModal(target);
  }
}

function renderCard(ev) {
  const start = new Date(ev.starts_at);
  const opensAt = new Date(start.getTime() - cfg.opensHoursBefore * HOUR);
  const closesAt = new Date(start.getTime() + cfg.closesHoursAfterStart * HOUR);
  const now = new Date();
  const isOpen = now >= opensAt && now < closesAt;
  const isLive = now >= start && now < closesAt;

  const pill = isLive
    ? `<span style="display:inline-block; padding: 0.3rem 0.8rem; background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.4); border-radius: 50px; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #a5d6a7;">Live now</span>`
    : isOpen
      ? `<span style="display:inline-block; padding: 0.3rem 0.8rem; background: rgba(201,169,110,0.15); border: 1px solid rgba(201,169,110,0.4); border-radius: 50px; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #c9a96e;">Tickets open</span>`
      : `<span style="display:inline-block; padding: 0.3rem 0.8rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 50px; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.5);">Opens ${formatEventDate(opensAt)}</span>`;

  return `
    <article style="padding: 2.5rem 2rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; display: flex; flex-direction: column; gap: 1rem;">
      ${pill}
      <h3 style="margin: 0.25rem 0 0; font-size: 1.6rem; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 1.2;">${esc(ev.title)}</h3>
      <p style="margin: 0; color: rgba(255,255,255,0.55); font-size: 0.9rem;">${formatEventDate(start)}</p>
      <p style="margin: 0; color: rgba(255,255,255,0.65); font-weight: 300; line-height: 1.7; font-size: 0.95rem; flex: 1;">${esc(ev.description ?? "Tickets £1 each. Drawn live on the night.")}</p>
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06);">
        <div>
          <div style="font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4);">Tickets sold</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; color: #c9a96e; font-weight: 600;">${ev.raffle_entries_count ?? 0}</div>
        </div>
        <button data-open-buy="${ev.id}" ${!isOpen ? "disabled" : ""} style="background: ${isOpen ? "#c9a96e" : "rgba(255,255,255,0.06)"}; color: ${isOpen ? "#000" : "rgba(255,255,255,0.4)"}; padding: 0.85rem 1.75rem; border: none; border-radius: 50px; text-transform: uppercase; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; cursor: ${isOpen ? "pointer" : "not-allowed"};">
          ${isOpen ? "Buy tickets" : "Not yet open"}
        </button>
      </div>
    </article>
  `;
}

// ── MODAL ────────────────────────────────────────────────────────────────
function openModal(ev) {
  document.getElementById("raffle-event-id").value = ev.id;
  document.getElementById("raffle-modal-title").textContent = ev.title;
  document.getElementById("raffle-modal-subtitle").textContent =
    `${formatEventDate(new Date(ev.starts_at))} · £1 per ticket`;
  document.getElementById("raffle-qty").value = 5;
  updateTotal();
  document.getElementById("raffle-modal-msg").style.display = "none";
  document.getElementById("modal-raffle").classList.add("active");
}

function updateTotal() {
  const qty = clampQty(Number(document.getElementById("raffle-qty").value) || 1);
  const total = (qty * 1).toFixed(2);
  document.getElementById("raffle-qty-display").textContent = qty;
  document.getElementById("raffle-total").textContent = "£" + total;
  const btn = document.getElementById("raffle-buy-btn");
  btn.textContent = `Buy ${qty} ticket${qty > 1 ? "s" : ""} — £${total}`;
  btn.disabled = false;
  btn.style.opacity = "1";
}

function clampQty(n) { return Math.max(1, Math.min(100, n | 0)); }

function wireModal() {
  const qtyInput = document.getElementById("raffle-qty");
  document.getElementById("raffle-qty-dec").addEventListener("click", () => {
    qtyInput.value = clampQty((Number(qtyInput.value) || 1) - 1);
    updateTotal();
  });
  document.getElementById("raffle-qty-inc").addEventListener("click", () => {
    qtyInput.value = clampQty((Number(qtyInput.value) || 1) + 1);
    updateTotal();
  });
  qtyInput.addEventListener("input", updateTotal);

  document.getElementById("raffle-buy-btn").addEventListener("click", buy);
}

async function buy() {
  const btn = document.getElementById("raffle-buy-btn");
  const msg = document.getElementById("raffle-modal-msg");
  const eventId = document.getElementById("raffle-event-id").value;
  const qty = clampQty(Number(document.getElementById("raffle-qty").value) || 1);
  if (!eventId) return;

  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.textContent = "Redirecting to checkout…";
  msg.style.display = "none";

  try {
    await startCheckout({ kind: "raffle", event_id: eventId, quantity: qty });
  } catch (e) {
    btn.disabled = false;
    btn.style.opacity = "1";
    updateTotal();
    msg.textContent = e?.message || "Something went wrong — please try again.";
    msg.style.color = "#ff8a8a";
    msg.style.display = "block";
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (mount) load();
