"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { Building2, ChefHat, LayoutDashboard, Settings, Utensils } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TenantRole =
  | "owner"
  | "admin"
  | "front_desk"
  | "housekeeping"
  | "maintenance"
  | "restaurant_manager"
  | "waiter"
  | "kitchen"
  | "accountant"
  | "guest";

type NavPermission = "property.read" | "restaurant.read" | "staff.read";

const navPermissions: Record<TenantRole, NavPermission[]> = {
  owner: ["property.read", "restaurant.read", "staff.read"],
  admin: ["property.read", "restaurant.read", "staff.read"],
  front_desk: ["property.read", "staff.read"],
  housekeeping: ["property.read"],
  maintenance: ["property.read"],
  restaurant_manager: ["property.read", "restaurant.read", "staff.read"],
  waiter: ["restaurant.read"],
  kitchen: ["restaurant.read"],
  accountant: [],
  guest: [],
};

interface WorkspaceContextResponse {
  user: {
    role: TenantRole | null;
  };
}

function canNavigate(role: TenantRole | null, permission: NavPermission) {
  return role ? navPermissions[role].includes(permission) : false;
}

function canUseKitchen(role: TenantRole | null) {
  return role ? ["owner", "admin", "restaurant_manager", "kitchen"].includes(role) : false;
}

export function AppNav() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [role, setRole] = useState<TenantRole | null>(null);

  useEffect(() => {
    async function loadRole() {
      if (!isLoaded || !isSignedIn) {
        return;
      }

      const token = await getToken(
        organization ? { organizationId: organization.id } : undefined,
      );

      if (!token) {
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/tenancy/context`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const payload = (await response.json()) as WorkspaceContextResponse;
          setRole(payload.user.role);
        }
      } catch {
        setRole(null);
      }
    }

    void loadRole();
  }, [getToken, isLoaded, isSignedIn, organization]);

  return (
    <nav>
      <Link href="/app">
        <LayoutDashboard aria-hidden="true" />
        Dashboard
      </Link>
      {canNavigate(role, "property.read") ? (
        <Link href="/app/properties">
          <Building2 aria-hidden="true" />
          Properties
        </Link>
      ) : null}
      {canNavigate(role, "restaurant.read") ? (
        <Link href="/app/restaurants">
          <Utensils aria-hidden="true" />
          Restaurants
        </Link>
      ) : null}
      {canUseKitchen(role) ? (
        <Link href="/app/kitchen">
          <ChefHat aria-hidden="true" />
          Kitchen
        </Link>
      ) : null}
      {canNavigate(role, "staff.read") ? (
        <Link href="/app/settings">
          <Settings aria-hidden="true" />
          Settings
        </Link>
      ) : null}
    </nav>
  );
}
