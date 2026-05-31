# Resal.store - Server

This server uses Drizzle ORM + Postgres in production (Supabase). Development may use SQLite or Postgres.

Setup
1. Copy .env.example to .env and set DATABASE_URL (Supabase).
2. Install deps: npm ci
3. Run migrations: npm run migrate
4. Start: npm run dev

CI
- The included GitHub Actions workflow runs drizzle-kit migrate and triggers a Render webhook.
