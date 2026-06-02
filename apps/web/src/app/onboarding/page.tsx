"use client";

import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useClerk,
  useOrganization,
} from "@clerk/nextjs";
import { Building2, Check, Hotel, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  SafeSignOutButton,
  userButtonWithoutSignOutAppearance,
} from "../components/safe-sign-out-button";

type OperatingModel = "hotel_only" | "hotel_restaurant";

const operatingModels = [
  {
    id: "hotel_only" as const,
    title: "Hotel only",
    description:
      "Front desk, room management, housekeeping, billing, and guest operations.",
    icon: Hotel,
  },
  {
    id: "hotel_restaurant" as const,
    title: "Hotel + restaurant",
    description:
      "Everything in hotel operations, plus table management, POS, KDS, and room charges.",
    icon: Utensils,
  },
];

export default function OnboardingPage() {
  const clerk = useClerk();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [operatingModel, setOperatingModel] =
    useState<OperatingModel>("hotel_restaurant");
  const [tenantName, setTenantName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [city, setCity] = useState("Mogadishu");
  const [currency, setCurrency] = useState<"USD" | "SOS">("USD");
  const [roomCount, setRoomCount] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("evc_plus");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantServiceStyle, setRestaurantServiceStyle] =
    useState("full_service");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setupSummary = useMemo(() => {
    if (operatingModel === "hotel_only") {
      return ["Hotel workspace", "First property", "Room operations"];
    }

    return [
      "Hotel workspace",
      "First property",
      "Restaurant POS",
      "Charge to room",
    ];
  }, [operatingModel]);

  async function completeOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isLoaded || !isSignedIn) {
      setError("Sign in and create an organization before continuing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const activeOrganizationId = await ensureWorkspaceOrganization();
      const token = await getToken({ organizationId: activeOrganizationId });

      if (!token) {
        throw new Error("Clerk session token is missing.");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/onboarding/complete`,
        {
          body: JSON.stringify({
            city,
            currency,
            mobileMoneyProvider,
            operatingModel,
            propertyName,
            restaurantName:
              operatingModel === "hotel_restaurant" ? restaurantName : undefined,
            restaurantServiceStyle:
              operatingModel === "hotel_restaurant"
                ? restaurantServiceStyle
                : undefined,
            roomCount: roomCount ? Number(roomCount) : undefined,
            tenantName,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "Onboarding could not be completed.");
      }

      router.push("/app");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Onboarding could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="onboarding-workspace">
      <section className="onboarding-shell">
        <aside className="onboarding-aside">
          <div className="brand-mark">
            <Building2 aria-hidden="true" />
            <span>Rayaan Hotel SaaS</span>
          </div>
          <div className="onboarding-account-controls">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/onboarding"
              afterLeaveOrganizationUrl="/"
              afterSelectOrganizationUrl="/onboarding"
            />
            <UserButton
              appearance={userButtonWithoutSignOutAppearance}
              signInUrl="/sign-in"
            />
            <SafeSignOutButton />
          </div>
          <p className="eyebrow">Tenant onboarding</p>
          <h1>Set up your operating workspace</h1>
          <p>
            Choose the modules this hotel needs today. You can add restaurants,
            POS devices, and extra departments later from settings.
          </p>

          <div className="setup-progress" aria-label="Setup progress">
            <span data-active="true">Business model</span>
            <span>Property profile</span>
            <span>Launch checklist</span>
          </div>
        </aside>

        <section className="onboarding-card">
          <div className="section-heading">
            <p className="eyebrow">Step 1 of 3</p>
            <h2>What are you setting up?</h2>
            <p>
              This decides whether restaurant setup is included now or skipped
              for a cleaner hotel-only workspace.
            </p>
          </div>

          <div className="choice-grid" role="radiogroup" aria-label="Operating model">
            {operatingModels.map((model) => (
              <button
                className="choice-card"
                data-selected={operatingModel === model.id}
                key={model.id}
                onClick={() => setOperatingModel(model.id)}
                role="radio"
                aria-checked={operatingModel === model.id}
                type="button"
              >
                <model.icon aria-hidden="true" />
                <strong>{model.title}</strong>
                <span>{model.description}</span>
              </button>
            ))}
          </div>

          <form className="setup-form" onSubmit={completeOnboarding}>
            <div className="field-grid">
              <label>
                Hotel company name
                <input
                  onChange={(event) => setTenantName(event.target.value)}
                  placeholder="Rayaan Hotel Group"
                  required
                  value={tenantName}
                />
                <small>
                  This becomes the Clerk organization and tenant workspace name.
                </small>
              </label>
              <label>
                First property name
                <input
                  onChange={(event) => setPropertyName(event.target.value)}
                  placeholder="Rayaan Mogadishu"
                  required
                  value={propertyName}
                />
              </label>
            </div>

            <div className="field-grid">
              <label>
                City
                <input
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Mogadishu"
                  required
                  value={city}
                />
              </label>
              <label>
                Currency
                <select
                  onChange={(event) =>
                    setCurrency(event.target.value as "USD" | "SOS")
                  }
                  value={currency}
                >
                  <option value="USD">USD</option>
                  <option value="SOS">SOS</option>
                </select>
              </label>
            </div>

            <div className="field-grid">
              <label>
                Approximate room count
                <input
                  inputMode="numeric"
                  onChange={(event) => setRoomCount(event.target.value)}
                  placeholder="150"
                  value={roomCount}
                />
              </label>
              <label>
                Primary mobile money provider
                <select
                  onChange={(event) => setMobileMoneyProvider(event.target.value)}
                  value={mobileMoneyProvider}
                >
                  <option value="evc_plus">EVC Plus</option>
                  <option value="edahab">eDahab</option>
                  <option value="zaad">ZAAD</option>
                  <option value="sahal">Sahal</option>
                  <option value="manual">Decide later</option>
                </select>
              </label>
            </div>

            {operatingModel === "hotel_restaurant" ? (
              <div className="restaurant-fields">
                <div className="section-heading compact">
                  <p className="eyebrow">Restaurant module</p>
                  <h3>Add your first restaurant</h3>
                </div>
                <div className="field-grid">
                  <label>
                    Restaurant name
                    <input
                      onChange={(event) => setRestaurantName(event.target.value)}
                      placeholder="Rayaan Restaurant"
                      required={operatingModel === "hotel_restaurant"}
                      value={restaurantName}
                    />
                  </label>
                  <label>
                    Service style
                    <select
                      onChange={(event) =>
                        setRestaurantServiceStyle(event.target.value)
                      }
                      value={restaurantServiceStyle}
                    >
                      <option value="full_service">Full service</option>
                      <option value="quick_service">Quick service</option>
                      <option value="room_service">Room service only</option>
                      <option value="mixed">Mixed service</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <div className="module-note">
                Restaurant setup will be skipped. You can enable POS, table
                management, QR ordering, and KDS later from workspace settings.
              </div>
            )}

            <div className="summary-strip">
              {setupSummary.map((item) => (
                <span key={item}>
                  <Check aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating workspace..." : "Continue setup"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );

  async function ensureWorkspaceOrganization() {
    const trimmedTenantName = tenantName.trim();

    if (!trimmedTenantName) {
      throw new Error("Hotel company name is required.");
    }

    if (organization) {
      const shouldRename =
        organization.name.toLowerCase().includes("organization") &&
        organization.name !== trimmedTenantName;

      if (shouldRename) {
        try {
          await organization.update({ name: trimmedTenantName });
        } catch {
          // Clerk may reject rename for role/setting reasons; the internal tenant
          // name still remains correct, so onboarding can continue.
        }
      }

      await clerk.setActive({ organization: organization.id });
      return organization.id;
    }

    const createdOrganization = await clerk.createOrganization({
      name: trimmedTenantName,
    });

    await clerk.setActive({ organization: createdOrganization.id });
    return createdOrganization.id;
  }
}
