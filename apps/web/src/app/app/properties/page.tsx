"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { Building2, DoorOpen, Plus, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

interface PropertyResponse {
  allowedRoomStatuses: string[];
  canManageProperties: boolean;
  canManageRooms: boolean;
  canManageStays: boolean;
  currentUser: {
    clerkUserId: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  properties: Array<{
    city: string | null;
    currency: string;
    id: string;
    name: string;
    restaurants: Array<{
      id: string;
      name: string;
      serviceStyle: string | null;
    }>;
    roomCount: number | null;
    rooms: Array<{
      activeStay: {
        checkInAt: string;
        expectedCheckOutAt: string | null;
        guest: {
          email: string | null;
          firstName: string;
          id: string;
          lastName: string;
          phone: string | null;
        };
        id: string;
        notes: string | null;
      } | null;
      id: string;
      number: string;
      status: string;
      type: string;
    }>;
    timezone: string;
  }>;
}

const roomStatuses = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
  "out_of_order",
] as const;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function statusOptionsForRoom(currentStatus: string, allowedStatuses: string[]) {
  return allowedStatuses.includes(currentStatus)
    ? allowedStatuses
    : [currentStatus, ...allowedStatuses];
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    return message ?? fallback;
  } catch {
    return fallback;
  }
}

export default function PropertiesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [data, setData] = useState<PropertyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [propertyName, setPropertyName] = useState("");
  const [city, setCity] = useState("Mogadishu");
  const [currency, setCurrency] = useState("USD");
  const [roomType, setRoomType] = useState("standard");
  const [roomPrefix, setRoomPrefix] = useState("");
  const [roomFrom, setRoomFrom] = useState("");
  const [roomTo, setRoomTo] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [checkInRoomId, setCheckInRoomId] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [expectedCheckOutAt, setExpectedCheckOutAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProperty = useMemo(
    () =>
      data?.properties.find((property) => property.id === selectedPropertyId) ??
      data?.properties[0],
    [data?.properties, selectedPropertyId],
  );

  const roomTypes = useMemo(() => {
    const types = new Set(selectedProperty?.rooms.map((room) => room.type) ?? []);
    return Array.from(types).sort((first, second) => first.localeCompare(second));
  }, [selectedProperty?.rooms]);

  const filteredRooms = useMemo(() => {
    return (
      selectedProperty?.rooms.filter((room) => {
        const matchesStatus =
          statusFilter === "all" || room.status === statusFilter;
        const matchesType = typeFilter === "all" || room.type === typeFilter;
        return matchesStatus && matchesType;
      }) ?? []
    );
  }, [selectedProperty?.rooms, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const status of roomStatuses) {
      counts.set(status, 0);
    }

    for (const room of selectedProperty?.rooms ?? []) {
      counts.set(room.status, (counts.get(room.status) ?? 0) + 1);
    }

    return counts;
  }, [selectedProperty?.rooms]);

  async function getOrganizationToken() {
    return getToken(organization ? { organizationId: organization.id } : undefined);
  }

  async function loadProperties() {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setLoadState("loading");
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setLoadState("error");
      setError("Select or create a workspace organization before managing properties.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setLoadState("error");
        setError(await readApiMessage(response, "Could not load properties."));
        return;
      }

      const payload = (await response.json()) as PropertyResponse;
      setData(payload);
      setSelectedPropertyId((current) => current || payload.properties[0]?.id || "");
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("Could not reach the Rayaan API. Check that the API and database are running.");
    }
  }

  useEffect(() => {
    void loadProperties();
  }, [getToken, isLoaded, isSignedIn, organization]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before creating a property.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties`, {
      body: JSON.stringify({
        city,
        currency,
        name: propertyName,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create property."));
      return;
    }

    setPropertyName("");
    await loadProperties();
  }

  async function createRooms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before adding rooms.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms`,
      {
        body: JSON.stringify({
          from: Number(roomFrom),
          prefix: roomPrefix,
          to: Number(roomTo),
          type: roomType,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create rooms."));
      return;
    }

    setRoomFrom("");
    setRoomTo("");
    await loadProperties();
  }

  async function updateRoomStatus(roomId: string, status: string) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before updating room status.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/status`,
      {
        body: JSON.stringify({ status }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update room status."));
      return;
    }

    await loadProperties();
  }

  async function checkInGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId || !checkInRoomId) {
      setError("Choose a room before checking in a guest.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${checkInRoomId}/check-in`,
      {
        body: JSON.stringify({
          email: guestEmail,
          expectedCheckOutAt: expectedCheckOutAt || undefined,
          firstName: guestFirstName,
          lastName: guestLastName,
          phone: guestPhone,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not check in guest."));
      return;
    }

    setCheckInRoomId("");
    setGuestFirstName("");
    setGuestLastName("");
    setGuestPhone("");
    setGuestEmail("");
    setExpectedCheckOutAt("");
    await loadProperties();
  }

  async function checkOutGuest(roomId: string) {
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before checking out a guest.");
      setIsSubmitting(false);
      return;
    }

    const postCheckout = (acknowledgeRestaurantCharges: boolean) =>
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/check-out`,
        {
          body: acknowledgeRestaurantCharges
            ? JSON.stringify({ acknowledgeRestaurantCharges })
            : undefined,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(acknowledgeRestaurantCharges
              ? { "Content-Type": "application/json" }
              : {}),
          },
          method: "POST",
        },
      );

    let response = await postCheckout(false);

    if (!response.ok) {
      const message = await readApiMessage(response, "Could not check out guest.");

      if (
        response.status === 400 &&
        message.startsWith("Review ") &&
        window.confirm(message)
      ) {
        response = await postCheckout(true);
      } else {
        setError(message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not check out guest."));
      return;
    }

    await loadProperties();
  }

  return (
    <div className="operations-grid">
      <section className="notice-panel operations-header">
        <div>
          <p className="eyebrow">Properties</p>
          <h2>{data?.tenant.name ?? "Property operations"}</h2>
          <p>
            Manage hotel properties, room inventory, room status, and restaurant
            links inside the active tenant workspace.
          </p>
        </div>
        <button type="button" onClick={loadProperties} disabled={loadState === "loading"}>
          <RefreshCw aria-hidden="true" />
          {loadState === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="status-grid property-stats">
        <div>
          <span>Properties</span>
          <strong>{data?.properties.length ?? 0}</strong>
        </div>
        <div>
          <span>Rooms</span>
          <strong>
            {data?.properties.reduce(
              (total, property) => total + property.rooms.length,
              0,
            ) ?? 0}
          </strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>{data?.currentUser.role.replaceAll("_", " ") ?? "Loading"}</strong>
        </div>
        <div>
          <span>Selected property</span>
          <strong>{selectedProperty?.name ?? "None"}</strong>
        </div>
      </section>

      <section className="property-layout">
        <div className="property-list">
          {(data?.properties ?? []).map((property) => (
            <button
              className="property-card"
              data-selected={selectedProperty?.id === property.id}
              key={property.id}
              onClick={() => setSelectedPropertyId(property.id)}
              type="button"
            >
              <Building2 aria-hidden="true" />
              <strong>{property.name}</strong>
              <span>{property.city ?? "City not set"}</span>
              <small>
                {property.rooms.length} rooms - {property.currency}
              </small>
            </button>
          ))}

          {!data?.properties.length && loadState !== "loading" ? (
            <div className="empty-state">No properties have been created yet.</div>
          ) : null}
        </div>

        <div className="property-detail">
          {selectedProperty ? (
            <>
              <section className="notice-panel property-detail-card">
                <p className="eyebrow">Room inventory</p>
                <h2>{selectedProperty.name}</h2>
                <p>
                  {selectedProperty.city ?? "City not set"} -{" "}
                  {selectedProperty.timezone} - {selectedProperty.currency}
                </p>

                <div className="room-operations-bar">
                  <div className="room-status-counts">
                    {roomStatuses.map((status) => (
                      <button
                        className="status-filter-button"
                        data-selected={statusFilter === status}
                        key={status}
                        onClick={() =>
                          setStatusFilter((current) =>
                            current === status ? "all" : status,
                          )
                        }
                        type="button"
                      >
                        <span>{formatLabel(status)}</span>
                        <strong>{statusCounts.get(status) ?? 0}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="room-filter-row">
                    <label>
                      Status
                      <select
                        onChange={(event) => setStatusFilter(event.target.value)}
                        value={statusFilter}
                      >
                        <option value="all">All statuses</option>
                        {roomStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Type
                      <select
                        onChange={(event) => setTypeFilter(event.target.value)}
                        value={typeFilter}
                      >
                        <option value="all">All types</option>
                        {roomTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="room-grid">
                  {filteredRooms.map((room) => (
                    <div className="room-card" data-status={room.status} key={room.id}>
                      <DoorOpen aria-hidden="true" />
                      <strong>{room.number}</strong>
                      <span>{room.type}</span>
                      {room.activeStay ? (
                        <div className="stay-summary">
                          <strong>
                            {room.activeStay.guest.firstName}{" "}
                            {room.activeStay.guest.lastName}
                          </strong>
                          {room.activeStay.guest.phone ? (
                            <span>{room.activeStay.guest.phone}</span>
                          ) : null}
                          <span>
                            Checked in{" "}
                            {new Date(room.activeStay.checkInAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : null}
                      {data?.allowedRoomStatuses.length ? (
                        <select
                          aria-label={`Status for room ${room.number}`}
                          onChange={(event) =>
                            updateRoomStatus(room.id, event.target.value)
                          }
                          value={room.status}
                        >
                          {statusOptionsForRoom(
                            room.status,
                            data.allowedRoomStatuses,
                          ).map((status) => (
                            <option key={status} value={status}>
                              {formatLabel(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <small>{formatLabel(room.status)}</small>
                      )}
                      {data?.canManageStays && room.activeStay ? (
                        <button
                          className="secondary-button"
                          disabled={isSubmitting}
                          onClick={() => checkOutGuest(room.id)}
                          type="button"
                        >
                          Check out
                        </button>
                      ) : null}
                      {data?.canManageStays && !room.activeStay ? (
                        <button
                          className="secondary-button"
                          onClick={() =>
                            setCheckInRoomId((current) =>
                              current === room.id ? "" : room.id,
                            )
                          }
                          type="button"
                        >
                          {checkInRoomId === room.id ? "Cancel" : "Check in"}
                        </button>
                      ) : null}
                      {checkInRoomId === room.id ? (
                        <form className="check-in-form" onSubmit={checkInGuest}>
                          <label>
                            First name
                            <input
                              onChange={(event) =>
                                setGuestFirstName(event.target.value)
                              }
                              required
                              value={guestFirstName}
                            />
                          </label>
                          <label>
                            Last name
                            <input
                              onChange={(event) =>
                                setGuestLastName(event.target.value)
                              }
                              required
                              value={guestLastName}
                            />
                          </label>
                          <label>
                            Phone
                            <input
                              onChange={(event) => setGuestPhone(event.target.value)}
                              value={guestPhone}
                            />
                          </label>
                          <label>
                            Email
                            <input
                              onChange={(event) => setGuestEmail(event.target.value)}
                              type="email"
                              value={guestEmail}
                            />
                          </label>
                          <label>
                            Expected check-out
                            <input
                              onChange={(event) =>
                                setExpectedCheckOutAt(event.target.value)
                              }
                              type="date"
                              value={expectedCheckOutAt}
                            />
                          </label>
                          <button disabled={isSubmitting} type="submit">
                            Confirm check-in
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>

                {!selectedProperty.rooms.length ? (
                  <div className="empty-state">No rooms added yet.</div>
                ) : null}

                {selectedProperty.rooms.length && !filteredRooms.length ? (
                  <div className="empty-state">No rooms match these filters.</div>
                ) : null}
              </section>

              {data?.canManageProperties ? (
                <section className="notice-panel compact-panel">
                  <p className="eyebrow">Add rooms</p>
                  <form className="inventory-form" onSubmit={createRooms}>
                    <label>
                      Type
                      <input
                        onChange={(event) => setRoomType(event.target.value)}
                        placeholder="standard"
                        required
                        value={roomType}
                      />
                    </label>
                    <label>
                      Prefix
                      <input
                        onChange={(event) => setRoomPrefix(event.target.value)}
                        placeholder="A"
                        value={roomPrefix}
                      />
                    </label>
                    <label>
                      From
                      <input
                        inputMode="numeric"
                        onChange={(event) => setRoomFrom(event.target.value)}
                        placeholder="101"
                        required
                        value={roomFrom}
                      />
                    </label>
                    <label>
                      To
                      <input
                        inputMode="numeric"
                        onChange={(event) => setRoomTo(event.target.value)}
                        placeholder="120"
                        required
                        value={roomTo}
                      />
                    </label>
                    <button disabled={isSubmitting} type="submit">
                      <Plus aria-hidden="true" />
                      Add rooms
                    </button>
                  </form>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {data?.canManageProperties ? (
        <section className="notice-panel compact-panel">
          <p className="eyebrow">New property</p>
          <form className="inventory-form" onSubmit={createProperty}>
            <label>
              Property name
              <input
                onChange={(event) => setPropertyName(event.target.value)}
                placeholder="Rayaan Airport Hotel"
                required
                value={propertyName}
              />
            </label>
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
                onChange={(event) => setCurrency(event.target.value)}
                value={currency}
              >
                <option value="USD">USD</option>
                <option value="KES">KES</option>
                <option value="SOS">SOS</option>
              </select>
            </label>
            <button disabled={isSubmitting} type="submit">
              <Plus aria-hidden="true" />
              Create property
            </button>
          </form>
        </section>
      ) : (
        <div className="empty-state">
          Ask an owner or admin to create properties and room inventory.
        </div>
      )}
    </div>
  );
}
