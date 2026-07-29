# A1 STUDIO Check-in Industrial Migration

## Current State Kept Safe

- The current PWA remains available at `https://a1studio-user.github.io/italiano-checkin/index.html?v=21`.
- A rollback copy is stored in `legacy-pwa/`.
- A timestamped zip backup is stored under `backups/pwa-v21-*.zip`.

## Target Architecture

```text
frontend/ React + Vite + Capacitor
  |
  | Supabase Auth session JWT
  v
supabase/functions/app-api
  |
  | server-side role checks + service role database operations
  v
Postgres tables with RLS
```

## Why This Is Safer

- Passwords move to Supabase Auth instead of custom plaintext fields.
- Teacher/owner permissions are enforced in Edge Functions and RLS, not by browser JavaScript.
- The frontend no longer directly performs privileged writes to business tables.
- Account, class, homework, check-in, chat moderation, and audit data are normalized.
- Chat moderation/reporting is represented in the database for App Store review readiness.

## Migration Phases

1. Preserve current PWA.
2. Create Supabase Auth users for `toni`, teachers, and students.
3. Apply `supabase/migrations/20260707_001_industrial_security_schema.sql`.
4. Deploy `supabase/functions/app-api`.
5. Configure frontend `.env`.
6. Rebuild the frontend feature screens against `frontend/src/lib/api.ts`.
7. Test with a separate Supabase project first.
8. Only after full data parity, retire legacy public policies and legacy tables.

## Do Not Do Yet

- Do not delete `app_users`, `daily_tasks`, `student_tasks`, `checkins`, `streaks`, or chat legacy tables until export/import is verified.
- Do not publish the new frontend over the `v21` PWA link until the industrial version passes mobile testing.
- Do not put service role keys in frontend files.

## Official References

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Capacitor iOS: https://capacitorjs.com/docs/ios
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
