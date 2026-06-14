# Hotel Module Production Build Plan

Last reviewed: 2026-06-13

This plan is the implementation source of truth for hardening the hotel operations module before the finance and inventory build. Work through phases in order. The goal is to bring hotel operations to the same production-readiness level as the restaurant module.

## Current App Fit

This repository already has a hotel operations foundation:

- `Property` stores hotel/property settings including currency, timezone, tax rate, and service charge rate.
- `Room` stores room inventory and operational room status.
- `Guest` stores checked-in guest identity.
- `Stay` stores active and checked-out stays. Today, `Stay.id` is also used as the current `folioId`.
- `FolioCharge` stores posted room charges, currently mostly restaurant charge-to-room records.
- `Payment` already has optional `folioId`.
- `OrderPayment.method = room_charge` supports charging restaurant orders to a room.
- `FoliosController` supports active stay search, posting restaurant orders to folios, and restaurant room-charge reports.
- `PropertiesController` supports property creation, room creation, check-in, check-out, and room status changes.

Important current limitation:

There is no separate `GuestFolio` model yet. The current MVP treats `Stay` as the folio anchor. That is acceptable for the first hardening steps, but finance and invoices will need an explicit folio layer later.

## Cross-Cutting Rules

- Enforce tenant and property scope in every query.
- Do not trust client-sent monetary totals. The server calculates room charges, taxes, service charges, deposits, balances, and checkout totals.
- Use `Decimal` for money and store `currency` or `currencyCode` on every monetary row.
- Every check-in, checkout, folio charge, adjustment, payment, room move, and status change must be auditable.
- Use database transactions for check-in, checkout, room move, room charge posting, folio settlement, and invoice generation.
- Do not allow destructive edits after checkout or after a folio is locked.
- Separate operational state from financial posting:
  - Room/stay status drives hotel operations.
  - Folio line items drive the guest bill.
  - Invoices and finance transactions drive accounting.
- Prefer typed Prisma enums over free-form status strings for new workflow fields.
- UI role gating is convenience only. Server-side guards are required.
- All `FolioLineItem` records are append-only. Corrections go through `FolioAdjustment`; do not update or delete posted line items.
- Folios can only be locked when balance is zero or authorized, no pending restaurant room-charge payments exist, and all deposits are applied or refunded.
- Rate lookup is server-side only.
- Checkout is idempotent. Repeating checkout for an already closed stay returns the existing closed state without re-running settlement.
- Room status changes follow a state machine. Skipping states requires manager override and an audit log entry.

Room status machine:

```text
available -> occupied -> dirty -> cleaning -> inspected -> available
```

Initial compatibility note:

The existing app currently uses `cleaning` immediately after checkout. Add `dirty` and `inspected` when the housekeeping workflow is introduced, then migrate checkout to set `dirty`.

## Phase 0: Baseline Stabilization

Goal: make the current hotel module safer without changing the product shape too much.

- [x] Replace new hotel workflow free-form status fields with Prisma enums where practical.
- [x] Add audit logging for room status changes.
- [x] Add audit logging for check-in and checkout.
- [x] Add idempotency keys for check-in and checkout endpoints.
- [x] Add stronger checkout validation for active stay and room state.
- [x] Prevent manual room status changes that conflict with active stays.
- [x] Add basic hotel smoke tests for property, rooms, check-in, restaurant room charge, and checkout.
- [x] Add clear errors for unsupported currency and invalid checkout dates.

Current endpoints to harden:

- `GET /properties`
- `POST /properties`
- `POST /properties/:propertyId/rooms`
- `PATCH /properties/:propertyId/rooms/:roomId/status`
- `POST /properties/:propertyId/rooms/:roomId/check-in`
- `POST /properties/:propertyId/rooms/:roomId/check-out`
- `GET /stays/active`
- `POST /folios/:folioId/charges`

Smoke test:

- `pnpm smoke:hotel` runs an authenticated end-to-end API smoke test against local or staging.
- Required env: `RAYAAN_SMOKE_TOKEN`.
- Optional env: `RAYAAN_SMOKE_API_URL`, defaulting to `http://localhost:4000/api`.
- The smoke creates isolated property, room, restaurant, menu item, order, room charge, and checkout records.

