# Product Requirements Document: Offline-First Hotel and Restaurant Management System

## 1. Executive Summary

### 1.1 Product Vision

Build a cloud-based, offline-first Hotel and Restaurant Management System for a single mid-size to large hotel property with 100 to 500+ rooms. The product must keep critical front desk, housekeeping, maintenance, restaurant, kitchen, and guest ordering operations running during internet outages, then synchronize safely when connectivity returns.

The system combines a Property Management System (PMS), direct online reservation engine, restaurant POS, table management, QR ordering, Kitchen Display System (KDS), guest portal, billing, and operational reporting into one standalone platform.

### 1.2 Core Value Proposition

Hotel and restaurant staff can continue serving guests even when the internet is unavailable. Critical actions are captured locally, protected against data loss, visible to relevant staff, and synchronized automatically when the connection is restored.

### 1.3 Target Property

| Attribute | Requirement |
|---|---|
| Property type | Single-property hotel with restaurant operations |
| Scale | 100 to 500+ rooms |
| Deployment | Cloud-hosted web application with offline-first PWA clients |
| Initial channel scope | Native booking engine only, no OTA integrations in MVP |
| Payment provider | Stripe or equivalent online payment processor |
| Primary users | Reception, housekeeping, maintenance, restaurant waitstaff, kitchen, managers, guests |

### 1.4 Success Metrics

| Metric | Target |
|---|---|
| Offline continuity | Core hotel and restaurant workflows remain usable for at least 8 continuous hours offline |
| Data durability | Zero confirmed data loss during a 2-hour simulated outage across active devices |
| Sync speed | 95% of queued offline actions sync within 30 seconds after reconnection under typical hotel load |
| Check-in efficiency | Reduce average check-in time by 40% compared with manual fallback process |
| Restaurant continuity | 99% of offline restaurant orders are available to kitchen or print queue within 5 seconds locally |
| Conflict visibility | 100% of detected sync conflicts appear in the admin conflict dashboard |
| QR menu performance | Cached QR menu loads in under 2 seconds on poor 2G after first successful cache |

### 1.5 MVP Scope

| Priority | Scope |
|---|---|
| P0 | Reservations, front desk check-in/check-out, room management, folios, restaurant POS, table management, KDS, QR ordering, charge-to-room, offline queue, sync engine, roles and permissions |
| P1 | Guest profiles, housekeeping supply logging, inventory usage logging, duplicate guest detection, operational dashboards |
| P2 | Advanced analytics, recipe costing, loyalty, advanced guest preferences, revenue optimization |

### 1.6 Explicit Non-Goals for MVP

| Area | Non-Goal |
|---|---|
| OTA/channel manager | No Booking.com, Expedia, Airbnb, GDS, or channel manager integration in MVP |
| Multi-property | No cross-property inventory, user federation, or corporate reporting |
| Offline card processing | No offline credit card authorization or storage of raw card data |
| Full accounting suite | No general ledger, payroll, tax filing, or procurement accounting in MVP |
| Advanced CRM | No marketing automation or loyalty engine in MVP |

## 2. Users, Personas, and Operating Context

### 2.1 User Personas

| Persona | Primary Goals | Offline Needs |
|---|---|---|
| Front desk agent | Create reservations, check guests in/out, assign rooms, manage folios | Access cached arrivals, rooms, rates, guest-room map, folio transactions, receipt and registration print queue |
| Front office manager | Monitor occupancy, resolve exceptions, approve overrides | Review offline conflicts after sync; limited offline supervisor approval |
| Housekeeper | See assigned rooms, update clean/dirty status, log minibar or supplies | Continue updating room statuses and task notes offline |
| Maintenance technician | Update room maintenance status, log issue resolution | Mark room out-of-service or resolved offline |
| Restaurant host | Seat guests, manage table availability and waitlist | Use cached floor plan and waitlist offline |
| Waitstaff | Take orders, split bills, print tickets, charge to room | Full order capture, local ticket printing, cached room-charge validation |
| Kitchen staff | View and progress orders | Receive local or synced orders, update preparing/ready status, print tickets |
| Manager/admin | Configure system, resolve conflicts, view reports, manage users | Admin functions mostly online; conflict resolution requires online |
| Guest | Book online, order from QR menu, view folio | QR menu and draft order can work offline after cache; guest folio online only |

### 2.2 Operating Assumptions

| Assumption | Product Implication |
|---|---|
| Hotel may lose internet while local WiFi remains available | Devices can communicate with local printers and maintain local storage, but cloud sync pauses |
| Some devices may go offline independently | Sync must be per-device, idempotent, and resumable |
| Stripe requires connectivity | Offline reservations and check-ins cannot capture new card authorizations until online |
| Guests may use unmanaged devices for QR ordering | Guest offline capability is limited and must not expose sensitive hotel data |
| Staff devices may be shared | Require local session expiry, role-based permissions, and encrypted local cache |

## 3. Product Principles

