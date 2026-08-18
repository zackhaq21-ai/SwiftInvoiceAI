# Swift Invoice AI

Invoice faster. Get paid sooner.

Swift Invoice AI is an invoicing and estimates platform for freelancers, tradespeople, and small businesses. It includes customer management, voice-assisted invoice creation, payments, expenses, reporting, team collaboration, and subscription billing.

## Run locally

1. Copy `.env.example` to `.env`.
2. Add your Supabase project URL and anonymous key.
3. Install dependencies and start Vite:

```bash
npm install
npm run dev
```

## Validate

```bash
npm run pre-deploy
```

## Deployment

See `DEPLOYMENT.md`, `MOBILE_SETUP.md`, and `PRODUCTION_READINESS_REPORT.md`.

Keep Stripe, Resend, Supabase service-role, webhook, and cron secrets in the deployment provider or Supabase Edge Function secrets. Never commit them to Git.
