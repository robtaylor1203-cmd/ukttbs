/**
 * Admin dashboard logic.
 *
 * Access control:
 *   Relies on an `admins` table (email text primary key) in Supabase.
 *   RLS must ALSO restrict the mutating operations — never trust the client.
 *   This JS is only a convenience gate.
 */
import { supabase, formatEventDate, formatMoney, $, $$ } from "./supabase.js";
import { mountSignIn, signOut, getSession } from "./auth.js";

const views = {
  signedOut: $("[data-view='signed-out']"),
  notAdmin:  $("[data-view='not-admin']"),
  admin:     $("[data-view='admin']"),
};

function show(view) {
  Object.values(views).forEach((v) => v?.classList.add("hidden"));
  views[view]?.classList.remove("hidden");
}

async function isAdmin(email) {
  if (!email) return false;
  const { data, error } = await supabase.from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
  if (error) { console.warn(error); return false; }
  return !!data;
}

async function init() {
  const session = await getSession();
  if (!session) { show("signedOut"); mountSignIn($("#signin-mount")); return; }

  const email = session.user.email;
  $("[data-email]").textContent = email;

  if (!(await isAdmin(email))) { show("notAdmin"); return; }

  show("admin");
  await Promise.all([loadEvents(), loadOrders(), loadSubscriptions()]);
}

/* ------------------------------ EVENTS ------------------------------ */
async function loadEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false });
  const list = $("[data-events]");
  if (error) { list.innerHTML = `<div class="alert alert--error">${error.message}</div>`; return; }
  if (!data.length) { list.innerHTML = `<p class="muted">No events yet.</p>`; return; }

  list.innerHTML = data.map(renderEventRow).join("");
  $$("[data-edit]",  list).forEach((b) => b.addEventListener("click", () => openEventDialog(data.find(e => e.id === b.dataset.edit))));
  $$("[data-publish]", list).forEach((b) => b.addEventListener("click", () => toggleStatus(b.dataset.publish, "published")));
  $$("[data-draft]",   list).forEach((b) => b.addEventListener("click", () => toggleStatus(b.dataset.draft,   "draft")));
  $$("[data-entries]", list).forEach((b) => b.addEventListener("click", () => openRaffleDialog(data.find(e => e.id === b.dataset.entries))));
}

function renderEventRow(ev) {
  const statusColor = ev.status === "published" ? "var(--success)" : ev.status === "archived" ? "var(--ink-500)" : "var(--gold-600)";
  return `
    <tr data-event-id="${ev.id}">
      <td>
        <strong>${esc(ev.title)}</strong>
        <div class="muted" style="font-size:.85rem">${formatEventDate(ev.starts_at)}</div>
      </td>
      <td>${formatMoney(ev.ticket_price_pence)}</td>
      <td>${ev.raffle_enabled ? `🎟 ${ev.raffle_entries_count ?? 0}` : "—"}</td>
      <td><span class="tag" style="color:${statusColor};border-color:${statusColor}">${ev.status}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn--ghost btn--sm" data-edit="${ev.id}"><span>Edit</span></button>
        ${ev.status === "published"
          ? `<button class="btn btn--ghost btn--sm" data-draft="${ev.id}"><span>Unpublish</span></button>`
          : `<button class="btn btn--sm" data-publish="${ev.id}"><span>Publish</span></button>`}
        ${ev.raffle_enabled ? `<button class="btn btn--ghost btn--sm" data-entries="${ev.id}"><span>Raffle</span></button>` : ""}
      </td>
    </tr>
  `;
}

async function toggleStatus(id, status) {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) alert(error.message); else loadEvents();
}

function openEventDialog(ev) {
  const dialog = $("#event-dialog");
  const isNew = !ev;
  ev = ev || {
    title: "", slug: "", description: "", venue: "", city: "London",
    starts_at: "", ends_at: "",
    ticket_price_pence: 7500, tickets_available: null,
    raffle_enabled: true, status: "draft", image_url: "",
  };
  dialog.querySelector("[data-title]").textContent = isNew ? "New event" : "Edit event";
  const form = dialog.querySelector("form");
  form.title.value = ev.title;
  form.slug.value = ev.slug || "";
  form.description.value = ev.description || "";
  form.venue.value = ev.venue || "";
  form.city.value = ev.city || "";
  form.starts_at.value = ev.starts_at ? toLocalInput(ev.starts_at) : "";
  form.ends_at.value   = ev.ends_at   ? toLocalInput(ev.ends_at)   : "";
  form.ticket_price.value = (ev.ticket_price_pence ?? 0) / 100;
  form.tickets_available.value = ev.tickets_available ?? "";
  form.raffle_enabled.checked = !!ev.raffle_enabled;
  form.image_url.value = ev.image_url || "";
  form.status.value = ev.status;
  form.dataset.eventId = ev.id || "";

  dialog.showModal();
}