## Phase 1: Room Types and Rate Plans

Goal: stop treating room type as a plain string and prepare for automatic room charges.

- [x] Add `RoomType` model.
- [x] Link `Room.roomTypeId` to `RoomType`.
- [x] Keep a backward-compatible room type snapshot during migration.
- [x] Add `RatePlan` model.
- [x] Add `RoomRate` model for date-bounded rates.
- [x] Add `CancellationPolicy` model linked to rate plan.
- [x] Add exact `RoomRate` fields before implementation.
- [x] Support base occupancy and extra guest pricing.
- [x] Add seasonal/date-range pricing.
- [x] Add property-level default currency.
- [x] Add server-side rate lookup helper.
- [x] Build room type and rate plan management UI.

Status as of 2026-06-03: Phase 1 is implemented. The Prisma schema now includes `RoomType`, `RatePlan`, `RoomRate`, and `CancellationPolicy`; `Room.roomTypeId` links rooms to a first-class room type while preserving the existing `Room.type` snapshot. The migration backfills existing room snapshots into legacy room type records, and room batch creation now creates or reuses a room type for new rooms. `HotelRateLookupService` now resolves reservation overrides, date-bounded room rates, rate plan defaults, and room type defaults, and `GET /properties/:propertyId/rates/lookup` exposes a guarded server-side lookup. The property workspace now has room type, rate plan, date-rate, and quote-check management panels.

Minimum models:

- `RoomType`
- `RatePlan`
- `RoomRate`
- `CancellationPolicy`

Suggested `RoomRate` fields:

- `tenantId`
- `propertyId`
- `ratePlanId`
- `roomTypeId`
- `startDate`
- `endDate`
- `baseRate`
- `extraGuestRate`
- `baseOccupancy`
- `minNights`
- `currency`
- `isActive`

Rate lookup priority:

```text
reservation rate override -> RoomRate date range -> RatePlan default -> property default
```

Cancellation policy fields:

- `ratePlanId`
- `freeCancellationUntilHours`
- `penaltyType`
- `penaltyValue`
- `noShowPenaltyType`
- `noShowPenaltyValue`

Cancellation/no-show penalties post as folio line items when applicable.

Suggested statuses:

- `active`
- `inactive`

## Phase 2: Reservations

Goal: add proper hotel reservations before check-in.

- [x] Add `HotelReservation` model.
- [x] Add `HotelReservationGuest` or link reservation to `Guest`.
- [x] Add reservation status workflow.
- [x] Add arrival and departure dates.
- [x] Add room type requested.
- [x] Add optional room assignment before arrival.
- [x] Add deposit requirement fields.
- [x] Add reservation guarantee support.
- [x] Add source/channel field: walk-in, phone, direct, OTA, corporate.
- [x] Add notes and special requests.
- [ ] Add reservation confirmation notification.
- [x] Add reservation list/calendar UI.
- [x] Add availability search by date, room type, and property.
- [x] Convert reservation to stay during check-in.

Status as of 2026-06-03: first reservation slice implemented. The database now has `HotelReservation`, `HotelReservationGuest`, and `ReservationGuarantee` with typed reservation status/source/guarantee enums. `Stay` can now link back to the hotel reservation that created it. The property API lists and creates hotel reservations, updates reservation status, checks availability by date/room type/property, blocks assigned-room overlaps with active stays or active reservations, and converts confirmed/guaranteed reservations into active stays during check-in. The property workspace now includes a hotel reservations panel with a booking form, arrival list, and assigned-room check-in action. Confirmation notifications remain next.

Reservation statuses:

- `draft`
- `confirmed`
- `guaranteed`
- `checked_in`
- `checked_out`
- `cancelled`
- `no_show`

Guarantee and deposit rules:

- Deposit = money collected before/during stay and applied to folio balance.
- Guarantee = payment method held for no-show/cancellation risk, not money collected.
- A guaranteed reservation may have no deposit.
- A deposit should create a `FolioLineItem(type = "deposit")` when the folio is opened.