1. Offline actions must be durable before the UI reports success.
2. Every offline mutation must have a unique action ID, timestamp, device ID, actor ID, and idempotency key.
3. Staff should see whether data is synced, pending, failed, or conflicting.
4. Critical workflows must degrade gracefully when online-only services are unavailable.
5. The system must never silently overwrite high-risk business data without an audit trail.
6. Payments, identity documents, and personally identifiable information require stricter storage controls than ordinary operational data.

## 4. Functional Requirements: Hotel Modules

### 4.1 Online Reservation Engine

**P0** Native booking engine for hotel website

| Requirement | Details |
|---|---|
| Booking widget | Embeddable widget or hosted booking page using hotel branding |
| Availability | Real-time room type availability when online |
| Guest flow | Select dates, room type, guest count, add-ons if enabled, enter guest details, pay deposit/prepayment |
| Payments | Support Stripe PaymentIntent for deposit, pre-authorization, or full prepayment when online |
| Confirmation | Send email/SMS confirmations only after online booking succeeds |
| Staff visibility | Confirmed online reservations appear in front desk arrival list |
| Offline fallback | Staff may manually create pending reservations offline using cached availability and room/rate data |

*User story: As a guest, I want to book a room and pay with a card through the hotel website so that my reservation is guaranteed.*

*User story: As a front desk agent, I want to create a walk-in reservation while offline so that I can serve guests during an outage.*

Acceptance criteria:

- Guest cannot complete online payment if payment provider is unreachable.
- Online reservations have confirmed payment status only after payment provider confirmation.
- Offline staff-created reservations are marked `pending_sync` and `payment_pending`.
- Availability warnings are shown if cached availability is stale.
- Double-booking risk from offline reservations is detected during sync and surfaced to admin.

### 4.2 Front Desk Check-In and Check-Out

**P0** Offline-capable check-in and check-out

| Requirement | Details |
|---|---|
| Cached arrivals | Store upcoming arrivals, in-house guests, assigned rooms, rates, taxes, and guest-room mapping locally |
| Offline check-in | Assign room, mark reservation checked in, capture signature if enabled, print registration card |
| ID capture | Scan or upload ID image offline; encrypt locally; upload when online |
| Room assignment | Use cached room inventory and status; warn when status may be stale |
| Offline check-out | Generate provisional folio using cached rates, taxes, and locally known charges |
| Finalization | Final invoice is generated after sync validates all pending charges and payment state |
| Print queue | Registration cards, folios, and receipts queue locally if printer unavailable |

*User story: As a receptionist, I want to check in a guest even when internet is down so that hotel operations do not stop.*

*User story: As a receptionist, I want to see pending restaurant charges before checkout so that I do not accidentally undercharge a guest.*

Acceptance criteria:

- Check-in can be completed offline for cached reservations and walk-ins.
- Offline check-in creates a durable local action before updating the UI.
- Offline check-out produces a provisional folio clearly labeled as provisional.
- If pending restaurant charges exist, checkout UI displays a warning before folio closure.
- Synced checkout creates final folio and invoice number from server authority.

### 4.3 Room Management

**P0** Room inventory and status management

| Status | Meaning |
|---|---|
| Available | Room is unoccupied and can be assigned |
| Occupied | Room is currently occupied |
| Dirty | Room requires cleaning |
| Clean | Room is ready after housekeeping |
| Inspected | Optional supervisor-approved clean state |
| Out-of-Service | Room cannot be sold due to maintenance or operational block |
| Maintenance | Room has active maintenance issue |

| Requirement | Details |
|---|---|
| Offline status updates | Housekeeping, front desk, and maintenance can update status offline |
| Conflict detection | Conflicts detected when same room status is changed by multiple actors from different base versions |
| Conflict UI | Room list shows conflict badge and last known states |
| Audit trail | Every status change logs actor, time, device, prior value, new value, and sync status |
| Assignment safety | Front desk receives warning before assigning room with stale or conflicting status |

*User story: As a housekeeper, I want to mark rooms clean while offline so that front desk can use the latest known status when service resumes.*

Acceptance criteria:

- Room status updates are available offline on staff devices with room cache.
- Conflict is created when local update base version differs from server version.
- Admin can accept one value or manually choose another resolved status.
- Room status history is never deleted during conflict resolution.

### 4.4 Housekeeping

**P0** Housekeeping task execution

| Requirement | Details |
|---|---|
| Task list | View assigned rooms and cleaning priority from local cache |
| Status updates | Mark dirty, clean, inspected, minibar checked, do-not-disturb, or maintenance needed |
| Supply logging | Log supplies used offline and sync later |
| Notes/photos | Optional issue notes and photos stored encrypted locally until upload |

*User story: As a housekeeper, I want to keep updating my assigned room list during an outage so that the front desk has accurate information when sync returns.*

Acceptance criteria:

- Housekeeping device can update status without internet.
- Supply logs sync as append-only events.
- Photos remain encrypted locally and retry upload until successful.

### 4.5 Maintenance

