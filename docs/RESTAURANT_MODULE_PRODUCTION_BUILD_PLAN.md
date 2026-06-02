# Restaurant Module Production Build Plan

Last reviewed: 2026-05-25

This plan is the implementation source of truth for hardening and completing the restaurant module. Work through phases in order. Do not build UI or operational features until the security and schema phases are complete.

## Current App Fit

This repository is a Nest API, Next.js web app, and Prisma/PostgreSQL monorepo. The existing restaurant domain already has `Restaurant`, `RestaurantTable`, `MenuCategory`, `MenuItem`, `Order`, `OrderItem`, `Payment`, and `OfflineAction` models.

Implementation should extend these existing modules instead of creating a separate restaurant service. Prefer typed Prisma enums over free-form status strings for new workflow fields, and keep money as `Decimal`.

Important local alignment notes:

- There is no `Staff` model today. Fields described as `waiterId`, `closedById`, `appliedById`, `approvedById`, `recordedById`, and similar actor fields should initially reference `TenantUser.id` or store the Clerk user id consistently. Add a dedicated `Staff` model only if the wider app needs employee profiles separate from tenancy membership.
- The current generic `Payment` model can remain for provider checkout sessions, but restaurant settlement needs the new append-only `OrderPayment` ledger. Do not rely on the existing single `Payment` row as the source of truth for closing restaurant orders.
- Paystack returns transaction amounts in the smallest currency subunit. Compare with `Decimal`, never with JavaScript floating-point equality. Convert using a currency minor-unit helper, for example `new Decimal(verified.amount).div(10 ** currencyExponent).equals(order.totalAmount)`.
- Paystack webhook requests are public machine-to-machine calls, not authenticated tenant requests. Use the provider reference to find the stored payment/order, then compare verified transaction metadata against the stored tenant, property, restaurant, and order ids.

## Fact-Checked Security Notes

Paystack documents that webhook origin should be verified using the `x-paystack-signature` header, an HMAC SHA512 signature over the event payload using the secret key. Paystack also provides `GET /transaction/verify/:reference` for server-side verification and recommends checking for duplicate fulfillment before delivering value.

References:

- [Paystack Webhooks: signature validation](https://paystack.com/docs/payments/webhooks)
- [Paystack Verify Payments](https://paystack.com/docs/payments/verify-payments/)
- [Paystack Transaction API: verify transaction](https://paystack.com/docs/api/transaction/)

## Cross-Cutting Rules

- Enforce tenant, property, restaurant, and order scope in every query.
- Never trust client-sent totals. The server calculates subtotal, tax, service charge, discounts, and final total.
- Every mutation that changes order state writes an `OrderAuditLog` entry in the same database transaction.
- All restaurant payments are append-only in `OrderPayment`. Refunds and reversals are represented by new ledger rows or explicit reversal records, not destructive edits.
- Use `Idempotency-Key` for mutation endpoints and persist the response for 24 hours where duplicate retries are expected.
- Roles must be enforced server-side. UI gating is convenience only.
- Prefer database constraints for uniqueness and integrity, then add API validation for readable errors.
- Use `Decimal` for money, store currency snapshots on monetary rows, and reject mixed-currency payments for one order.
- Use transactions for payment confirmation, order recalculation, table status changes, and folio posting.
- Keep webhook endpoints unauthenticated by Clerk but protected by provider signature verification and strict scope checks.

## Environment Config Required

Add these to the environment/settings schema and `.env.example` files:

```env
RESTAURANT_TAX_RATE=0.16
RESTAURANT_SERVICE_CHARGE_RATE=0.10
RESTAURANT_DISCOUNT_APPROVAL_THRESHOLD=500
RESTAURANT_ITEM_ALERT_MINUTES=10
RESTAURANT_ITEM_CRITICAL_MINUTES=20
KITCHEN_TICKET_PRINTER_ENABLED=false
OFFLINE_QUEUE_MAX_RETRIES=3
```

For production, restaurant tax/service/discount settings should move to tenant, property, or restaurant configuration tables. Environment defaults are acceptable as bootstrapping defaults only.

## Phase 0 - Critical Security Fixes

Complete these before adding new restaurant features.

Status as of 2026-05-25: implemented in code. Paystack fulfillment now validates provider verification, scope metadata, amount, currency, and duplicate ledger entries before closing an order. Order creation accepts `Idempotency-Key` and body `idempotencyKey`, returns the existing order for duplicate keys, and keeps older clients compatible by generating a server key when none is supplied.

### Task 0.1 - Harden Paystack Webhook Verification

Problem: Orders can be closed from provider events without enough scope and duplicate fulfillment checks.

Required checks before confirming payment or closing an order:

- Verify `x-paystack-signature` using HMAC SHA512 over the raw request body.
- Extract `reference` from the signed webhook payload and use it to fetch the stored Paystack checkout/payment record and linked order from the database.
- Re-fetch the transaction via Paystack `GET /transaction/verify/:reference`; do not trust webhook payload fields for fulfillment decisions.
- Require verified transaction `status = success`.
- Verify verified Paystack `amount` matches the expected order or payment amount using `Decimal` and the currency minor-unit exponent.
- Verify verified Paystack `currency` matches the order/property currency.
- Verify verified metadata `orderId` equals the stored order id.
- Verify verified metadata `tenantId` equals the stored order and payment tenant id.
- Verify verified metadata `restaurantId` equals the stored order restaurant id.
- Verify verified metadata `propertyId` equals the stored order property id.
- Check for duplicate `reference` before fulfillment. If an `OrderPayment` with the same Paystack reference is already confirmed, return success to Paystack but log `duplicate` and do not close again.
- Log every webhook attempt, including invalid signature attempts where possible.
- Return a 2xx response for already-processed duplicate valid webhooks to avoid unnecessary provider retries.

Recommended amount comparison shape:

```ts
const exponent = currencyMinorUnitExponent(verifiedTransaction.currency);
const verifiedAmount = new Decimal(verifiedTransaction.amount).div(
  new Decimal(10).pow(exponent),
);

if (!verifiedAmount.equals(order.totalAmount)) {
  reject("Verified Paystack amount does not match the order total.");
}
```

New model:

```prisma
model PaymentWebhookLog {
  id              String   @id @default(cuid())
  provider        String
  reference       String?
  tenantId        String?
  propertyId      String?
  restaurantId    String?
  orderId         String?
  payload         Json
  verifiedAt      DateTime?
  outcome         PaymentWebhookOutcome
  rejectionReason String?
  createdAt       DateTime @default(now())

  @@index([provider, reference])
  @@index([tenantId, createdAt])
}

enum PaymentWebhookOutcome {
  success
  rejected
  duplicate
}
```

Implementation notes:

- Keep the webhook route outside Clerk guards.
- Use the raw request body for signature verification.
- Perform the verification call and all database changes in a small transaction boundary where possible. External Paystack verification must happen before the database transaction.
- Close an order only after writing or confirming an `OrderPayment` row and deriving `paymentStatus = paid`.

### Task 0.2 - Add Idempotency to Order Creation

Problem: Offline retries and network errors can create duplicate orders.

Schema changes:

- Add `idempotencyKey String` to `Order`.
- Add `@@unique([tenantId, idempotencyKey])`.

API rules:

- All order-creation API routes require an idempotency key.
- Prefer the `Idempotency-Key` header. Allow a body field only for backward compatibility during migration.
- On duplicate key, return the existing order and items instead of erroring.
- Validate UUID format for new clients.

## Phase 1 - Order Schema Upgrade

Do schema first, then API, then UI. Add migrations before endpoint behavior.

Status as of 2026-05-25: schema migration started and applied locally. Tasks 1.1, 1.2, 1.3, and 1.5 have database support in place with backward-compatible defaults/nullability. Task 1.4 was introduced in Phase 0 for Paystack settlement. Order creation now records server-calculated subtotal/tax/service/discount snapshots, initializes item workflow status, and writes `order_created` audit logs. Existing status and payment flows now write audit logs and keep item/payment status snapshots aligned. Rich lifecycle endpoints, discount APIs, manager approval rules, and UI changes remain for later Phase 1/Phase 2 work.

### Task 1.1 - Upgrade `Order`

Add fields:

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `dine_in`, `counter`, `takeaway`, `delivery`, `room_service` |
| `covers` | int | Number of guests at the table |
| `waiterId` | string | Actor id; use `TenantUser.id` or Clerk user id until a `Staff` model exists |
| `subtotal` | decimal | Sum of active item prices before adjustments |
| `taxAmount` | decimal | Calculated tax |
| `taxRate` | decimal | Snapshot tax rate |
| `serviceChargeAmount` | decimal | Calculated service charge |
| `serviceChargeRate` | decimal | Snapshot service charge rate |
| `discountAmount` | decimal | Total active discounts |
| `totalAmount` | decimal | Final payable amount |
| `paymentStatus` | enum | `unpaid`, `partial`, `paid`, `refunded`, `voided` |
| `closedAt` | timestamp | When bill was finalized |
| `closedById` | string | Actor id |
| `notes` | text | Order-level notes |
| `courseCount` | int | Highest course count in this order |
| `idempotencyKey` | string | Client-generated UUID, unique per tenant |

Keep `currency` on the order as the settlement currency snapshot.

Recommended enums:

```prisma
enum OrderSource {
  dine_in
  counter
  takeaway
  delivery
  room_service
}

enum OrderPaymentStatus {
  unpaid
  partial
  paid
  refunded
  voided
}
```

### Task 1.2 - Upgrade `OrderItem`

Add fields:

| Field | Type | Notes |
|---|---|---|
| `status` | enum | `pending`, `sent`, `preparing`, `ready`, `served`, `voided` |
| `voidedAt` | timestamp | Nullable |
| `voidedById` | string | Manager/admin actor id |
| `voidReason` | text | Required when voiding |
| `course` | int | `1 = drinks`, `2 = starter`, `3 = main`, etc. |
| `kitchenStation` | enum | `bar`, `grill`, `main_kitchen`, `dessert`, `cold_station` |
| `modifiers` | json | Array of `{ label, value, priceAdjustment }` |
| `unitPrice` | decimal | Price snapshot at order time |
| `totalPrice` | decimal | `unitPrice * quantity + modifier adjustments` |
| `sentAt` | timestamp | When fired to kitchen |
| `preparedAt` | timestamp | When kitchen marked ready |
| `servedAt` | timestamp | When waiter marked served |
| `notes` | text | Per-item notes |

Validation:

- Quantity must be a positive integer.
- `voidReason` is required when `status = voided`.
- Sent items cannot be quantity-edited or deleted; they can only be voided by manager/admin.

### Task 1.3 - Add `OrderDiscount`

```prisma
model OrderDiscount {
  id            String            @id @default(cuid())
  tenantId      String
  propertyId    String
  restaurantId  String
  orderId       String
  orderItemId   String?
  type          OrderDiscountType
  label         String
  amount        Decimal
  appliedById   String
  approvedById  String?
  createdAt     DateTime          @default(now())

  order         Order             @relation(fields: [orderId], references: [id])

  @@index([tenantId, orderId])
}

enum OrderDiscountType {
  percent
  fixed
  item
}
```

Rules:

- Discounts above the configured threshold require manager/admin approval.
- Item-level discounts require `orderItemId`.
- Log `discount_applied` in `OrderAuditLog`.
- Discounts are not deleted after bill close.

### Task 1.4 - Add `OrderPayment` Ledger

```prisma
model OrderPayment {
  id            String             @id @default(cuid())
  tenantId      String
  propertyId    String
  restaurantId  String
  orderId       String
  method        OrderPaymentMethod
  amount        Decimal
  currency      String
  reference     String?
  status        OrderPaymentLedgerStatus @default(pending)
  paidAt        DateTime?
  recordedById  String?
  refundedAt    DateTime?
  refundedById  String?
  refundReason  String?
  metadata      Json?
  createdAt     DateTime           @default(now())

  order         Order              @relation(fields: [orderId], references: [id])

  @@index([tenantId, orderId, status])
  @@unique([tenantId, method, reference])
}
```

Methods: `paystack`, `cash`, `card_manual`, `room_charge`, `complimentary`, `voucher`.

Statuses: `pending`, `confirmed`, `failed`, `refunded`.

Rules:

- An order can have multiple payment rows.
- `order.paymentStatus` is derived from confirmed payment totals versus `order.totalAmount`.
- Order closes only when confirmed payments are greater than or equal to `totalAmount`.
- Do not delete payment rows.
- Do not mutate confirmed payment rows except narrowly controlled provider reconciliation metadata if needed. Prefer reversal rows for business changes.

### Task 1.5 - Add `OrderAuditLog`

```prisma
model OrderAuditLog {
  id            String          @id @default(cuid())
  tenantId      String
  propertyId    String
  restaurantId  String
  orderId       String
  event         OrderAuditEvent
  actorId       String?
  actorRole     String?
  previousState Json?
  newState      Json?
  createdAt     DateTime        @default(now())

  order         Order           @relation(fields: [orderId], references: [id])

  @@index([tenantId, orderId, createdAt])
}
```

Events:

`order_created`, `item_added`, `item_removed`, `item_voided`, `status_changed`, `payment_initiated`, `payment_confirmed`, `payment_refunded`, `discount_applied`, `order_closed`, `order_cancelled`, `charge_to_room_posted`, `table_transferred`, `course_fired`.

## Phase 2 - Order Lifecycle API

Every endpoint must enforce tenant scope, role permissions, server-side recalculation, and audit logging.

Status as of 2026-05-28: Task 2.1 backend item management endpoints are implemented under the tenant-scoped restaurant routes. Add/update/remove/void item actions enforce mutable order state, role permissions, item status rules, server-side recalculation, and audit logging. Task 2.2 core backend bill actions are partially implemented: fire course, apply discount, split bill preview, record manual payment, close, cancel, and transfer table. Room-charge folio posting remains.

### Task 2.1 - Item Management Endpoints

- `POST /orders/:id/items` - Add items after order is placed. Waiter/cashier/manager.
- `PATCH /orders/:id/items/:itemId` - Update quantity, notes, course, or modifiers before item is sent.
- `DELETE /orders/:id/items/:itemId` - Remove unsent item only.
- `POST /orders/:id/items/:itemId/void` - Void sent item. Manager/admin only.

Void rules:

- Body requires `voidReason`.
- If the item is already voided, return success with no additional state change.
- Recalculate subtotal, discounts, tax, service charge, and total.
- Write `item_voided` audit log.

### Task 2.2 - Bill Actions Endpoints

- `POST /orders/:id/fire-course` - Send a course to kitchen.
- `POST /orders/:id/discount` - Apply discount.
- `POST /orders/:id/pay` - Record any payment method.
- `POST /orders/:id/close` - Close bill.
- `POST /orders/:id/cancel` - Cancel unpaid order. Manager/admin.
- `POST /orders/:id/split` - Split bill into sub-bills or by seat.
- `POST /orders/:id/transfer-table` - Move order to another table.

Validation:

- Cannot add items to closed or cancelled orders.
- Cannot fire items already fired.
- Cannot record payment above remaining balance unless the method explicitly supports tips or over-tendered cash change.
- Cannot close with outstanding balance.
- Cannot cancel a paid order; use refund/void workflow.
- Cannot transfer to an occupied table unless merging is explicitly implemented and audited.

### Task 2.3 - Tax and Charge Calculation Service

Status as of 2026-05-28: implemented as a shared API totals service. Restaurant orders, public QR orders, and offline replay now use the same server-side calculation path. The service resolves tax and service charge rates from restaurant config first, then property config, then environment defaults, snapshots those rates on the order, caps discounts at subtotal, rounds at the currency minor-unit boundary, and keeps client-sent totals out of persisted order totals. Property and restaurant tax/service-charge config fields have been added with a reviewed migration.

Build a server-side calculation service:

- Read tax rate from restaurant/property config, falling back to environment defaults.
- Read service charge rate from restaurant/property config, falling back to environment defaults.
- Recalculate on every item add, update, remove, void, discount, and payment-affecting operation.
- Snapshot tax and service charge rates on the order.
- Never accept client-sent `subtotal`, `taxAmount`, `serviceChargeAmount`, `discountAmount`, or `totalAmount`.

Calculation order:

1. Sum non-voided item totals.
2. Apply item-level and order-level discounts.
3. Calculate service charge on the configured taxable base.
4. Calculate tax according to the configured local policy.
5. Round consistently at the currency minor-unit boundary.

## Phase 3 - Charge to Room

Status as of 2026-05-25: initial backend room-charge flow is implemented. `GET /stays/active` searches active in-house stays for POS use, and `POST /folios/:folioId/charges` posts the remaining restaurant order balance to the active stay, creates a `FolioCharge`, creates a confirmed `room_charge` `OrderPayment`, closes the order, updates the table to cleaning, and writes audit logs. This uses `Stay.id` as the current folio identifier until a dedicated `Folio` model is introduced. Checkout now requires staff acknowledgement when posted restaurant folio charges are present. `GET /reports/restaurant-room-charges` and `GET /reports/restaurant-room-charges.csv` provide the daily room-charge reconciliation report and CSV export.

### Task 3.1 - Guest Lookup from POS

Add `GET /stays/active?search=:query`.

Search by guest name, room number, or reservation/stay id. Return:

```json
{
  "stayId": "string",
  "guestName": "string",
  "roomNumber": "string",
  "checkoutDate": "timestamp",
  "folioId": "string",
  "outstandingBalance": "decimal"
}
```

Waiter and front desk roles may search active stays within their tenant/property scope.

### Task 3.2 - Post Charge to Folio

Add `POST /folios/:folioId/charges`.

Body:

```json
{
  "orderId": "string",
  "amount": "decimal",
  "description": "string",
  "restaurantId": "string",
  "postedById": "string"
}
```

Rules:

- Stay must be active and not checked out.
- Amount must equal remaining order balance.
- Prevent duplicate posting by checking for confirmed `room_charge` payment for the order.
- Create `FolioCharge`.
- Create confirmed `OrderPayment` with `method = room_charge`.
- Set `paymentStatus` from ledger totals.
- Log `charge_to_room_posted` and `payment_confirmed`.

### Task 3.3 - Pre-Checkout Warning

When front desk starts checkout:

- Query pending restaurant charges and pending room-charge payments linked to the stay.
- Warn or block checkout with an itemized list.
- Allow authorized staff to mark reviewed or force-post before proceeding.

### Task 3.4 - Room Charge Reconciliation Report

Daily report:

- Posted room charges by restaurant.
- Stay and room breakdown.
- Order references and totals.
- CSV export.

## Phase 4 - Kitchen Display System

Status as of 2026-05-25: Task 4.1, the first Task 4.2 slice, the SSE foundation for Task 4.3, and browser-based Task 4.4 ticket printing are implemented. The schema now includes `KitchenStation`, menu category default station routing, and menu item station overrides. Order creation and item add flows assign a kitchen station. The kitchen board renders operational kitchen tickets grouped by station, order, and course, while still tracking item-level statuses underneath. Tickets show all items, modifiers/notes, elapsed time, amber/red delay borders, and batch Start/Ready actions that update the ticket's items from `sent` to `preparing` to `ready`. `GET /events/kitchen/:restaurantId` streams tenant-scoped kitchen events, and the kitchen page subscribes with auto-reconnecting `EventSource`. Each kitchen ticket can now generate print-ready browser HTML with ticket number, timestamp, table, covers, course, station, items, modifiers, and notes. ESC/POS or print-server integration remains future work.

### Task 4.1 - Kitchen Stations Config

Add `KitchenStation`:

```prisma
model KitchenStation {
  id            String @id @default(cuid())
  tenantId      String
  propertyId    String
  restaurantId  String
  name          String
  type          KitchenStationType
  displayOrder  Int    @default(0)
  isActive      Boolean @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Each `OrderItem` routes to a station based on `MenuCategory.defaultStation` or item override. Assign the station when the item is fired.

### Task 4.2 - Item-Level KDS View

- Group by station, not whole order.
- Ticket displays table number, covers, course, item name, modifiers, notes, and elapsed time.
- Highlight amber after configured alert minutes.
- Highlight red after configured critical minutes.
- Kitchen updates item status from `sent` to `preparing` to `ready`.
- When all items in a course are ready, emit a front-of-house notification.

### Task 4.3 - Real-Time Push

Use SSE first unless bidirectional kitchen actions require WebSockets later.

Endpoint: `GET /events/kitchen/:restaurantId`.

Events:

- `item_fired`
- `item_ready`
- `order_cancelled`
- `item_voided`
- `course_ready`

Requirements:

- Auto-reconnect client.
- Tenant scoped event authorization.
- Waiter screen subscribes to assigned table/course events.

### Task 4.4 - Kitchen Ticket Printing

On item fire:

- Generate print-ready ticket HTML first.
- Include ticket number, timestamp, table, covers, course, station, items, modifiers, and notes.
- Add ESC/POS or print-server integration only after browser print is stable.

## Phase 5 - POS UI Upgrade

Redesign as an operational POS, not an admin panel.

Status as of 2026-05-28: Task 5.1 has its first UI slice implemented on the restaurant page. The restaurant screen now opens with a POS-oriented floor map, status legend, color-coded table tiles, covers, waiter assignment, active bill amount, and elapsed order duration. Tapping a table continues to open the existing order/table panel without changing current order functionality. Task 5.2 has its first UI slice implemented with category tabs, menu search, touch-friendly menu tiles, quantity steppers, a current ticket panel, and a bottom total sourced from the existing draft payload. Task 5.3 has its first UI slice implemented with a payment drawer for active orders, outstanding/paid totals, method selection, server-previewed equal and item split amounts, cash change calculation, manual payment recording, hosted Paystack checkout, active-stay room-charge posting, and browser receipt printing after full manual or room-charge settlement. Task 5.4 has its first UI slice implemented with manager-only order actions for discounts, item voids, table transfers, cancellations, and browser receipt reprints, plus an explicit manager confirmation gate for non-reprint actions. Seat-level split and formal manager PIN or Clerk re-authentication remain.

### Task 5.1 - Floor Map Default Screen

- Landing screen for waiter/cashier roles.
- Tables show status color, cover count, and order duration.
- Tap table to open order panel.
- Manager sees the full floor.

### Task 5.2 - Order Builder Panel

- Full-screen panel with menu grid left and current order right.
- Category tabs, item cards, and real-time search.
- Tap item to add.
- Modifier selector for configurable items.
- Quantity steppers, notes, and course selector per item.
- Bottom totals bar sourced from server recalculation after each mutation.

### Task 5.3 - Bill and Payment Drawer

- Close Bill opens payment drawer.
- Show outstanding balance and method selector.
- Cash supports tendered amount and change due.
- Charge to Room opens guest search and folio confirmation.
- Split supports equal split first; item/seat split can follow.
- Confirmed full payment closes order and prints receipt.

### Task 5.4 - Manager Action Panel

- Available from any order for manager/admin.
- Actions: void item, apply discount, transfer table, cancel order, reprint receipt.
- Require PIN or re-authentication.
- All actions write audit logs.

## Phase 6 - Offline Reliability

### Task 6.1 - Client-Side Action Queue

Use IndexedDB for offline order mutations.

Status as of 2026-05-28: first slice implemented. The POS restaurant page now shows online/offline state and queued action count, stores a stable local device id, and queues order creation in IndexedDB when offline or when the network drops during submit. Supported manual payment, manager item-void, and table-transfer actions now also queue offline or after a network drop, matching the replay types already supported by the sync API. When the browser is online, it flushes queued actions to `/sync/actions` in order-preserving batches and marks local rows as synced or failed. The sync endpoint now persists validated `OfflineAction` rows idempotently, replays supported `order.create`, `order.payment.record`, `order.item.void`, and `order.table.transfer` actions using server-side validation, applies retry caps from `OFFLINE_QUEUE_MAX_RETRIES`, and persists terminal conflict/rejection reasons for manager review. Conflict rules now cover occupied-table order creation, payments against final or changed-balance orders, duplicate item voids as no-ops, and table transfers to occupied tables. A shared 24-hour `IdempotencyRecord` response store now caches duplicate `POST`, `PATCH`, and `DELETE` requests carrying `Idempotency-Key` after tenant resolution, rejects key reuse with different route/body/params/query data, and the POS UI sends keys for live payment, room-charge, status, and manager mutations. Manager review endpoints and a POS review panel now list conflicted/rejected offline actions and allow managers to mark them reviewed.

Queue entry:

```json
{
  "id": "uuid",
  "action": "string",
  "payload": {},
  "idempotencyKey": "uuid",
  "createdAt": "timestamp",
  "retries": 0
}
```

Flush in order on reconnect. Retry failed requests up to `OFFLINE_QUEUE_MAX_RETRIES`. Show an offline indicator in the POS header.

### Task 6.2 - Conflict Resolution

| Conflict | Resolution |
|---|---|
| Same item voided twice | Second void is a no-op and returns success |
| Order closed while offline payment recorded | Verify totals, reject or log conflict for manager review |
| Table transferred to occupied table | Reject and return current table occupant |
| Payment posted to already-closed order | Reject with clear error unless it is provider reconciliation for an existing pending payment |

### Task 6.3 - Idempotent Mutation Endpoints

All mutation endpoints accept `Idempotency-Key`.

Store for 24 hours:

- Tenant id
- Actor id
- Route/action
- Request hash
- Response status
- Response body
- Expiry timestamp

Critical endpoints:

- Order create
- Item add/update/remove/void
- Course fire
- Payment record
- Folio charge
- Close bill

Status as of 2026-05-26: implemented as a global API interceptor for authenticated tenant-scoped mutations that include `Idempotency-Key`. Duplicate exact requests return the stored response for 24 hours; mismatched reuse is rejected.

## Phase 7 - Reporting and Reconciliation

### Task 7.1 - End-of-Day Z-Report

Status as of 2026-05-26: first backend and UI slice implemented. `GET /reports/restaurant-z-report` and `GET /reports/restaurant-z-report.csv` return date-range, property, and restaurant filtered summaries for closed orders, including order count, covers, gross and confirmed revenue, tax, service charge, discounts, revenue by payment method, top items, void reasons, average order value, and average covers per table. The manager POS screen links to JSON and CSV exports for the selected restaurant and business date.

Fields:

- Total orders, covers, and revenue.
- Revenue by payment method.
- Tax collected.
- Service charge collected.
- Discounts by manager approval.
- Voids with reasons.
- Top 10 items by quantity sold.
- Average order value.
- Average covers per table.

### Task 7.2 - Shift Report

Status as of 2026-05-26: first backend and UI slice implemented. `GET /reports/restaurant-shift-report` and `GET /reports/restaurant-shift-report.csv` aggregate closed restaurant orders by waiter/actor for the selected date, property, and restaurant, including orders handled, covers, net sales, payments collected, payment variance, and average order value. The manager POS report panel can switch between Z-report and shift report. This is actor-grouped reporting from existing audit/order fields; formal shift start/end records remain future work.

- Per-waiter orders handled, total value, and tips if supported.
- Opens at shift start and closes at shift end.
- Linked to audit logs.

### Task 7.3 - Live Manager Dashboard

Status as of 2026-05-26: first backend and UI slice implemented. `GET /reports/restaurant-live-dashboard` returns open order count/value/outstanding value, active table count and covers in-house, confirmed room-charge totals, KDS station queue depth, and average prep minutes by course where timestamps exist. The manager POS screen now shows a refreshable live dashboard for the selected restaurant.

- Open orders count and value.
- Covers in-house.
- Average order-to-served time by course.
- KDS station queue depth.
- Outstanding room charge balance.

## Phase 8 - Missing Essentials

### Task 8.1 - Allergen and Dietary Flags

Status as of 2026-05-28: first slice implemented. `MenuItem` now stores allergen and dietary flag arrays with a reviewed migration, the restaurant API accepts and returns those flags, POS menu management can assign them, POS menu tiles display compact badges, and KDS tickets show dietary details plus prominent allergen warnings in the browser print ticket.

Add to `MenuItem`:

- `allergens`: nuts, gluten, dairy, eggs, shellfish, soy.
- `dietary`: vegan, vegetarian, halal, kosher, gluten_free.

Display flags on POS and customer menu. Print allergen warnings prominently on kitchen tickets.

### Task 8.2 - QR Code Table Ordering

Status as of 2026-05-29: first slice implemented. Tables now get stable `/menu/:restaurantId/:tableId` QR links, the POS table panel exposes the public menu link, `GET /public/menu/:restaurantId/:tableId` serves an unauthenticated guest menu with allergen/dietary flags, and `POST /public/menu/:restaurantId/:tableId/orders` creates a draft/pending table order for staff confirmation without firing kitchen tickets. The public `/menu/:restaurantId/:tableId` page lets guests browse categories, build a cart, and submit the order for waiter confirmation. POS now labels draft QR orders as guest submissions, shows the full item list for waiter/manager verification, blocks settlement until confirmation, provides `Confirm & send` to move accepted orders into the normal sent/kitchen flow, and provides a two-step reject action that cancels declined guest submissions before kitchen firing.

- Each table has a unique QR link to `/menu/:restaurantId/:tableId`.
- Guest menu supports browsing and order submission.
- Submitted guest orders stay pending until waiter confirmation.
- Waiter can confirm or reject before firing to kitchen.

### Task 8.3 - Reservation and Waitlist

Status as of 2026-05-29: first slice implemented. The database now has a `Reservation` model with confirmed, waitlisted, seated, cancelled, and no-show states plus `ReservationItem` rows for optional pre-order/requested menu items. The restaurant API returns active reservations with table suggestions and requested items, supports creating reservations/waitlist entries with menu selections, and lets restaurant managers update status/table assignments while keeping table status aligned. The POS floor map now includes a booking and waitlist panel with a modal booking form for guest name, party size, time, optional table, notes, requested items, suggested tables, seating, and status changes. The public QR menu can submit guest reservation requests with optional requested items; staff can filter guest requests, confirm/waitlist/cancel them, edit them, and start the normal order flow from a reservation while preserving the reservation source on the order.

Add `Reservation`:

```prisma
model Reservation {
  id          String @id @default(cuid())
  tenantId    String
  propertyId  String
  restaurantId String
  guestName   String
  guestId     String?
  partySize   Int
  scheduledAt DateTime
  tableId     String?
  status      ReservationStatus
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Statuses: `confirmed`, `seated`, `cancelled`, `no_show`.

Add walk-in waitlist and table suggestions after the floor map is stable.

### Task 8.4 - Menu Item Stock and 86 List

Status as of 2026-05-28: first slice implemented. `MenuItem` now stores stock tracking, current stock, and availability fields with a reviewed migration. Restaurant managers can create tracked-stock items, mark items 86/unavailable, restore availability, and adjust stock from POS menu setup. Staff POS and public QR menus block unavailable items, public QR menus hide unavailable items, and sent/fired staff orders decrement tracked stock atomically, auto-marking items unavailable when stock reaches zero. Offline order replay now conflicts when stock is no longer available. More granular stock audit events and stock restoration history remain future work.

Add to `MenuItem`:

- `stockEnabled Boolean`
- `currentStock Int?`
- `isAvailable Boolean`

Rules:

- Decrement stock on confirmed order item creation or fire, based on chosen business policy.
- When stock reaches zero, mark unavailable.
- KDS and POS show unavailable items clearly.
- Manager can restore stock or disable item.

### Task 8.5 - Front-of-House Notifications

Status as of 2026-05-28: implemented as an in-app SSE and browser notification slice. The restaurant POS now subscribes to the tenant-scoped kitchen event stream for the selected restaurant, filters service alerts to the current waiter's assigned tables unless the user is a manager, and displays dismissible front-of-house alerts for `course_ready` and `order_alert`. Kitchen item-ready updates now emit `order_alert` with a waiter-facing message, while existing `course_ready` events continue to fire when all items in a course are ready. The POS also derives alerts from refreshed order state so missed SSE events still surface, and users can opt in to browser notifications from the restaurant header.

- Waiter device subscribes to assigned table events.
- Events: `course_ready`, `order_alert`.
- Add browser push notifications after in-app SSE notifications are reliable.

## Validation Rules Reference

| Rule | Scope |
|---|---|
| Only manager/admin can void items | Item void |
| Only manager/admin can apply discounts above threshold | Discount |
| Cannot add items to closed or cancelled order | Item add |
| Cannot fire items already fired | Item fire |
| Cannot close order with outstanding balance | Bill close |
| Cannot charge to room if stay is checked out | Room charge |
| Tax and totals are always server-calculated | All orders |
| All payments are append-only | Payments |
| Audit log entry required for every state change | All mutations |
| Webhooks must verify signature, provider status, metadata, amount, currency, and duplicate reference | Provider webhooks |

## Build Order Summary

| Phase | Priority | Blocks |
|---|---|---|
| 0 - Security fixes | Critical | Nothing ships without this |
| 1 - Schema upgrade | Critical | All downstream phases |
| 2 - Order lifecycle API | High | PMS, KDS, POS |
| 3 - Charge to room | High | Hotel differentiation |
| 4 - Real KDS | High | Kitchen operations |
| 5 - POS UI upgrade | Medium | Usability |
| 6 - Offline reliability | Medium | Tablet reliability |
| 7 - Reporting | Medium | Operations |
| 8 - Essentials | Low-Medium | Compliance and growth |

## Definition of Done Per Phase

Each phase is complete only when:

- Prisma migration is generated and reviewed.
- API validation and role checks are implemented.
- Tenant/property/restaurant scope checks are covered.
- Audit logs are written for state changes.
- Unit or integration tests cover success, authorization failure, tenant mismatch, duplicate idempotency key, and invalid state transitions.
- UI behavior is verified in browser for any frontend phase.
- `.env.example` and docs are updated for new config.
