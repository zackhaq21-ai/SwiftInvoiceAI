# Swift Invoice AI

Invoice faster. Get paid sooner.

Production-oriented invoicing, estimates, payments, customer management, voice invoicing, reporting, team collaboration, and subscription billing for freelancers, tradespeople, and small businesses.

## Local development

```bash
npm install
npm run dev
```

Create a local `.env` file using the required Supabase public variables. Server-side Stripe and email secrets belong in Supabase Edge Function secrets and must never be committed.

## Validation

```bash
npm run pre-deploy
```

See `DEPLOYMENT.md` and `PRODUCTION_READINESS_REPORT.md` for deployment and launch requirements.