**P0** Maintenance issue logging and room blocking

| Requirement | Details |
|---|---|
| Issue creation | Staff can create maintenance issue from room detail |
| Room block | Authorized users can mark room out-of-service |
| Resolution | Maintenance can mark issue resolved with notes |
| Offline behavior | Issue and room status changes queue locally |

*User story: As a maintenance technician, I want to mark a room out-of-service offline so that it is not accidentally sold while repairs are underway.*

Acceptance criteria:

- Out-of-service changes are high-risk conflicts and must be reviewed if server state changed.
- Maintenance issue notes are append-only.
- Front desk sees local out-of-service status immediately on same device and after sync on all devices.

### 4.6 Guest Management

**P1** Guest profile management

| Requirement | Details |
|---|---|
| Profile fields | Name, phone, email, ID reference, nationality, preferences, stay history |
| Offline creation | New profiles can be created offline with local temporary IDs |
| Duplicate detection | Server checks duplicates by phone, email, name similarity, and document reference after sync |
| Preferences | Extra pillows, high floor, allergies, accessibility notes |
| Privacy | Sensitive notes require permission and audit visibility |

*User story: As a front desk agent, I want to create a guest profile offline so that walk-in registration does not wait for internet.*

Acceptance criteria:

- Offline guest profile receives `localTempId` and maps to server ID after sync.
- Potential duplicates are not automatically merged without review unless exact deterministic match exists.
- Stay history requires online server data unless already cached.

### 4.7 Billing, Folios, and Invoicing

**P0** Folio and transaction management

| Requirement | Details |
|---|---|
| Folio | Maintain room charges, restaurant charges, taxes, discounts, adjustments, payments, refunds |
| Charge posting | Room, restaurant, manual, minibar, damage, and other configured charges |
| Offline payments | Cash and room charge can be recorded offline; card payment requires online tokenization |
| Card handling | No raw card data stored offline |
| Invoice | Final invoice PDF generated after server-side sync and validation |
| Adjustments | Supervisor permission required for discount, void, or write-off |
| Audit | All financial changes are immutable ledger events with correction entries |

*User story: As a front desk agent, I want restaurant charges to appear on the guest folio so that the guest can pay once at checkout.*

Acceptance criteria:

- Offline folio transactions are append-only and idempotent.
- Voids and discounts are separate events, not destructive edits.
- Final invoice number is assigned by server only.
- Provisional invoices cannot be mistaken for tax-final invoices.
- Offline cash payments sync with cashier session and device ID.

### 4.8 Reporting and Analytics

**P1** Operational dashboards

| Report | Priority | Offline Behavior |
|---|---|---|
| Occupancy | P1 | Online only; may show last synced snapshot offline |
| ADR | P1 | Online only |
| RevPAR | P1 | Online only |
| Restaurant sales | P1 | Online only; local device can show unsynced shift summary |
| Housekeeping productivity | P2 | Online only |
| Conflict and sync health | P0 | Requires online for full dashboard; local device shows own queue |

*User story: As a manager, I want to see occupancy, revenue, and sync health so that I can operate the hotel confidently.*

Acceptance criteria:

- Dashboards never include unsynced data unless explicitly labeled.
- Managers can export reports when online.
- Sync health dashboard shows pending action count, failed action count, device status, and conflict count.

## 5. Functional Requirements: Restaurant Modules

### 5.1 Table Management

**P0** Visual floor plan and table state management

| Requirement | Details |
|---|---|
| Floor plan | Cached visual layout of restaurant sections and tables |
| Table statuses | Free, occupied, reserved, ordered, served, bill requested, cleaning |
| Offline updates | Hosts and waitstaff can update table state offline |
| Waitlist | Staff can create and manage digital waitlist offline |
| Conflict behavior | Table state conflicts use timestamp ordering for low-risk states and conflict review for bill-related states |

*User story: As a host, I want to seat walk-in guests without internet and mark tables occupied so that the floor plan stays useful.*

Acceptance criteria:

- Floor plan loads from cache offline.
- Table state update appears locally within 1 second.
- Sync conflict is logged if table state changed from different base versions.
- Bill-related status cannot be overwritten silently.

### 5.2 QR Code Ordering

**P0** Guest self-ordering by table QR code

| Requirement | Details |
|---|---|
| QR identity | QR code maps to property, restaurant, section, and table |
| Menu cache | Menu, item availability snapshot, modifiers, images, and prices cached by service worker |
| Guest order | Guest can build order from cached menu and submit when network to backend is available |
| Limited offline guest mode | If guest device is offline after menu cache, order is saved locally and sent when connection returns |
| Order confirmation | Guest receives confirmation only after order reaches backend or local restaurant network endpoint if supported |
| Security | Guest QR session cannot access guest folio or room details without authentication |

*User story: As a guest, I want to scan a table QR code and order food from my phone so that I do not need to wait for a waiter.*

Important clarification:

QR ordering from a guest's personal phone cannot guarantee immediate kitchen delivery during full internet outage unless the phone can reach a local hotel network endpoint. For MVP, guest orders created offline on the guest phone are queued on that phone and submitted when connectivity returns. Staff tablet POS remains the reliable offline order-taking path.

Acceptance criteria:

- Cached menu loads under 2 seconds after first successful load.
- Guest cannot place an order for unavailable item if current availability is known online.
- Offline guest order shows clear `waiting to send` state.
- Payment for QR order requires online provider connection unless charged to room through authenticated staff flow.

### 5.3 Kitchen Display System

**P0** Offline-capable kitchen order display

| Requirement | Details |
|---|---|
| KDS view | Shows orders by station, time, priority, table, waiter, and status |
| Status flow | New, accepted, preparing, ready, served, canceled |
| Offline cache | KDS caches received orders and can update status offline |
| Local delivery | Staff POS can send orders to local KDS endpoint when supported by same local network |
| Print fallback | Thermal ticket printing via USB, Bluetooth, or local network printer |
| Idempotency | Duplicate order submissions do not create duplicate kitchen tickets |

*User story: As kitchen staff, I want to see and update orders during an outage so that food preparation continues.*

Acceptance criteria:

- KDS remains usable with cached orders if internet is lost.
- Staff POS can print kitchen tickets offline.
- KDS status updates sync later with original order ID and action ID.
- Duplicate sync retries do not create duplicate tickets.

### 5.4 Restaurant POS and Order Management

**P0** Staff order capture and payment workflow

| Requirement | Details |
|---|---|
| Order entry | Add items, modifiers, notes, courses, covers, table, waiter |
| Offline ordering | Staff tablet can create orders offline |
| Bill actions | Split by item, split by seat, merge tables, transfer table, apply predefined discounts |
| Payments | Cash and room charge offline; card online only |
| Receipt printing | Local print queue for guest receipts and kitchen tickets |
| Voids | Supervisor permission required for voids after kitchen acceptance |

*User story: As a waiter, I want to take an order on a tablet with no internet and print the ticket immediately so that service is not delayed.*

Acceptance criteria:

- Order creation works offline using cached menu and price list.
- Price is captured on the order line at time of sale.
- Discounts available offline must be preconfigured and cached.
- Order totals are recalculated locally and verified by server on sync.
- Server flags discrepancies between local and server calculation.

### 5.5 Charge to Room

**P0** Restaurant bill posting to hotel folio

| Requirement | Details |
|---|---|
| Room lookup | Search by room number and guest name from cached in-house guest map |
| Validation | Online mode validates against live PMS state; offline mode validates against cache |
| Signature | Optional guest signature captured for room charge |
| Posting | Restaurant charge creates folio transaction with source order reference |
| Pending visibility | Pending restaurant charges are visible on originating POS and local front desk cache where available |
| Sync merge | Multiple offline charges for same room are appended by timestamp and action ID |

*User story: As a waiter, I want to charge a restaurant bill to a guest room offline so that the guest can settle everything at checkout.*

Acceptance criteria:

- Offline room charge requires room number and selected in-house guest from cached map.
- If cached room occupancy is stale, charge is marked `requires_review`.
- Same order cannot be charged twice due to retry.
- Front desk can see pending charges on the same device cache and synced charges after reconnection.

### 5.6 Inventory and Recipe Management

**P1** Restaurant inventory usage logging

| Requirement | Details |
|---|---|
| Recipe mapping | Items can map to ingredients and quantities |
| Stock tracking | Online stock-on-hand calculation |
| Offline usage | Staff can log manual usage or wastage offline |
| Sync behavior | Usage and wastage are append-only inventory events |

*User story: As a kitchen manager, I want to log ingredient usage during service so that inventory remains accurate after sync.*

Acceptance criteria:

- Offline stock deductions sync as events.
- Server recalculates inventory after all events are applied.
- Conflicting stock counts create adjustment review task.

## 6. Offline Synchronization Architecture

### 6.1 Architecture Overview

The system uses a cloud-authoritative backend with offline-capable clients. Staff web/PWA clients store operational data in encrypted IndexedDB and queue mutations locally. A service worker handles asset caching, background sync triggers, and retry behavior where supported. The application also includes an explicit in-app sync worker because browser background sync is not guaranteed on all devices.

Recommended sync technologies:

| Layer | Recommendation |
|---|---|
| Client storage | IndexedDB with encryption wrapper |
| Asset caching | Service Worker with Workbox or equivalent |
| Queue processing | Custom durable mutation queue with idempotency keys |
| API | REST or GraphQL mutations with server-side idempotency |
| Realtime online updates | WebSocket/SSE for active screens |
| Conflict tracking | Server-generated conflict records with admin resolution workflow |

### 6.2 Sync Strategy