Minimum guarantee model:

- `ReservationGuarantee`

Suggested guarantee fields:

- `reservationId`
- `method`
- `provider`
- `providerToken`
- `status`
- `createdAt`
- `updatedAt`

Important rule:

```text
Reservation = future intent
Stay = actual occupancy
Folio = running bill
Invoice = official financial document
```

## Phase 3: Explicit Guest Folios

Goal: introduce a real folio model while preserving current `Stay` behavior.

- [x] Add `GuestFolio`.
- [x] Add `FolioLineItem`.
- [x] Add `FolioPayment`.
- [x] Add `FolioAdjustment`.
- [x] Link `GuestFolio` to `Stay`, `Guest`, `Property`, and `Tenant`.
- [x] Backfill one folio for each active or historical stay.
- [x] Migrate `FolioCharge` into `FolioLineItem` or keep it temporarily as a compatibility table.
- [x] Use `GuestFolio.id` as the new `folioId`.
- [x] Keep support for old `Stay.id` folio references during migration.
- [x] Add folio status: open, pending_checkout, closed, locked, void.
- [x] Add folio detail API and UI.

Status as of 2026-06-13: explicit folio foundation is implemented. `GuestFolio`,
`FolioLineItem`, `FolioPayment`, and `FolioAdjustment` now exist with typed folio
statuses and append-only line item types. The migration backfills one folio for
each existing stay, links legacy `FolioCharge` rows to the matching folio, and
copies legacy room charges into `FolioLineItem`. New check-ins create an open
folio and checkout closes it. `GET /stays/active` now returns `GuestFolio.id`
as `folioId` when present, while `POST /folios/:folioId/charges` still accepts
old `Stay.id` folio references during the migration window.

Status as of 2026-06-13: folio detail API and first UI view are implemented.
`GET /folios/:folioId` returns folio status, balance, stay, guest, room, line
items, payments, adjustments, and legacy charges. The property room cards can
open the current stay's folio and show line items, payments, legacy room
charges, and summary totals.

Line item types:

- `room_night`
- `restaurant_charge`
- `manual_charge`
- `tax`
- `service_charge`
- `discount`
- `deposit`
- `refund`
- `adjustment`

Suggested `FolioAdjustment` fields:

- `tenantId`
- `propertyId`
- `folioId`
- `lineItemId`
- `amount`
- `currency`
- `reason`
- `authorizedById`
- `createdById`
- `createdAt`

Adjustment rules:

- Positive and negative adjustments are allowed.
- Manager authorization is required above the configured threshold.
- Adjustment creates a new append-only correction record and audit log entry.

Folio statuses:

- `open`
- `pending_checkout`
- `closed`
- `locked`
- `void`

## Phase 4: Automatic Room Charges

Goal: post nightly room charges from reservations/stays instead of relying only on manual charges.

- [x] Calculate nightly charge from assigned room/rate plan.
- [x] For MVP, create room-night folio line items at check-in for the reserved stay dates.
- [x] Document that later night audit will replace upfront posting.
- [x] Add taxes and service charges from configurable property/rate settings.
- [x] Support rate override with permission.
- [x] Support complimentary stays.
- [x] Support late checkout and extra-night charges.
- [ ] Add early check-in and late checkout fee configuration.
- [ ] Support manual re-post/recalculate for open folios only.
- [ ] Add nightly audit job later.

Status as of 2026-06-14: MVP room-night posting is implemented at check-in.
When a room has a configured room type/rate plan/date rate, the server uses
`HotelRateLookupService` to create append-only `FolioLineItem(type =
"room_night")` records. If the property has `serviceChargeRate` or `taxRate`
configured, check-in also posts append-only `service_charge` and `tax` folio
line items using the same calculation order as restaurant totals: room subtotal,
then service charge, then tax on subtotal plus service charge. Missing rate
configuration does not block check-in yet; it simply leaves the folio without
automatic room-night lines so existing front-desk workflows keep working. A
future night audit can replace this upfront posting model.

