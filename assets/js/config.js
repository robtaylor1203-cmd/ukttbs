/**
 * Public runtime config.
 *
 * These values are PUBLIC (the Supabase anon key and Stripe publishable key
 * are designed to be exposed to the browser). Secret keys live only in
 * Supabase Edge Function secrets and never in this repo.
 *
 * For local development, copy this file to `config.local.js` (git-ignored)
 * and your overrides will be picked up if present.
 */
window.UKTTBS_CONFIG = {
  // Supabase project
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLIC-ANON-KEY",

  // Stripe publishable key (pk_live_... or pk_test_...)
  STRIPE_PUBLISHABLE_KEY: "pk_test_REPLACE_ME",

  // PayPal donate button hosted URL (kept from current site)
  PAYPAL_DONATE_URL: "https://www.paypal.com/donate/?hosted_button_id=REPLACE_ME",

  // Feature flags
  FEATURES: {
    tickets: true,
    raffle: true,
    hundredClub: true,
    accounts: true,
  },

  // Raffle window rules (hours before event; hours after start to close)
  RAFFLE_WINDOW: {
    opensHoursBefore: 24 * 7, // 7 days before the event
    closesHoursAfterStart: 4, // closes 4h after event start time
  },
};