| Topic | Requirement |
|---|---|
| Sync trigger | On login, app start, reconnect event, manual Sync Now, and periodic online check every 5 minutes |
| Ordering | Preserve order per entity and per device queue where business rules require sequencing |
| Idempotency | Every mutation includes `actionId`, `deviceId`, `actorId`, `entityId`, `baseVersion`, and `idempotencyKey` |
| Retries | Exponential backoff with max retry policy and visible failed state |
| Partial sync | Successful actions are marked synced; failed actions remain queued |
| Freshness | Show last successful sync time and stale-data warning |
| Queue durability | Action is persisted locally before UI confirms success |
| Server authority | Server assigns final IDs, invoice numbers, canonical timestamps, and conflict outcomes |

### 6.3 Conflict Resolution Rules

| Entity | Conflict Risk | Rule |
|---|---|---|
| Room status | Medium/high | Detect base version mismatch. Show conflict if state changed by another actor. Admin or supervisor resolves. Last-write-wins may be used only for low-risk transitions configured by policy. |
| Reservation room assignment | High | Never silently overwrite. Conflict review required for double assignment or overbooking. |
| Folio transaction | High | Append-only ledger. No destructive overwrite. Corrections use reversal/adjustment events. |
| Restaurant order item | Medium | Append-only for new items. Cancellations/voids are separate events. |
| Table status | Low/medium | Last-write-wins for non-billing states; conflict review for bill requested, paid, merged, transferred. |
| Guest profile | Medium | Merge most recent non-null low-risk fields; flag identity conflicts for review. |
| Inventory usage | Medium | Append-only usage events; stock count conflicts become adjustment tasks. |
| ID document upload | High | Upload encrypted file; never overwrite without explicit replacement event. |

### 6.4 Offline Data Model

Local IndexedDB stores the minimum data needed for operations.

| Store | Purpose |
|---|---|
| `offlineQueue` | Durable list of local mutations waiting to sync |
| `syncState` | Last sync time, checkpoint tokens, queue metrics |
| `cachedRooms` | Room inventory, statuses, assignment eligibility |
| `cachedRates` | Room rates, taxes, service charges, packages |
| `cachedReservations` | Arrivals, in-house reservations, walk-ins, local reservations |
| `cachedGuests` | Guest profiles and local temporary guest records |
| `cachedGuestRoomMap` | In-house guest to room mapping for room-charge validation |
| `cachedFolios` | Active folio summaries and local pending transactions |
| `cachedRestaurantTables` | Floor plan and table statuses |
| `cachedMenu` | Menu items, categories, modifiers, prices, availability snapshot |
| `cachedOrders` | Local restaurant orders and KDS state |
| `printQueue` | Registration cards, receipts, kitchen tickets |
| `fileUploadQueue` | ID scans, signatures, issue photos |
| `conflictCache` | Conflicts relevant to current device/user |

Each offline action must include:

| Field | Description |
|---|---|
| `actionId` | UUID generated client-side |
| `idempotencyKey` | Stable key used by server to prevent duplicates |
| `deviceId` | Registered device identifier |
| `actorId` | Authenticated user performing action |
| `entityType` | Target entity type |
| `entityId` | Server ID or local temporary ID |
| `baseVersion` | Entity version known when action was created |
| `operation` | Business operation name |
| `payload` | Encrypted or plain payload depending on sensitivity |
| `clientTimestamp` | Device timestamp |
| `createdAtLocal` | Local persistence timestamp |
| `retryCount` | Number of sync attempts |
| `status` | pending, syncing, synced, failed, conflict |

### 6.5 Data Freshness and Cache Retention

| Data Type | Offline Retention |
|---|---|
| Arrivals and departures | Last 3 days, current day, next 7 days |
| In-house guests | Current in-house stays |
| Room inventory | Full property room list |
| Rates and taxes | Current day plus next 30 days |
| Restaurant menu | Latest published menu and modifier set |
| Orders and folios | Active day and open checks/folios |
| Historical transactions | Last 7 days summary only, unless online |
| ID scans and photos | Until successful upload, then local deletion according to policy |

### 6.6 Sync Failure Handling

| Failure | Required Behavior |
|---|---|
| Network unavailable | Keep queue pending and show offline state |
| Server validation error | Mark action failed with human-readable reason and remediation path |
| Duplicate action | Server returns original result using idempotency key |
| Conflict | Mark action conflict and create conflict record |
| Auth expired | Pause sync and require re-authentication |
| Storage full | Warn user, block non-critical file capture, keep critical action queue safe |

## 7. Roles and Permissions

### 7.1 Role Matrix

| Role | Offline Allowed | Permissions |
|---|---:|---|
| Admin | Limited | User management, configuration, conflict resolution, audit logs, system settings |
| General manager | Limited | Reports, overrides, conflict review, financial summaries |
| Front desk agent | Yes | Reservations, check-in/out, room assignment, folios, cash payments |
| Front office supervisor | Yes | Front desk permissions plus discounts, voids, room assignment override |
| Housekeeping | Yes | Room status updates, task notes, supply logging |
| Maintenance | Yes | Maintenance issues, out-of-service status, resolution notes |
| Restaurant host | Yes | Table status, waitlist, seating |
| Restaurant waiter | Yes | Orders, split bills, receipt printing, charge to room, cash payments |
| Restaurant manager | Yes | Waiter permissions plus voids, discounts, shift close |
| Kitchen staff | Yes | KDS view, order status updates, ticket printing |
| Guest | Limited | Booking, QR ordering, authenticated portal |

