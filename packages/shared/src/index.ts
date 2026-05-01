export const tenantRoles = [
  "owner",
  "admin",
  "front_desk",
  "housekeeping",
  "maintenance",
  "restaurant_manager",
  "waiter",
  "kitchen",
  "accountant",
  "guest",
] as const;

export type TenantRole = (typeof tenantRoles)[number];

export const tenantPermissions = [
  "tenant.read",
  "tenant.manage",
  "property.read",
  "property.manage",
  "restaurant.read",
  "restaurant.manage",
  "rooms.read",
  "rooms.manage",
  "reservations.read",
  "reservations.manage",
  "billing.read",
  "billing.manage",
  "staff.read",
  "staff.manage",
  "settings.read",
  "settings.manage",
] as const;

export type TenantPermission = (typeof tenantPermissions)[number];

export const rolePermissions: Record<TenantRole, TenantPermission[]> = {
  owner: [...tenantPermissions],
  admin: [...tenantPermissions],
  front_desk: [
    "tenant.read",
    "property.read",
    "rooms.read",
    "reservations.read",
    "reservations.manage",
    "billing.read",
    "billing.manage",
    "staff.read",
    "settings.read",
  ],
  housekeeping: ["tenant.read", "property.read", "rooms.read", "rooms.manage"],
  maintenance: ["tenant.read", "property.read", "rooms.read", "rooms.manage"],
  restaurant_manager: [
    "tenant.read",
    "property.read",
    "restaurant.read",
    "restaurant.manage",
    "billing.read",
    "staff.read",
  ],
  waiter: ["tenant.read", "restaurant.read", "billing.read"],
  kitchen: ["tenant.read", "restaurant.read"],
  accountant: ["tenant.read", "billing.read", "billing.manage"],
  guest: ["tenant.read"],
};

export function hasTenantPermission(
  role: TenantRole | null | undefined,
  permission: TenantPermission,
) {
  return role ? rolePermissions[role].includes(permission) : false;
}

export const paymentProviders = [
  "paystack",
  "stripe",
  "edahab",
  "evc_plus",
  "zaad",
  "sahal",
  "manual_mobile_money",
] as const;

export type PaymentProvider = (typeof paymentProviders)[number];

export type PaymentStatus =
  | "pending"
  | "requires_customer_action"
  | "paid"
  | "failed"
  | "cancelled"
  | "reversed";

export type OfflineActionStatus =
  | "queued"
  | "accepted"
  | "applied"
  | "conflicted"
  | "rejected";

export interface TenantScope {
  tenantId: string;
  propertyId: string;
  restaurantId?: string;
}
