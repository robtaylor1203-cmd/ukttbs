/**
 * 100 Club sign-up — kicks off a Stripe Checkout for a recurring subscription.
 */
import { startCheckout } from "./checkout.js";

document.querySelectorAll("[data-join-hundred]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tier = btn.dataset.tier || "annual"; // "annual" or "monthly"
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Redirecting…";
    try {
      await startCheckout({ kind: "hundred_club", tier });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = original;
      alert(e.message || "Something went wrong — please try again.");
    }
  });
});