### 7.2 Permission Requirements

**P0** Role-based access control must be enforced online and offline.

Acceptance criteria:

- Offline permissions are derived from last successful authenticated session and cached securely.
- Expired sessions block sensitive offline actions after configured grace period.
- Supervisor overrides require cached supervisor credentials or online approval.
- All privileged actions are audited with actor and device ID.

## 8. Non-Functional Requirements

### 8.1 Availability and Offline Resilience

| Requirement | Target |
|---|---|
| Offline operating window | Minimum 8 continuous hours for core workflows |
| Local action durability | Persist before UI success confirmation |
| Reconnect sync | 95% of typical queued actions within 30 seconds |
| Queue recovery | App restart must not lose unsynced actions |
| Device failure | Unsynced actions on destroyed device may be unrecoverable unless backed up locally; product must disclose device-level risk |

### 8.2 Performance

| Area | Target |
|---|---|
| Room list load from cache | Under 1 second for 500 rooms |
| Table map load from cache | Under 1 second for 150 tables |
| POS item search | Under 300 ms for cached menu |
| QR cached menu load | Under 2 seconds on poor 2G after first cache |
| KDS order update | Under 1 second local UI update |
| Sync throughput | At least 1,000 queued lightweight actions per minute per property under normal network |

### 8.3 Security and Privacy

| Requirement | Details |
|---|---|
| Encryption in transit | TLS for all network communication |
| Encryption at rest | Encrypt sensitive IndexedDB payloads using device-bound/session-derived keys where practical |
| Payment security | No raw card data stored; Stripe tokenization online only |
| PII minimization | Cache only operationally necessary guest data |
| Local session controls | Auto-lock after inactivity; require PIN/password/biometric where available |
| Audit logs | Immutable audit log for financial, room assignment, identity, permission, and configuration events |
| Device management | Register, name, and revoke staff devices |
| Data deletion | Uploaded ID scans/photos removed from local storage according to retention policy |

### 8.4 Compliance Considerations

| Area | Requirement |
|---|---|
| PCI | Use hosted/tokenized payment flows; avoid storing cardholder data |
| Privacy | Support guest data access/deletion workflows where legally required |
| Tax invoices | Server-generated invoice numbering and tax calculation |
| Auditability | Preserve immutable financial event history |

### 8.5 Accessibility and Usability

| Requirement | Details |
|---|---|
| Accessibility | WCAG 2.1 AA target for staff and guest-facing web |
| Device support | Desktop front desk, tablet POS, kitchen display screens, mobile housekeeping |
| Offline indicators | Clear online/offline/syncing/failed/conflict states |
| Error messages | Human-readable and actionable |
| Localization-ready | Currency, tax labels, date/time, language strings externalized |

## 9. Simplified Domain Data Model

### 9.1 Core Entities

| Entity | Key Fields |
|---|---|
| Hotel | id, name, timezone, currency, taxConfig, settings |
| User | id, name, roleIds, status, lastLoginAt |
| Device | id, name, type, registeredTo, revokedAt, lastSeenAt |
| Room | id, number, typeId, floor, status, version, lastStatusChangedAt |
| RoomType | id, name, capacity, baseRate, amenities |
| Guest | id, localTempId, name, email, phone, documentRef, preferences, version |
| Reservation | id, localTempId, guestId, roomId, roomTypeId, checkIn, checkOut, status, paymentStatus, version |
| Stay | id, reservationId, guestId, roomId, status, checkedInAt, checkedOutAt |
| Folio | id, stayId, status, balance, version |
| FolioTransaction | id, folioId, sourceType, sourceId, amount, taxAmount, type, status, actionId |
| Payment | id, folioId, method, amount, providerRef, status |
| RestaurantTable | id, sectionId, name, qrCodeToken, status, version |
| MenuItem | id, categoryId, name, price, taxClass, availabilityStatus |
| Order | id, localTempId, tableId, guestId, roomId, status, total, version |
| OrderItem | id, orderId, menuItemId, nameSnapshot, priceSnapshot, modifiers, status |
| InventoryEvent | id, ingredientId, quantity, eventType, sourceRef |
| OfflineAction | actionId, deviceId, actorId, entityType, entityId, operation, payload, status |
| Conflict | id, entityType, entityId, localActionId, serverVersion, status, resolution |
| AuditEvent | id, actorId, deviceId, eventType, entityRef, timestamp, metadata |

### 9.2 Status Examples

Reservation status:

- draft
- pending_payment
- confirmed
- checked_in
- checked_out
- canceled
- no_show
- conflict_review

Order status:

- draft
- sent
- accepted
- preparing
- ready
- served
- closed
- canceled
- conflict_review