async function saveEvent(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    title: form.title.value.trim(),
    slug: form.slug.value.trim() || slugify(form.title.value),
    description: form.description.value.trim() || null,
    venue: form.venue.value.trim() || null,
    city: form.city.value.trim() || null,
    starts_at: new Date(form.starts_at.value).toISOString(),
    ends_at: form.ends_at.value ? new Date(form.ends_at.value).toISOString() : null,
    ticket_price_pence: Math.round(Number(form.ticket_price.value) * 100),
    tickets_available: form.tickets_available.value === "" ? null : Number(form.tickets_available.value),
    raffle_enabled: form.raffle_enabled.checked,
    image_url: form.image_url.value.trim() || null,
    status: form.status.value,
  };
  const id = form.dataset.eventId;
  const q = id
    ? supabase.from("events").update(payload).eq("id", id)
    : supabase.from("events").insert(payload);
  const { error } = await q;
  if (error) { alert(error.message); return; }
  $("#event-dialog").close();
  loadEvents();
}

async function openRaffleDialog(ev) {
  const dialog = $("#raffle-dialog");
  dialog.querySelector("[data-title]").textContent = `Raffle — ${ev.title}`;
  const list = dialog.querySelector("[data-entries-list]");
  list.innerHTML = `<p class="muted">Loading entries…</p>`;
  dialog.showModal();

  const { data } = await supabase
    .from("raffle_entries")
    .select("ticket_number, email, created_at")
    .eq("event_id", ev.id)
    .order("ticket_number", { ascending: true });

  if (!data || !data.length) { list.innerHTML = `<p class="muted">No entries yet.</p>`; return; }
  list.innerHTML = `
    <p class="muted">${data.length} entr${data.length === 1 ? "y" : "ies"} sold</p>
    <div style="max-height:40vh;overflow:auto;border:1px solid var(--border);border-radius:var(--radius)">
      <table class="table">
        <thead><tr><th>No.</th><th>Email</th><th>Purchased</th></tr></thead>
        <tbody>
          ${data.map(r => `<tr><td style="font-family:var(--font-mono)">#${String(r.ticket_number).padStart(4, "0")}</td><td>${esc(r.email)}</td><td class="muted">${new Date(r.created_at).toLocaleString("en-GB")}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  dialog.querySelector("[data-draw]").onclick = () => drawWinner(ev.id, data);
}

function drawWinner(_eventId, entries) {
  if (!entries.length) return;
  const winner = entries[Math.floor(Math.random() * entries.length)];
  const out = $("#raffle-dialog [data-winner]");
  out.innerHTML = `
    <div class="alert alert--success">
      <strong>Winner:</strong> ticket <code>#${String(winner.ticket_number).padStart(4, "0")}</code> — ${esc(winner.email)}
    </div>
  `;
}

/* ------------------------------ ORDERS ------------------------------ */
async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, kind, quantity, amount_pence, status, created_at, email, event:events(title)")
    .order("created_at", { ascending: false })
    .limit(50);
  const tbody = $("[data-orders]");
  if (error) { tbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`; return; }
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="5" class="muted">No orders yet.</td></tr>`; return; }
  tbody.innerHTML = data.map(o => `
    <tr>
      <td class="muted" style="font-family:var(--font-mono);font-size:.8rem">${new Date(o.created_at).toLocaleDateString("en-GB")}</td>
      <td>${esc(o.email)}</td>
      <td><span class="tag">${o.kind}</span> ${o.event ? esc(o.event.title) : ""}</td>
      <td>×${o.quantity}</td>
      <td>${formatMoney(o.amount_pence)}</td>
      <td><span style="color:${o.status === "paid" ? "var(--success)" : "var(--ink-500)"}">${o.status}</span></td>
    </tr>
  `).join("");
}

/* --------------------------- SUBSCRIPTIONS -------------------------- */
async function loadSubscriptions() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end, profile:profiles(email, full_name)")
    .eq("status", "active");
  const tbody = $("[data-subs]");
  if (error) { tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`; return; }
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" class="muted">No active subscriptions.</td></tr>`; return; }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${esc(s.profile?.full_name || s.profile?.email || "—")}</td>
      <td><span class="tag">${s.tier}</span></td>
      <td class="muted" style="font-family:var(--font-mono);font-size:.8rem">${new Date(s.current_period_end).toLocaleDateString("en-GB")}</td>
      <td><span style="color:var(--success)">${s.status}</span></td>
    </tr>
  `).join("");
}

/* ------------------------------- UTILS ------------------------------ */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function toLocalInput(iso) {
  // Returns value for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------- BOOT ------------------------------- */
$("[data-new-event]")?.addEventListener("click", () => openEventDialog(null));
$("#event-form")?.addEventListener("submit", saveEvent);
$("[data-signout]")?.addEventListener("click", signOut);
supabase.auth.onAuthStateChange(() => init());
init();
