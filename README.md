# UK Tea Trade Benevolent Society — ukttbs.org.uk

Static site hosted on **GitHub Pages**, with **Supabase** (Postgres + Auth) as the
backend and **Stripe** for payments. No build step — plain HTML/CSS/JS.

## Project layout

```

3. Keep the domain registration wherever you prefer — only DNS needs to point
   at GitHub Pages.

# UKTTBS — The Deep Steep (2026 Redesign)

This project is a premium, ultra-modern web experience for the UK Tea Trade Benevolent Society. The new design is clean, professional, and dynamic, with interactive touches and a focus on accessibility and performance.

## Features

- Ultra-modern, premium homepage with parallax and horizontal scroll lock
- Interactive, elegant touches and responsive design
- Minimal, maintainable CSS and JS
- No legacy animation frameworks (GSAP, Lenis, etc.)

## Getting Started

1. Clone the repo
2. Open `index.html` in your browser
3. Explore the homepage and all sections

## Structure

- `index.html` — Homepage (parallax, horizontal scroll, premium hero)
- `assets/css/` — Modern CSS (design tokens, app, home-journey, etc.)
- `assets/js/` — Minimal JS for navigation and future interactivity
- `src/` — (Legacy) No longer used for homepage

## One-time setup

### Supabase
1. Create a new project at <https://supabase.com>.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. Install the Supabase CLI (`npm i -g supabase`) and link the project:
   ```
   supabase login
   supabase link --project-ref <your-ref>
   ```
4. Set secrets for the Edge Functions:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set HUNDRED_CLUB_MONTHLY_PRICE_ID=price_...
   supabase secrets set HUNDRED_CLUB_ANNUAL_PRICE_ID=price_...
   supabase secrets set SITE_URL=https://ukttbs.org.uk
   ```
5. Deploy the functions:
   ```
   supabase functions deploy create-checkout-session --no-verify-jwt
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

### Stripe
1. Create two **recurring Prices** in Stripe for the 100 Club:
   - Monthly: £10 / month
   - Annual: £120 / year
2. Copy the `price_...` IDs into the Supabase secrets above.
3. Add a webhook endpoint in Stripe Dashboard:
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### GitHub Pages
1. Push this repo to GitHub.
2. **Settings → Pages → Source:** GitHub Actions.
3. **Settings → Secrets and variables → Actions → Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `PAYPAL_DONATE_URL` (the hosted button URL from PayPal)
4. Add a custom domain `ukttbs.org.uk` in Pages settings; the `CNAME` file is already in the repo. Update your DNS to point to GitHub Pages:
   ```
   A     @    185.199.108.153
   A     @    185.199.109.153
   A     @    185.199.110.153
   A     @    185.199.111.153
   CNAME www  <your-gh-username>.github.io.
   ```

## Local preview

No build step. Any static server works:
```
python -m http.server 8080
# then open http://localhost:8080
```
For payments/auth locally, create `assets/js/config.local.js` with real keys (git-ignored) and import it instead of `config.js` in the HTML — or just deploy a preview to a test branch.

## Security notes

- `SUPABASE_ANON_KEY` and `STRIPE_PUBLISHABLE_KEY` are designed to be public.
- `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `STRIPE_WEBHOOK_SECRET` live **only** as Supabase Edge Function secrets — never commit them.
- Row-Level Security is enabled on all tables; users only see their own data.

