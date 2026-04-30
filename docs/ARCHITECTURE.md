# Architecture

## Tenant Model

Clerk Organizations are the external identity boundary. The backend maps each Clerk organization to an internal `Tenant`.

Every operational record is scoped by:

- `tenantId`
- `propertyId`
- optional `restaurantId`
- `createdByUserId`
- `deviceId` for offline-capable surfaces

PostgreSQL row-level security should be enabled before production data goes live.

## Backend

The backend is a modular NestJS API:

- Auth module: verifies Clerk JWTs and active organization.
- Tenancy module: resolves `clerkOrgId` to `tenantId`.
- Sync module: accepts idempotent offline actions from devices.
- Payments module: routes payments through provider adapters.
- Hotel module: reservations, rooms, guests, folios.
- Restaurant module: tables, orders, KDS, room charges.

## Offline

Offline-capable clients persist actions locally, then submit them to the API in order.

Each action includes:

- UUID
- tenant/property/restaurant scope
- device ID
- actor user ID
- timestamp
- entity type and entity ID
- idempotency key
- payload

The server stores all accepted actions in an append-only `OfflineAction` table and applies domain-specific conflict rules.

## Payments

The SaaS supports multiple provider adapters:

- Stripe for international card payments, SaaS billing, and future Connect flows.
- eDahab for Somalia mobile money where API access is approved.
- EVC Plus, ZAAD, and Sahal through direct provider APIs or a vetted aggregator.

Mobile money cannot be considered paid while fully offline. Offline clients may create a pending payment request that is initiated or verified when connectivity returns.
