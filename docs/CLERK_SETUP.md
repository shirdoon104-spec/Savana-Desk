# Clerk Setup

This project uses Clerk for authentication and Organizations. A Clerk Organization maps to a Rayaan `Tenant`.

## 1. Create a Clerk application

In Clerk Dashboard:

1. Create an application.
2. Enable the sign-in methods you want, such as email/password, email code, Google, or phone.
3. Enable Organizations.
4. Copy the publishable key and secret key.

## 2. Add web environment variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/app"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/onboarding"
```

## 3. Add API environment variables

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://rayaan:rayaan@localhost:5432/rayaan_hotel"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SIGNING_SECRET="whsec_..."
WEB_ORIGIN="http://localhost:3000"
```

## 4. Add the Clerk webhook

In Clerk Dashboard, create an endpoint that points to:

```text
http://localhost:4000/api/webhooks/clerk
```

For local testing, expose the API with a tunnel such as ngrok and use the tunnel URL instead of `localhost`. Subscribe to these events:

```text
organizationInvitation.accepted
organizationInvitation.revoked
organizationMembership.created
organizationMembership.deleted
user.deleted
```

Copy the webhook signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.

## 5. Restart servers

Run these in two PowerShell windows:

```powershell
pnpm --filter @rayaan/web dev
```

```powershell
pnpm --filter @rayaan/api dev
```

## 6. Test the flow

1. Open `http://localhost:3000/app`.
2. Sign up or sign in.
3. Create or select a Clerk Organization from the organization switcher.
4. Click **Test tenant context**.

Expected result:

```json
{
  "user": {
    "clerkUserId": "user_...",
    "sessionId": "sess_..."
  },
  "organization": {
    "clerkOrgId": "org_...",
    "role": "org:admin",
    "slug": "..."
  },
  "tenantResolved": true,
  "tenant": null
}
```

`tenant` is still `null` in this phase. The next phase persists the Clerk Organization as an internal Tenant in PostgreSQL.
