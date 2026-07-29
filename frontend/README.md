# Frontend

This is the new frontend shell for the industrial app.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## iOS

Run on macOS:

```bash
npx cap add ios
npm run ios:sync
npx cap open ios
```

## Environment

Copy root `.env.example` to `.env`, then set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_API_URL`

Do not put service role keys in frontend environment variables.
