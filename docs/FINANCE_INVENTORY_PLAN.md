# Finance, Invoices, Folios, and Inventory Build Plan

This plan is the working roadmap for adding finance and inventory management to Rayaan. The guiding rule is that operational actions should post into a traceable finance and stock record instead of relying on dashboard-only totals.

## Principles

- Finance is the source of truth for money movement.
- Inventory is movement-based, not just a current quantity field.
- A guest folio is the operational bill during a stay.
- An invoice is the official financial document generated from a folio, sale, or manual charge.
- Every amount stores a currency code from day one.
- Every sensitive action is tenant-scoped, permission-checked, and auditable.
- Reports should be built on posted records, not recalculated from unrelated modules.

## Core Flow

```text
Booking -> Guest folio -> Room charges + extras + payments -> Checkout -> Invoice -> Ledger

Restaurant order -> Payment or charge-to-room -> Folio/ledger -> Reports

Purchase order -> Stock receipt -> Supplier invoice/payable -> Ledger -> Inventory valuation
```

## Phase 1: Finance Foundation

Goal: create the ledger and accounting primitives that every module can post into.

- [ ] Add `Money` conventions: decimal amount plus `currencyCode`.
- [ ] Add tenant base currency setting.
- [ ] Add `TaxRate` model with effective dates and tenant scope.
- [ ] Add `FinanceTransaction` ledger model.
- [ ] Add `PaymentLedger` or payment posting model.
- [ ] Add `CashSession` for shift-level cash tracking.
- [ ] Add `CashMovement` for paid-in, paid-out, opening float, and closing variance.
- [ ] Add finance permissions for owner, admin, and accountant.
- [ ] Build finance API endpoints for listing transactions and summary totals.
- [ ] Build finance dashboard MVP.

Minimum models:

- `FinanceTransaction`
- `TaxRate`
- `CashSession`
- `CashMovement`
- `PaymentLedger`

Transaction types:

- `revenue`
- `payment`
- `refund`
- `expense`
- `payable`
- `receivable`
- `adjustment`
- `tax`
- `cash_movement`

## Phase 2: POS and Restaurant to Finance Bridge

Goal: restaurant revenue must reconcile with finance automatically.

- [ ] Link `OrderPayment` to `FinanceTransaction`.
- [ ] On restaurant order close, post payment records into finance.
- [ ] Separate revenue recognition from payment collection where needed.
- [ ] Support payment methods: cash, card, Paystack/mobile money, room charge, manual.
- [ ] Add idempotency key or unique source reference to avoid double posting.
- [ ] Add reconciliation view: restaurant sales total vs finance posted total.

Posting rule:

```text
OrderPayment.created/completed -> FinanceTransaction(sourceType = "restaurant_order_payment", sourceId = OrderPayment.id)
```

## Phase 3: Guest Folios and Room Charges

Goal: handle room charges, charge-to-room, deposits, checkout, and final billing.

- [ ] Add `GuestFolio` model linked to booking, guest/customer, tenant, and property.
- [ ] Add `FolioLineItem` model for room nights, restaurant charges, extras, tax, discounts, and adjustments.
- [ ] Add `FolioPayment` model for deposits and payments against a folio.
- [ ] Generate nightly room charges from booking dates and rate.
- [ ] Allow manual folio charges: minibar, laundry, damages, late checkout, extra bed.
- [ ] Allow restaurant orders to be charged to room.
- [ ] Allow partial payments before checkout.
- [ ] Lock folio after checkout.
- [ ] Generate customer invoice from closed folio.

Line item types:

- `room_night`
- `restaurant_charge`
- `tax`
- `service_charge`
- `discount`
- `deposit`
- `refund`
- `manual_charge`
- `adjustment`

Important rule:

```text
Folio = operational running bill
Invoice = official financial document
Ledger = accounting record
```

## Phase 4: Customer Invoices

Goal: create official invoices for guests, companies, restaurant orders, folios, and manual billing.

- [ ] Add `CustomerAccount` model.
- [ ] Add `Invoice` model.
- [ ] Add `InvoiceLineItem` model.
- [ ] Add `InvoicePayment` model.
- [ ] Support source references: booking, folio, restaurant order, manual charge.
- [ ] Support statuses: draft, issued, partially_paid, paid, overdue, void.
- [ ] Generate invoice from folio at checkout.
- [ ] Generate invoice from restaurant order when needed.
- [ ] Generate manual invoice for company/event/long-stay customer.
- [ ] Add printable invoice view.
- [ ] Add PDF export later.
- [ ] Post invoice receivable and payments to finance ledger.

Source strategy:

Use explicit optional foreign keys where the source is known and important:

- `bookingId`
- `folioId`
- `restaurantOrderId`
- `customerAccountId`

For future extension, add:

- `sourceType`
- `sourceId`

## Phase 5: Inventory Foundation

Goal: create tenant-scoped inventory records with stock movement history.

- [ ] Add `InventoryCategory`.
- [ ] Add `InventoryItem`.
- [ ] Add `InventoryLocation`.
- [ ] Add `InventoryMovement`.
- [ ] Add `Supplier`.
- [ ] Add preferred supplier on inventory item.
- [ ] Add `minimumStockLevel`.
- [ ] Add `reorderLevel`.
- [ ] Add low-stock query/report.
- [ ] Add inventory valuation query.
- [ ] Add inventory permissions by role.

Movement types:

- `purchase_receipt`
- `transfer`
- `adjustment`
- `usage`
- `waste`
- `return`
- `opening_balance`

