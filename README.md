# Rayaan Hotel SaaS

Offline-first, multi-tenant hotel and restaurant management SaaS scaffold.

## Apps

- `apps/web` - Next.js SaaS/PWA frontend with Clerk Organizations.
- `apps/api` - NestJS backend API for tenant-scoped operations, sync, billing, and payments.

## Packages

- `packages/shared` - shared domain types and constants.
- `packages/database` - Prisma schema for PostgreSQL.
- `packages/payments` - payment provider abstraction for Stripe and Somalia mobile money.
- `packages/offline-sync` - offline action models and conflict helpers.
- `packages/config` - shared environment validation.

## Start

```bash
pnpm install
pnpm dev
```

Copy `.env.example` files in each app/package before running against real services.

Local Docker ports use `15432` for Postgres and `16379` for Redis to avoid common conflicts with other projects.

## Clerk

See [docs/CLERK_SETUP.md](./docs/CLERK_SETUP.md) to connect real Clerk authentication and Organizations.