Status as of 2026-06-14: reservation rate override is permission gated.
Users with `property.manage` can enter a one-off nightly override while creating
a reservation. The API rejects override attempts from users without that
permission, and check-in uses the saved override when posting room-night folio
line items.

Status as of 2026-06-14: complimentary reservations are supported for property
managers. A complimentary reservation stores an optional reason, cannot also use
a rate override, and check-in opens the guest folio without posting automatic
room-night, service-charge, or tax line items.

Status as of 2026-06-14: checkout posts extra-night charges when the actual
hotel checkout date is later than the stay's expected checkout date. The server
requires checkout acknowledgement before posting those extra room-night,
service-charge, and tax folio lines. Same-day hourly late checkout fees remain
part of the later fee-configuration task.

Posting rule:

```text
Stay.checkIn -> FolioLineItem(type = "room_night")
```

MVP rate-change behavior:

Upfront room-night charges use the rate snapshot at check-in. If rates change after check-in, existing open folios are not changed automatically. A manager can correct open folios through `FolioAdjustment`.

Early check-in / late checkout config:

- `earlyCheckInBeforeTime`
- `earlyCheckInFeeType`
- `earlyCheckInFeeValue`
- `lateCheckoutAfterTime`
- `lateCheckoutFeeType`
- `lateCheckoutFeeValue`

## Phase 5: Charge-to-Room Hardening

Goal: improve the existing restaurant charge-to-room workflow.

- [ ] Update restaurant charge-to-room to post to `GuestFolio` once explicit folios exist.
- [ ] Keep idempotent posting with source references.
- [ ] Link restaurant order, order payment, and folio line item in the same transaction.
- [ ] Prevent duplicate room charge for the same restaurant order.
- [ ] Show room charge details on folio detail page.
- [ ] Allow reversal only through an adjustment or refund workflow.
- [ ] Add audit log for charge-to-room posting and reversal.

Posting rule:

```text
RestaurantOrder charged to room -> FolioLineItem(type = "restaurant_charge", sourceType = "restaurant_order")
```

## Phase 6: Checkout and Settlement

Goal: make checkout a controlled settlement process.

- [ ] Add checkout preview endpoint.
- [ ] Show folio balance, payments, deposits, taxes, and outstanding amount.
- [ ] Apply deposits in checkout preview.
- [ ] Refund or carry forward excess deposits.
- [ ] Require settlement or authorized balance before final checkout.
- [ ] Allow partial payment with remaining balance only for approved account/corporate stays.
- [ ] Add explicit folio settlement payment methods.
- [ ] Block folio lock if any pending restaurant room-charge payment exists.
- [ ] Close and lock folio on checkout.
- [ ] Update room to `cleaning`.
- [ ] Generate customer invoice from closed folio.
- [ ] Post revenue/payment records to finance ledger once finance module exists.
- [ ] Add checkout receipt/print view.

Checkout flow:

```text
Preview folio -> Collect/confirm payment -> Close folio -> Check out stay -> Room cleaning -> Generate invoice
```

Folio settlement payment methods:

- `cash`
- `card_manual`
- `paystack`
- `bank_transfer`
- `mobile_money_manual`
- `voucher`
- `complimentary`
- `company_account`

Corporate interim rule:

Until company billing rules and credit limits are implemented, corporate stays check out like regular guest stays. `company_account` settlement should remain owner/admin/accountant-only and require an audit note.

Folio lock pre-checks:

- Balance is zero, paid, or explicitly authorized.
- No pending `OrderPayment(method = room_charge)` records are linked to the folio.
- Deposits are fully applied, refunded, or carried forward.
- Folio has not already been locked.

## Phase 7: Housekeeping and Maintenance

Goal: make room status operationally useful for staff.

- [ ] Add housekeeping task model.
- [ ] Auto-create cleaning task after checkout.
- [ ] Add room inspection status.
- [ ] Add maintenance request model.
- [ ] Allow housekeeping to mark room clean.
- [ ] Allow supervisor/admin to inspect and release room.
- [ ] Allow maintenance to mark room out of order.
- [ ] Track reason, assigned user, priority, and resolution notes.
- [ ] Add housekeeping board UI.
- [ ] Add maintenance board UI.