Locations:

- Main store
- Kitchen
- Bar
- Housekeeping
- Maintenance
- Front desk

## Phase 6: Recipe/BOM Model

Goal: define how restaurant menu items consume inventory.

- [ ] Add `MenuItemIngredient` or `RecipeComponent`.
- [ ] Link recipe components to existing restaurant menu items.
- [ ] Store quantity, unit, and yield factor.
- [ ] Support multiple inventory items per menu item.
- [ ] Support basic unit conversion.
- [ ] Build admin UI for assigning ingredients to menu items.

Example:

```text
Menu item: Chicken burger
Components:
- Bun: 1 piece
- Chicken breast: 0.18 kg
- Lettuce: 0.03 kg
- Sauce: 0.02 liter
```

## Phase 7: Supplier Invoices and Purchase Orders

Goal: handle procurement, receiving, supplier bills, and payables.

- [ ] Add `PurchaseOrder`.
- [ ] Add `PurchaseOrderItem`.
- [ ] Add `SupplierInvoice`.
- [ ] Add `SupplierInvoiceLineItem`.
- [ ] Add `SupplierInvoicePayment`.
- [ ] Create draft purchase order manually.
- [ ] Create draft purchase order from low-stock items.
- [ ] Support purchase order statuses: draft, ordered, partially_received, received, cancelled.
- [ ] Receive partial stock.
- [ ] On stock receipt, create inventory movement.
- [ ] On supplier invoice approval, create finance payable.
- [ ] On supplier payment, post payment to ledger.

Purchase order statuses:

- `draft`
- `ordered`
- `partially_received`
- `received`
- `cancelled`

Supplier invoice statuses:

- `draft`
- `received`
- `approved`
- `partially_paid`
- `paid`
- `overdue`
- `disputed`
- `void`

## Phase 8: POS to Inventory Deduction

Goal: completed restaurant orders should consume inventory through recipes.

- [ ] On order completion, read recipe components for each sold item.
- [ ] Create `InventoryMovement` records of type `usage`.
- [ ] Link usage records to restaurant order and order items.
- [ ] Handle missing recipe components safely.
- [ ] Add stock warning before sale when ingredients are below threshold.
- [ ] Add waste/loss recording from kitchen.
- [ ] Add reversal handling for cancelled/refunded orders.

Posting rule:

```text
RestaurantOrder.completed -> InventoryMovement(type = "usage", sourceType = "restaurant_order")
```

## Phase 9: Accounting Periods and Reports

Goal: make reports accountant-friendly and lock historical periods.

- [ ] Add `AccountingPeriod`.
- [ ] Support daily, monthly, and financial-year ranges.
- [ ] Add period closing/locking.
- [ ] Block edits to posted transactions in closed periods.
- [ ] Add revenue report.
- [ ] Add expense report.
- [ ] Add cash report.
- [ ] Add AR ageing report.
- [ ] Add AP ageing report.
- [ ] Add inventory valuation report.
- [ ] Add stock movement report.
- [ ] Add low-stock report.
- [ ] Add waste/loss report.

Ageing buckets:

- 0-30 days
- 31-60 days
- 61-90 days
- 90+ days

## Phase 10: Bank Reconciliation and Export

Goal: prepare for accountant workflows and external systems.

- [ ] Add `BankAccount`.
- [ ] Add `BankTransaction`.
- [ ] Add reconciliation status to finance transactions.
- [ ] Add manual bank statement import by CSV.
- [ ] Add matching workflow for bank transactions to ledger entries.
- [ ] Add CSV export for finance transactions.
- [ ] Add CSV export for invoices.
- [ ] Add CSV export for inventory movement.
- [ ] Define chart-of-accounts mapping.
- [ ] Defer Xero/QuickBooks/Sage native integration until the finance model stabilizes.

## Phase 11: Permissions, Approvals, and Audit

Goal: protect sensitive finance and inventory actions.

- [ ] Extend role permissions for finance and inventory.
- [ ] Add approval thresholds for inventory adjustments.
- [ ] Add approval thresholds for voids, discounts, and refunds.
- [ ] Add approval workflow for supplier invoices.
- [ ] Add audit log entries for every money and stock mutation.
- [ ] Show audit history on transaction, invoice, folio, and inventory movement detail screens.

Sensitive audit actions:

- Expense created, edited, deleted
- Invoice issued, voided, paid
- Folio adjusted, closed, reopened
- Stock adjusted
- Stock wasted
- Purchase received
- Supplier invoice approved
- Cash session opened/closed
- Payment manually marked
- Refund issued

## Initial MVP Scope

Build this first:

- Finance ledger model
- Currency and tax model
- POS payment to finance bridge
- Guest folio and room charge model
- Customer invoice from folio
- Inventory items, locations, movements, suppliers
- Purchase orders with stock receiving
- Basic finance and inventory dashboards

Defer this until after MVP:

- Bank reconciliation
- External accounting integrations
- PDF invoice polish
- Advanced unit conversion
- Consolidated multi-property reporting
- Automated purchase order generation

## Implementation Notes

- Use Prisma migrations for all schema changes.
- Keep all models tenant-scoped.
- Prefer source references for reconciliation: `sourceType`, `sourceId`, and direct foreign keys where possible.
- Use idempotency keys for automatic postings.
- Store amounts as decimals, not floating point.
- Store `currencyCode` on every financial record.
- Never hardcode tax rates in application code.
- Do not allow destructive edits to closed accounting periods.
- Use audit logs before adding broad finance admin features.