Folio transaction status:

- pending_sync
- posted
- voided
- reversed
- failed
- requires_review

## 10. Key Workflows

### 10.1 Offline Check-In Workflow

1. Front desk device detects offline state.
2. Agent opens cached arrivals or creates walk-in reservation.
3. Agent selects available room from cached room list.
4. System warns if cache is stale or room status changed locally.
5. Agent captures guest details, signature, and optional encrypted ID scan.
6. System writes check-in action, room assignment action, and room status action to local queue.
7. UI marks guest as locally checked in and room as occupied on that device.
8. On reconnection, actions sync in order.
9. Server validates room availability and versions.
10. If valid, stay becomes official. If not valid, conflict task is created.

### 10.2 Offline Restaurant Order Workflow

1. Waiter opens cached table map and menu.
2. Waiter selects table and adds items/modifiers.
3. POS calculates total using cached price and tax rules.
4. Waiter sends order.
5. POS persists order action locally.
6. POS prints kitchen ticket or sends to local KDS if available.
7. KDS updates order status locally.
8. On reconnection, order and KDS status events sync with idempotency keys.
9. Server verifies pricing and posts final order state.

### 10.3 Charge-to-Room Workflow

1. Waiter selects Charge to Room.
2. POS searches cached in-house guest-room map.
3. Waiter selects guest/room and captures signature if configured.
4. POS creates order close event and folio charge event.
5. Charge is marked pending sync.
6. On sync, server validates guest was in-house at charge time.
7. Valid charge posts to folio; invalid charge becomes `requires_review`.

### 10.4 Conflict Resolution Workflow

1. Server detects base version mismatch or business rule violation.
2. Server records conflict with local action, server state, actor, device, and timestamps.
3. Affected entity shows conflict badge.
4. Admin or authorized supervisor reviews conflict.
5. Resolver chooses server value, local value, merged value, or manual corrected value.
6. System writes resolution event to audit log.
7. Entity receives new canonical version and clients sync updated state.

## 11. Admin and Operations Requirements

### 11.1 Configuration

**P0** Admin configuration must include:

- Room types, rooms, floors, and room status rules.
- Tax, service charge, and invoice settings.
- Restaurant sections, tables, menu categories, menu items, modifiers, and prices.
- User roles and permissions.
- Device registration and revocation.
- Offline cache policy and session timeout policy.
- Discount, void, and supervisor override rules.

### 11.2 Monitoring

**P0** Sync and device monitoring must include:

- Online/offline device status.
- Last sync timestamp per device.
- Pending queue count per device.
- Failed sync actions.
- Conflict count and severity.
- Storage usage warning per device where browser APIs allow.

### 11.3 Audit and Logs

**P0** Audit logs must capture:

- Login/logout and failed login attempts.
- Permission and role changes.
- Room assignment and status changes.
- Reservation creation, modification, cancellation, and no-show.
- Folio charges, payments, discounts, voids, refunds, and reversals.
- Order creation, voids, discounts, and charge-to-room.
- Conflict creation and resolution.
- Device registration, revocation, and sync failures.

## 12. API and Backend Requirements

### 12.1 API Design

| Requirement | Details |
|---|---|
| Idempotent mutations | All client mutations accept idempotency key |
| Batch sync endpoint | Client can push queued actions in batches |
| Pull checkpoint | Client can pull changes since last checkpoint |
| Entity versioning | Version or revision field required for conflict detection |
| Server validation | Server validates permissions, business rules, prices, taxes, and entity state |
| File uploads | Resumable upload support for ID scans, signatures, and photos |

### 12.2 Suggested Sync Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /sync/push` | Submit queued offline actions |
| `GET /sync/pull?checkpoint=...` | Retrieve server changes since checkpoint |
| `POST /sync/ack` | Confirm client applied pulled changes |
| `GET /sync/status` | Get queue/conflict/device health |
| `POST /conflicts/{id}/resolve` | Resolve sync conflict |
| `POST /devices/register` | Register trusted staff device |
| `POST /devices/{id}/revoke` | Revoke compromised or retired device |

## 13. Release Plan

### 13.1 Phase 1: Foundation and Core PMS

| Priority | Deliverable |
|---|---|
| P0 | Authentication, roles, device registration |
| P0 | Room inventory and status management |
| P0 | Reservation creation and arrival list |
| P0 | Offline queue foundation and IndexedDB storage |
| P0 | Front desk check-in/check-out |
| P0 | Folio ledger basics |

### 13.2 Phase 2: Restaurant Operations

| Priority | Deliverable |
|---|---|
| P0 | Restaurant table map |
| P0 | Menu management |
| P0 | POS order capture |
| P0 | KDS |
| P0 | Receipt and kitchen ticket print queue |
| P0 | Charge-to-room integration |

### 13.3 Phase 3: Guest and Booking Experience

| Priority | Deliverable |
|---|---|
| P0 | Native booking engine |
| P0 | Stripe payment integration |
| P0 | QR ordering |
| P1 | Guest portal |
| P1 | Guest preferences and duplicate detection |

