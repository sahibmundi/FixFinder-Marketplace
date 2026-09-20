# FixFinder

FixFinder helps drivers find nearby, verified mechanics and vehicle-service professionals, while giving providers a reviewed public profile.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fixfinder` — React/Vite customer, provider, and admin web app
- `artifacts/api-server/src/routes/providers.ts` — provider search, onboarding, admin review, stats, and enquiries
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated client hooks
- `lib/db/src/schema/marketplace.ts` — Drizzle marketplace schema
- `artifacts/api-server/src/lib/seed.ts` — fictional development marketplace seed data

## Architecture decisions

- Public provider discovery is backed by PostgreSQL and only returns approved providers.
- Provider onboarding always starts as `pending`; admin status changes control public visibility.
- Browser auth uses Clerk session cookies; the API keeps ownership and admin checks server-side.
- API contracts are OpenAPI-first; generated React Query hooks are the frontend integration boundary.

## Product

- Customers can search and filter nearby mechanics by service, city, rating, verification, and availability.
- Customers can view a provider profile, call, get directions, or send an enquiry.
- Providers can sign in with Clerk, submit and edit their own profile, and see review status.
- Admins can review providers, approve/reject/suspend listings, and view platform totals.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Preview workflows provide `PORT` and `BASE_PATH`; direct production builds need those environment variables explicitly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
