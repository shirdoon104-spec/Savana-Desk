# Live Pilot Checklist

This checklist is for running the temporary live pilot on Railway-provided domains while keeping Clerk and Paystack in test mode.

## Pilot URLs

- Web: `https://rayaan-web-staging.up.railway.app`
- API health: `https://rayaan-api-staging.up.railway.app/api/health`

## Current Mode

- Railway environment: `staging`
- Clerk keys: development/test keys
- Paystack keys: test keys
- Database: Railway staging Postgres
- Redis: Railway staging Redis

## Clerk Test Instance

Configure the Clerk development/test instance with:

- Application URL: `https://rayaan-web-staging.up.railway.app`
- Sign-in URL: `https://rayaan-web-staging.up.railway.app/sign-in`
- Sign-up URL: `https://rayaan-web-staging.up.railway.app/sign-up`
- After sign-in URL: `https://rayaan-web-staging.up.railway.app/app`
- After sign-up URL: `https://rayaan-web-staging.up.railway.app/onboarding`

Webhook endpoint:

```text
https://rayaan-api-staging.up.railway.app/api/webhooks/clerk
```

Recommended events:

- `organization.created`
- `organization.updated`
- `organizationMembership.created`
- `organizationMembership.updated`
- `organizationMembership.deleted`
- `user.created`
- `user.updated`

## Paystack Test Mode

Keep Paystack test keys until payment go-live.

Callback URL:

```text
https://rayaan-web-staging.up.railway.app/app/payments/callback
```

Webhook URL:

```text
https://rayaan-api-staging.up.railway.app/api/payments/webhooks/paystack
```

## Required Smoke Tests

- Sign in.
- Create/select Clerk organization.
- Complete tenant onboarding.
- Create property and room.
- Create restaurant, table, menu category, and menu item.
- Create POS order.
- Confirm kitchen page updates.
- Record manual payment.
- Close order.
- Refresh and confirm data persists.

## Before Real Production

- Connect real custom domains.
- Create Clerk production instance.
- Switch to `pk_live_*` and `sk_live_*` Clerk keys.
- Create production Clerk webhook.
- Decide when to switch Paystack from test to live.
- Configure monitoring and error tracking.

