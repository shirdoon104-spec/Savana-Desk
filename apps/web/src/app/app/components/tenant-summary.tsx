"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";

interface TenantContext {
  tenantResolved: boolean;
  tenant: {
    name: string;
    operatingModel: string;
    mobileMoneyProvider: string | null;
    properties: Array<{
      name: string;
      city: string | null;
      currency: string;
      roomCount: number | null;
      restaurants: Array<{ name: string; serviceStyle: string | null }>;
    }>;
  } | null;
}

export function TenantSummary() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [context, setContext] = useState<TenantContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTenantContext() {
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
          setContext((await response.json()) as TenantContext);
          setError(null);
        } else {
          setError("Could not load workspace context.");
        }
      } catch {
        setError("Could not reach the Rayaan API. Check that the API is running.");
      }
    }

    void loadTenantContext();
  }, [getToken, isLoaded, isSignedIn, organization]);

  if (error) {
    return (
      <section className="notice-panel dashboard-empty">
        <p className="eyebrow">Workspace</p>
        <h2>API unavailable</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!context?.tenantResolved || !context.tenant) {
    return (
      <section className="notice-panel dashboard-empty">
        <p className="eyebrow">Workspace</p>
        <h2>Finish onboarding</h2>
        <p>
          Create your hotel workspace to unlock tenant-scoped properties,
          roles, restaurants, payments, and offline devices.
        </p>
      </section>
    );
  }

  const firstProperty = context.tenant.properties[0];
  const hasRestaurant = firstProperty?.restaurants.length > 0;
  const firstRestaurant = firstProperty?.restaurants[0];

  return (
    <>
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Workspace ready</p>
          <h2>{context.tenant.name}</h2>
          <p>
            Your tenant workspace is connected to Clerk Organizations and
            ready for property setup, roles, payments, and operations modules.
          </p>
        </div>
      </section>

      <section className="status-grid tenant-summary" aria-label="Tenant summary">
        <div>
          <span>Property</span>
          <strong>{firstProperty?.name ?? "Not created"}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{firstProperty?.city ?? "Not set"}</strong>
        </div>
        <div>
          <span>Rooms</span>
          <strong>{firstProperty?.roomCount ?? "Not set"}</strong>
        </div>
        <div>
          <span>Currency</span>
          <strong>{firstProperty?.currency ?? "USD"}</strong>
        </div>
      </section>

      <section className="module-grid dashboard-actions" aria-label="Next actions">
        <article className="module-card">
          <h2>Front desk</h2>
          <p>Next: create room types, rooms, and reservation basics.</p>
        </article>
        <article className="module-card">
          <h2>Restaurant</h2>
          <p>
            {hasRestaurant
              ? `${firstRestaurant?.name} is ready for POS and table setup.`
              : "Skipped for now. Enable POS and KDS later from settings."}
          </p>
        </article>
        <article className="module-card">
          <h2>Payments</h2>
          <p>
            Primary provider:{" "}
            {context.tenant.mobileMoneyProvider ?? "Decide later"}.
          </p>
        </article>
        <article className="module-card">
          <h2>Team access</h2>
          <p>Next: invite staff and assign roles for each department.</p>
        </article>
      </section>
    </>
  );
}
