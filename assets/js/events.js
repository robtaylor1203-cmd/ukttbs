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

  return `
    <article class="event-card reveal" data-event-id="${ev.id}">
      <div class="event-card__date" aria-hidden="true">
        <span class="day">${day}</span>
        <span class="month">${month}</span>
      </div>
      <div>
        <h3 style="margin-bottom:.25rem">${escape(ev.title)}</h3>
        <div class="event-card__meta">
          <span>${formatEventDate(start)}</span>
          <span>${escape([ev.venue, ev.city].filter(Boolean).join(", "))}</span>
        </div>
        <p class="mt-1 muted" style="margin-bottom:0">${escape(ev.description || "")}</p>
        <p class="mt-2" style="margin-bottom:0">
          <strong>${formatMoney(ev.ticket_price_pence)}</strong>
          <span class="muted">per ticket</span>
        </p>
      </div>
      <div class="stack gap-1" style="min-width:200px">
        <div class="stepper" role="group" aria-label="Quantity">
          <button type="button" data-dec aria-label="Decrease">−</button>
          <input type="number" min="1" max="10" value="1" data-qty inputmode="numeric">
          <button type="button" data-inc aria-label="Increase">+</button>
        </div>
        <button class="btn btn--block" data-buy-tickets ${soldOut ? "disabled" : ""}>
          ${soldOut ? "Sold out" : "Buy tickets"}
        </button>
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
