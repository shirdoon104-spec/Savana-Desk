ALTER TYPE "HotelAuditEvent" ADD VALUE IF NOT EXISTS 'folio_charge_to_room_posted';
ALTER TYPE "HotelAuditEvent" ADD VALUE IF NOT EXISTS 'folio_line_item_reversed';
ALTER TYPE "HotelAuditEvent" ADD VALUE IF NOT EXISTS 'folio_charge_to_room_reversed';
