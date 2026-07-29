# Supabase Backend

## Local/CLI Setup

Install Supabase CLI on macOS, then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  APP_ORIGIN="https://a1studio-user.github.io"
supabase functions deploy app-api
```

## Safety Rules

- Never place `SUPABASE_SERVICE_ROLE_KEY` in `frontend/`.
- Test migrations on a staging project before production.
- Keep legacy tables until data import and feature parity are verified.

## Production Cutover

1. Deploy migration.
2. Create Auth users.
3. Insert matching `profiles`.
4. Deploy Edge Function.
5. Point frontend `.env` to the function URL.
6. Run smoke tests.
7. Only then restrict or remove legacy public policies.
