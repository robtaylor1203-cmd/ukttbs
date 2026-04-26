/**
 * Custom cursor — a dot + trailing ring, with magnetic + label states.
 * Blends via mix-blend-mode: difference so it reads on any background.
 *
 * States (exposed via [data-state] on .cursor):
 *   default | hover | press | hidden | label
 *
 * Markup: injected automatically. Add these hooks to elements you
 * want to react to the cursor:
 *   - .is-interactive            → ring grows
 *   - [data-cursor="label"]      → shows data-cursor-text as a pill
 *   - [data-magnetic]            → element pulled slightly toward cursor
 */
import { gsap } from "./gsap-setup.js";

let booted = false;

export function initCursor() {
  if (booted) return;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (prefersReduced || coarse) return;
  if (!document.body.hasAttribute("data-cine")) return;

  booted = true;

  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("data-state", "default");
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `
    <span class="cursor__ring"></span>
    <span class="cursor__dot"></span>
  `;
  document.body.appendChild(cursor);

  // Targets that live inside the cursor we translate independently.
  const ring = cursor.querySelector(".cursor__ring");
  const dot  = cursor.querySelector(".cursor__dot");

  // Position trackers — dot snaps, ring eases behind with quickTo.
  const xDot  = gsap.quickTo(dot,  "x", { duration: 0.08, ease: "power3" });
  const yDot  = gsap.quickTo(dot,  "y", { duration: 0.08, ease: "power3" });
  const xRing = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
  const yRing = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });

  const move = (e) => {
    xDot(e.clientX);  yDot(e.clientY);
    xRing(e.clientX); yRing(e.clientY);
  };
  window.addEventListener("pointermove", move, { passive: true });

  // Hide on leave, restore on enter.
  window.addEventListener("pointerleave", () => cursor.setAttribute("data-state", "hidden"));
  window.addEventListener("pointerenter", () => cursor.setAttribute("data-state", "default"));

  // Interactive hover zones — auto-bind to anchors, buttons, and .is-interactive
  const interactiveSel = 'a, button, [role="button"], .is-interactive, [data-cursor]';

  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest(interactiveSel);
    if (!t) return;
    const label = t.getAttribute("data-cursor-text");
    if (label) {
      cursor.setAttribute("data-label", label);
      cursor.setAttribute("data-state", "hover");
    } else {
      cursor.removeAttribute("data-label");
      cursor.setAttribute("data-state", "hover");
    }
  });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest(interactiveSel);
    if (!t) return;
    if (e.relatedTarget && t.contains(e.relatedTarget)) return;
    cursor.removeAttribute("data-label");
    cursor.setAttribute("data-state", "default");
  });
  document.addEventListener("pointerdown", () => cursor.setAttribute("data-state", "press"));
  document.addEventListener("pointerup",   () => cursor.setAttribute("data-state", "default"));

  // Magnetic effect — pulls element toward cursor on hover.
  const magnets = document.querySelectorAll("[data-magnetic]");
  magnets.forEach(setupMagnet);
  // Also watch for dynamically added magnets.
  new MutationObserver((mutations) => {
    mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.("[data-magnetic]")) setupMagnet(n);
      n.querySelectorAll?.("[data-magnetic]").forEach(setupMagnet);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

function setupMagnet(el) {
  if (el.__magnet) return;
  el.__magnet = true;
  const strength = parseFloat(el.getAttribute("data-magnetic") || "0.35");
  const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
  const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    xTo((e.clientX - cx) * strength);
    yTo((e.clientY - cy) * strength);
  });
  el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
}
