# Deployment Plan

This project should deploy quickly on Railway while staying ready for AWS ECS, RDS, and managed Redis later.

## Target Topology

### Early Production

- Web: `apps/web`, deployed as a separate service.
- API: `apps/api`, deployed as a separate container service.
- Database: managed PostgreSQL.
- Redis: managed Redis.
- Auth: Clerk production instance.
- Payments: live Paystack/Stripe credentials and verified webhooks.
- Monitoring: Sentry plus uptime checks.

Railway is the fastest first deployment target because the API needs a persistent container runtime for KDS events, webhooks, offline sync, and future workers.

### AWS-Ready Future

- Web can remain on Vercel/Railway or move behind CloudFront.
- API container moves from Railway to ECS Fargate.
- PostgreSQL moves to RDS PostgreSQL Multi-AZ.
- Redis moves to ElastiCache or MemoryDB.
- Secrets move to AWS Secrets Manager or SSM Parameter Store.
- Ingress moves to ALB plus AWS WAF.

The Dockerfiles in `apps/api/Dockerfile` and `apps/web/Dockerfile` are intentionally provider-portable.

## Services

Create separate services:

- `rayaan-api`
- `rayaan-web`
- `rayaan-postgres`
- `rayaan-redis`
- Optional later: `rayaan-worker`

For Railway monorepo deployment, keep the repository root as the build context and configure each service with its own Dockerfile path:

- API service: `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`
- Web service: `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`

Railway normally reads `railway.json` from the service source. Because this repo has two app services, `railway.api.json` and `railway.web.json` are reference configs. Use the Railway dashboard service settings, or copy the matching file to `railway.json` only while linking/deploying that specific service.

Do not set the Railway root directory to `apps/api` or `apps/web`; the Dockerfiles need the monorepo root so workspace packages under `packages/*` are available during install and build.

## Production Environment

### API

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
WEB_ORIGIN=https://app.yourdomain.com
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=...
CLERK_JWT_KEY=...
CLERK_JWT_ISSUER=...
STRIPE_SECRET_KEY=sk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_CALLBACK_URL=https://app.yourdomain.com/app/payments/callback
RESTAURANT_TAX_RATE=0.16
RESTAURANT_SERVICE_CHARGE_RATE=0.10
RESTAURANT_DISCOUNT_APPROVAL_THRESHOLD=500
RESTAURANT_ITEM_ALERT_MINUTES=10
RESTAURANT_ITEM_CRITICAL_MINUTES=20
KITCHEN_TICKET_PRINTER_ENABLED=false
OFFLINE_QUEUE_MAX_RETRIES=3
```

### Web

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
NEXT_PUBLIC_OFFLINE_QUEUE_MAX_RETRIES=3
```

The `NEXT_PUBLIC_*` values must be present at web build time, not just runtime, because Next.js inlines them into the browser bundle.

## CI/CD

The CI workflow in `.github/workflows/ci.yml` runs:

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm db:migrate:deploy`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

Production deploys should run only after CI passes. Keep production migrations as `prisma migrate deploy`; never use `migrate reset` outside local development.

The current workflow verifies the repo but does not automatically deploy. For the first launch, deploy manually from Railway after CI passes. After staging is stable, add a separate deploy workflow that promotes `staging` and `main` intentionally.

## Deployment Order

1. Create staging services and staging database.
2. Create staging Redis.
3. Configure the API service with `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`.
4. Configure the web service with `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`.
5. Add staging Clerk, Paystack/Stripe test keys, and app domains.
6. Run `pnpm db:migrate:deploy` against the staging database.
7. Deploy API.
8. Confirm `https://staging-api.yourdomain.com/api/health` returns `status: ok`.
9. Deploy web with `NEXT_PUBLIC_API_URL` pointing at staging API.
10. Run smoke tests.
11. Create production services with separate secrets, database, and Redis.
12. Take a pre-launch production database backup if there is existing data.
13. Run `pnpm db:migrate:deploy` against production.
14. Deploy API, then web.
15. Register live Clerk and payment webhook URLs.

## Smoke Tests

- Sign in with Clerk.
- Select or create an organization.
- Complete onboarding.
- Create property, restaurant, and table.
- Load public menu route.
- Create restaurant order.
- Confirm kitchen event stream works.
- Submit an offline sync action.
- Trigger Paystack/Stripe test payment flow in staging.
- Verify `/api/health` returns 200.

## Security Baseline

- Keep database and Redis private.
- Set `WEB_ORIGIN` to the exact web domain.
- Verify all webhooks before processing.
- Keep Clerk secret keys server-side only.
- Scope all tenant data access by `tenantId`.
- Enable PostgreSQL row-level security before real tenant data goes live.
- Add rate limiting before public production launch.
- Store secrets only in platform secret managers.
- Enable daily backups and test restore before launch.

## AWS Migration Notes

When usage justifies AWS, keep the app-level deployment contract the same:

- Build API from `apps/api/Dockerfile`.
- Build web from `apps/web/Dockerfile`, or keep web on Vercel/Railway.
- Pass the same environment variable names through ECS task definitions.
- Replace Railway Postgres with RDS PostgreSQL.
- Replace Railway Redis with ElastiCache or MemoryDB.
- Run `pnpm db:migrate:deploy` as a one-off ECS task before API rollout.
- Put the API behind an ALB and AWS WAF.

## Rollback

- Redeploy the previous API/web image if app code breaks.
- For destructive migrations, prepare reviewed rollback SQL before deployment.
- Take a manual database backup before major migrations.
- Log incidents in `docs/incidents/`.