Housekeeping statuses:

- `dirty`
- `cleaning`
- `inspected`
- `available`

Maintenance statuses:

- `open`
- `in_progress`
- `resolved`
- `cancelled`

## Phase 8: Availability and Room Moves

Goal: support real front-desk operations.

- [ ] Add availability search endpoint.
- [ ] Support room blocks for maintenance/out-of-order dates.
- [ ] Add room move endpoint.
- [ ] Move active stay from one room to another in a transaction.
- [ ] Audit previous and new room.
- [ ] Prevent room move into occupied/out-of-order room.
- [ ] Update room statuses correctly after move.
- [ ] Add arrival/departure/occupancy dashboard.

## Phase 9: Guest Profiles and Company Accounts

Goal: prepare customer accounts for invoices and repeat guests.

- [ ] Add reusable guest profile matching by email/phone.
- [ ] Avoid creating duplicate guest records where possible.
- [ ] Add company/corporate account model.
- [ ] Link reservation/stay/folio/invoice to customer account.
- [ ] Add guest history page.
- [ ] Add company billing rules later.

Guest deduplication rules:

- Exact normalized email match in the same tenant = reuse existing guest profile.
- Phone match plus similar name = suggest merge, do not auto-merge.
- No email and no safe phone/name match = create a new guest profile.
- Admins can manually merge guest profiles later.
- Preserve historical stays when profiles are merged.

Corporate billing interim rule:

Corporate source/channel is allowed before full billing rules exist, but checkout still requires ordinary settlement unless an owner/admin/accountant selects `company_account` and records an approval note.

## Phase 9.5: Guest Notifications

Goal: send basic operational messages for reservations and checkout.

- [ ] Add `GuestNotification` model.
- [ ] Send reservation confirmation email.
- [ ] Send check-in confirmation later.
- [ ] Send checkout receipt email.
- [ ] Record notification status and provider response.
- [ ] Use Resend once production email settings are configured.

Notification types:

- `reservation_confirmation`
- `check_in_confirmation`
- `checkout_receipt`
- `payment_receipt`
- `reservation_cancelled`

Notification channels:

- `email`
- `sms`
- `whatsapp`

## Phase 10: Reports

Goal: provide hotel operational reports before full finance reporting.

- [ ] Arrival list.
- [ ] Departure list.
- [ ] In-house guest list.
- [ ] Occupancy report.
- [ ] Room status report.
- [ ] Folio balance report.
- [ ] Posted room charges report.
- [ ] No-show/cancellation report.
- [ ] Housekeeping productivity report.
- [ ] Maintenance issue report.

## Phase 11: UI Restructure

Goal: split the current property page into real hotel workspaces.

Current `Properties` page is doing too much. Split into:

- Properties/settings
- Rooms
- Reservations
- Front desk
- Folios
- Housekeeping
- Maintenance
- Reports

Recommended first UI pass:

- Keep existing `Properties` route for property/room setup.
- Add `/app/hotel/front-desk`.
- Add `/app/hotel/folios`.
- Add `/app/hotel/housekeeping`.
- Add `/app/hotel/reports`.

## Initial MVP Scope

Build this first:

- Room types and rate plans.
- Hotel reservations.
- Explicit guest folios.
- Automatic room-night charges.
- Folio detail page.
- Checkout preview and settlement.
- Housekeeping task creation after checkout.
- Hotel smoke tests.

Defer this until after MVP:

- Channel manager/OTA integration.
- Night audit automation.
- Corporate credit limits.
- Advanced group bookings.
- Multi-room reservations.
- Advanced housekeeping productivity analytics.
- Native accounting exports.

## Implementation Notes

- Use Prisma migrations for schema changes.
- Keep `Stay.id` compatibility until all restaurant room-charge paths use `GuestFolio.id`.
- Backfill existing stays into folios before switching UI/API contracts.
- Store source references on folio line items for reconciliation.
- Use append-only line items and adjustments instead of destructive charge edits.
- Do not lock or close folios until checkout settlement is complete.
- Make checkout idempotent.
- Do not build finance ledger coupling until hotel folio source records are stable.
