/**
 * The 100 Club — interactive donation CTA.
 *
 * A billing-tier toggle (Monthly / Annual) cross-fades the price,
 * savings hint and the subscribe button's data-tier. Delegates the
 * actual checkout to hundred-club.js (existing module) via the
 * [data-join-hundred] contract.
 */
import { gsap } from "../lib/gsap-setup.js";

export default function hundredCTA() {
  const host = document.querySelector("[data-scene='hundred-cta']");
  if (!host) return;

  const toggle = host.querySelector("[data-tier-toggle]");
  if (!toggle) return;

  const priceEl = host.querySelector("[data-price]");
  const unitEl  = host.querySelector("[data-unit]");
  const noteEl  = host.querySelector("[data-note]");
  const btn     = host.querySelector("[data-join-hundred]");

  const tiers = {
    annual:  { price: "£120", unit: "/ year",  note: "12 monthly draws · cancel anytime at renewal", btnLabel: "Subscribe · £120 / year" },
    monthly: { price: "£10",  unit: "/ month", note: "Entered into that month's draw · pause anytime", btnLabel: "Subscribe · £10 / month" },
  };

  const buttons = toggle.querySelectorAll("[data-tier]");
  buttons.forEach((b) => {
    b.addEventListener("click", () => {
      const key = b.getAttribute("data-tier");
      if (!(key in tiers)) return;
      buttons.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      applyTier(key);
    });
  });

  function applyTier(key) {
    // Removed for redesign: hundred-cta scene module.
    if (priceEl) {