### 13.4 Phase 4: Hardening and Management

| Priority | Deliverable |
|---|---|
| P0 | Conflict dashboard |
| P0 | Sync monitoring |
| P0 | Audit logs |
| P1 | Reporting dashboards |
| P1 | Inventory usage logging |
| P2 | Advanced analytics |

## 14. Testing and Acceptance Strategy

### 14.1 Offline Test Scenarios

| Scenario | Expected Result |
|---|---|
| Internet lost during check-in | Check-in completes locally and syncs after reconnect |
| Browser closed after offline actions | Queue survives restart |
| Same room assigned on two devices offline | Sync creates conflict; no silent overwrite |
| Restaurant order submitted offline | Ticket prints locally; order syncs once online |
| Charge-to-room offline after guest checked out online | Charge marked requires review |
| KDS offline status updates | Status updates persist locally and sync later |
| Storage nearly full | User receives warning and non-critical uploads are blocked first |
| Duplicate sync retry | Server returns original result and does not duplicate charge/order |

### 14.2 Load and Scale Tests

| Test | Target |
|---|---|
| 500 rooms cached | Room list remains responsive under 1 second |
| 100 active staff devices | Sync health remains observable and stable |
| 1,000 queued actions after outage | 95% sync within 30 seconds under normal connection |
| 150 restaurant tables | Table map remains responsive |
| 500 daily restaurant orders | KDS and POS remain responsive |

### 14.3 Security Tests

| Test | Target |
|---|---|
| Revoked device attempts sync | Sync blocked |
| Expired session attempts folio adjustment | Action blocked or requires re-auth |
| Local storage inspection | Sensitive payloads are encrypted |
| Duplicate idempotency key replay | No duplicate transaction |
| Unauthorized role action offline | Action blocked by cached permissions |

## 15. Assumptions and Open Questions

### 15.1 Assumptions

| Assumption | Impact |
|---|---|
| Property has local WiFi or device connectivity during many internet outages | Enables local printers and possible local KDS communication |
| Stripe or equivalent is used only online | Offline payments limited to cash, room charge, and pending payment states |
| Single-property only | Avoids cross-property inventory and user complexity |
| Staff devices are managed or trusted | Enables device registration, cache policy, and revocation |
| Browser/PWA is acceptable for staff workflows | Native apps are not required for MVP |

### 15.2 Open Questions

| Question | Recommended Product Decision |
|---|---|
| How should offline card authorizations at check-in be handled? | Do not authorize offline. Mark as pending preauth, collect cash deposit, or require online payment terminal when available. |
| Should room status use last-write-wins? | Use conflict detection for room assignment and high-risk status transitions. Last-write-wins only for low-risk housekeeping notes. |
| Can guest QR orders reach kitchen during full internet outage? | Only if the guest device can reach a local network endpoint. Otherwise, guest order queues on device until online. |
| How long can staff remain logged in offline? | Configure property policy, for example 8 to 12 hours with local PIN unlock. |
| Should front desk finalize checkout offline? | Allow provisional checkout only. Final invoice and payment settlement require sync validation. |
| How should overbooking caused by offline reservations be resolved? | Conflict dashboard with manager review; affected reservation marked conflict_review. |

## 16. Glossary

| Term | Definition |
|---|---|
| Offline-first | Application design where core workflows work without internet and sync later |
| Sync conflict | A mismatch caused when multiple clients change the same entity from different known versions |
| Charge to room | Posting restaurant or other charges to a hotel guest folio |
| PMS | Property Management System |
| POS | Point of Sale |
| KDS | Kitchen Display System |
| Folio | Guest bill containing charges, taxes, payments, and adjustments |
| Idempotency key | Unique key used to ensure retrying an action does not duplicate the result |
| Base version | Entity version known by the client when an offline action was created |
| Provisional invoice | Temporary offline folio document pending server validation |

## 17. Technical Summary: Offline Sync Flow

- Client authenticates online and receives role permissions, device registration, encryption/session material, and initial cache.
- Staff actions are written to IndexedDB first, including action ID, idempotency key, actor ID, device ID, base version, payload, and timestamp.
- UI updates immediately from local state and marks records as pending sync.
- Service worker caches assets and reference data; in-app sync worker manages mutation queue because browser background sync is not always reliable.
- On reconnect, client pushes queued actions in batches to `/sync/push`.
- Server validates permissions, idempotency, entity versions, business rules, pricing, taxes, and payment constraints.
- Server applies safe append-only events, rejects invalid actions, or creates conflict records for risky version mismatches.
- Client pulls canonical changes from `/sync/pull` using checkpoint tokens.
- Local temporary IDs are mapped to server IDs after successful sync.
- Failed and conflicting actions remain visible with remediation steps.
- Admin resolves conflicts through a dashboard; all resolutions create audit events.
- Sensitive local data is encrypted, retained only as long as necessary, and deleted after successful upload or configured retention expiry.
