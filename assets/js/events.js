/**
 * Events page: loads upcoming events from Supabase and renders purchase cards.
 */
import { supabase, formatEventDate, formatMoney, $, $$ } from "./supabase.js";
import { startCheckout } from "./checkout.js";

const list = document.querySelector("[data-events-list]");
const emptyState = document.querySelector("[data-events-empty]");

async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, starts_at, ends_at, venue, city, ticket_price_pence, tickets_available, image_url, status")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="alert alert--error">Couldn't load events: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    emptyState?.classList.remove("hidden");
    return;
  }

  list.innerHTML = data.map(renderEvent).join("");
  $$("[data-buy-tickets]", list).forEach(bindBuy);
}

function renderEvent(ev) {
  const start = new Date(ev.starts_at);
  const day = start.getDate();
  const month = start.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const soldOut = ev.tickets_available !== null && ev.tickets_available <= 0;
  const remaining = (ev.tickets_available !== null && ev.tickets_available !== undefined)
    ? ev.tickets_available
    : null;

  return `
    <article class="event-card" data-event-id="${ev.id}" style="
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 2.5rem;
      align-items: center;
      padding: 2.5rem 2.5rem;
      margin-bottom: 1.25rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(201,169,110,0.04) 0%, rgba(0,0,0,0) 100%);
      transition: border-color .3s, transform .3s;
    ">
      <!-- DATE BADGE -->
      <div aria-hidden="true" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 96px;
        padding: 1.25rem 1rem;
        border: 1px solid rgba(201,169,110,0.3);
        border-radius: 10px;
        background: rgba(201,169,110,0.05);
      ">
        <span style="font-size: 2.25rem; font-weight: 800; color: #fff; line-height: 1;">${day}</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #c9a96e; letter-spacing: 0.15em; margin-top: 0.35rem;">${month}</span>
      </div>

      <!-- DETAILS -->
      <div>
        <h3 style="font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.02em;">
          ${escape(ev.title)}
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; color: rgba(255,255,255,0.55); font-size: 0.9rem; margin-bottom: 0.75rem;">
          <span><i class="ri-time-line" style="color: #c9a96e; margin-right: 0.35rem;"></i>${formatEventDate(start)}</span>
          ${(ev.venue || ev.city) ? `<span><i class="ri-map-pin-line" style="color: #c9a96e; margin-right: 0.35rem;"></i>${escape([ev.venue, ev.city].filter(Boolean).join(", "))}</span>` : ""}
        </div>
        ${ev.description ? `<p style="color: rgba(255,255,255,0.55); font-weight: 300; line-height: 1.6; font-size: 0.95rem; margin: 0 0 1rem; max-width: 540px;">${escape(ev.description)}</p>` : ""}
        <div style="display: flex; align-items: baseline; gap: 0.4rem;">
          <span style="font-size: 1.5rem; font-weight: 800; color: #c9a96e; line-height: 1;">${formatMoney(ev.ticket_price_pence)}</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; text-transform: uppercase;">per ticket</span>
          ${remaining !== null && remaining > 0 && remaining <= 20 ? `<span style="margin-left: 0.75rem; font-size: 0.75rem; color: #ffb74d;"><i class="ri-fire-line"></i> Only ${remaining} left</span>` : ""}
        </div>
      </div>

      <!-- BUY BLOCK -->
      <div style="min-width: 220px; display: flex; flex-direction: column; gap: 0.85rem;">
        <div role="group" aria-label="Quantity" style="
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          align-items: stretch;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 50px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
        ">
          <button type="button" data-dec aria-label="Decrease" style="background: transparent; border: 0; color: #c9a96e; font-size: 1.25rem; cursor: pointer; font-weight: 700;">−</button>
          <input type="number" min="1" max="10" value="1" data-qty inputmode="numeric" style="background: transparent; border: 0; text-align: center; color: #fff; font-size: 1rem; font-weight: 600; outline: none;">
          <button type="button" data-inc aria-label="Increase" style="background: transparent; border: 0; color: #c9a96e; font-size: 1.25rem; cursor: pointer; font-weight: 700;">+</button>
        </div>
        <button data-buy-tickets ${soldOut ? "disabled" : ""} style="
          padding: 1rem 1.5rem;
          border: 0;
          border-radius: 50px;
          background: ${soldOut ? "rgba(255,255,255,0.08)" : "#c9a96e"};
          color: ${soldOut ? "rgba(255,255,255,0.4)" : "#000"};
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          cursor: ${soldOut ? "not-allowed" : "pointer"};
          transition: opacity .3s, transform .3s;
        ">
          ${soldOut ? "Sold out" : "Buy tickets"}
        </button>
        <span style="text-align: center; font-size: 0.7rem; color: rgba(255,255,255,0.35); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase;">
          <i class="ri-lock-line"></i> Secure checkout
        </span>
      </div>
    </article>
  `;
}

function bindBuy(button) {
  const card = button.closest("[data-event-id]");
  const qtyInput = card.querySelector("[data-qty]");
  card.querySelector("[data-inc]").addEventListener("click", () => {
    qtyInput.value = Math.min(10, Number(qtyInput.value || 1) + 1);
  });
  card.querySelector("[data-dec]").addEventListener("click", () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value || 1) - 1);
  });
  button.addEventListener("click", async () => {
    const eventId = card.dataset.eventId;
    const quantity = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Redirecting…";
    try {
      await startCheckout({ kind: "tickets", event_id: eventId, quantity });
    } catch (err) {
      button.disabled = false;
      button.textContent = original;
      alert(err.message || "Something went wrong. Please try again.");
    }
  });
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (list) loadEvents();
