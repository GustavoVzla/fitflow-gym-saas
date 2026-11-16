# FitFlow — Multi-tenant Gym Management SaaS

> **Portfolio copy.** This repository is a sanitized snapshot of a private, commercial product.
> Client names, seed data, infrastructure identifiers and internal documentation have been
> replaced with fictional placeholders (e.g. "Demo Studio", `example.com`). Git history is not included.

FitFlow is a B2B SaaS for boutique gyms, CrossFit boxes and fitness studios. Each gym (tenant)
gets an admin panel to run the business — members, classes, bookings, payments, reports —
plus a white-label mobile PWA for its members.

## Features

**Admin panel (per gym)**
- Members CRM: member profile, families, prospects/leads, custom signup forms, GDPR consent tracking
- Scheduling: class timetable, rooms, recurring bookings, waiting lists, 1:1 appointments with instructors
- Payments: plans and rates, Stripe (per-gym keys + signed webhooks), SEPA/card/manual modes, daily cash report, expenses and gross margin
- Engagement: notifications, broadcast messages, automations, loyalty alerts, posts, offers, competitions with public registration
- Training: workouts (WOD) library, training groups
- Reports and analytics dashboards, AI chatbot and AI analytics (OpenAI)
- CSV import of members from other platforms with column-mapping heuristics (PapaParse + zod validation)
- Role-based staff permissions (owner, staff, instructor) and guided onboarding tours

**Super-admin console**
- Tenant provisioning, per-gym settings, commissions, import jobs
- Mandatory MFA (TOTP) — admin RLS policies require an `aal2` session

**Member app (PWA, `apps/member-app`)**
- Class booking and check-in, payments, progress, account, push notifications (Serwist service worker), AI assistant

## Architecture

```
Next.js 16 (App Router, Server Components, Server Actions)
   │   ├─ src/                  admin panel + super-admin + public pages
   │   └─ apps/member-app/      member PWA (npm workspace)
   │
   ├─ Supabase Auth  (email/password, Google OAuth, MFA TOTP)
   ├─ Supabase Postgres
   │     ├─ 79 SQL migrations (supabase/migrations)
   │     ├─ Row Level Security on every tenant table (gym_id isolation)
   │     ├─ SECURITY DEFINER RPCs for privileged operations
   │     └─ pgTAP test suite (supabase/tests)
   ├─ Stripe         (per-tenant keys, webhook signature verification)
   ├─ Upstash Redis  (rate limiting on auth, MFA and admin Server Actions)
   └─ Sentry         (client / server / edge error monitoring)
```

**Multi-tenancy.** Every business table carries a `gym_id`. RLS policies resolve the caller's
gym and role from `auth.uid()` (via `gym_users` / `members` / `app_admins`), so tenant isolation is
enforced by the database, not by application code. Super-admin access is gated by MFA (`aal2`).

**Testing.** pgTAP tests (13 files) create two tenants inside a transaction, impersonate
users with `SET LOCAL role authenticated` + JWT claims, assert what each role can and cannot
read or write across tenants, then roll back. Run them with `npm run test:rls`.
Additional scripts smoke-test legal pages and the OAuth callback.

**Security.** zod validation on Server Actions and API routes, CSP headers in `next.config.ts`,
rate limiting, encrypted storage of per-gym Stripe webhook secrets, GDPR export/delete endpoints,
gitleaks config for secret scanning.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react, driver.js |
| Backend | Supabase (Postgres, Auth, RLS, RPCs), Next.js Server Actions / Route Handlers |
| Payments | Stripe |
| Infra | Vercel, Upstash Redis, Sentry |
| Testing | pgTAP, Node test scripts, GitHub Actions smoke test |

## Running locally

Requirements: Node 20+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install

# Local Supabase stack
supabase init            # creates supabase/config.toml (not included in this copy)
supabase start           # prints the local API URL, anon key and service role key
supabase db reset        # applies all migrations in supabase/migrations

# Environment
cp .env.example .env.local   # fill in the values printed by `supabase start`
                             # Stripe / Upstash / Sentry are optional for local browsing

npm run dev              # admin panel on http://localhost:3000
npm run dev -w apps/member-app   # member PWA on http://localhost:3001

# RLS tests (pgTAP) against the local database
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run test:rls
```

## Screenshots

_Coming soon_ — admin dashboard, member profile, class timetable, member PWA.

<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

## Author

Built by **Gustavo Tejera** — full-stack developer (Next.js, Supabase, automation).

## License

**All rights reserved.** Source available for portfolio review only. No permission is granted to
use, copy, modify or distribute this code. See [LICENSE](LICENSE).

---

### Resumen (ES)

FitFlow es un SaaS multi-tenant de gestión de gimnasios y estudios (Next.js 16 + Supabase):
panel de administración por centro, consola de super-admin con MFA obligatorio y PWA para socios.
El aislamiento entre centros se garantiza con RLS en Postgres y está cubierto por tests pgTAP.
Integra Stripe, Upstash (rate limiting) y Sentry. Esta es una copia saneada para portfolio de un
producto privado; todos los datos de clientes son ficticios. Todos los derechos reservados.
