"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { ChefHat, Printer, RefreshCw, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

interface RestaurantResponse {
  allowedOrderStatuses: string[];
  currentUser: {
    role: string;
  };
  tenant: {
    name: string;
  };
  restaurants: Array<{
    id: string;
    name: string;
    orders: Array<{
      createdAt: string;
      currency: string;
      id: string;
      items: KitchenItem[];
      status: string;
      tableId: string | null;
      totalAmount: number;
    }>;
    kitchenStations: Array<{
      displayOrder: number;
      id: string;
      name: string;
      type: string;
    }>;
    property: {
      name: string;
    };
    tables: Array<{
      coverCount: number;
      id: string;
      name: string;
    }>;
  }>;
}

interface KitchenOrder {
  covers: number;
  createdAt: string;
  currency: string;
  id: string;
  items: KitchenItem[];
  restaurantId: string;
  restaurantName: string;
  status: string;
  tableName: string;
  totalAmount: number;
}

interface KitchenItem {
  allergens: string[];
  course: number;
  dietary: string[];
  id: string;
  kitchenStation: string | null;
  modifiers: unknown;
  name: string;
  notes: string | null;
  preparedAt: string | null;
  quantity: number;
  sentAt: string | null;
  status: string;
}

interface KitchenTicket {
  covers: number;
  course: number;
  createdAt: string;
  elapsedMinutes: number;
  id: string;
  items: KitchenItem[];
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  station: string;
  stationName: string;
  status: string;
  tableName: string;
}

function ticketStatusForItems(items: KitchenItem[]) {
  if (items.some((item) => item.status === "sent")) {
    return "sent";
  }

  if (items.some((item) => item.status === "preparing")) {
    return "preparing";
  }

  return "ready";
}

const kitchenStationFallbacks = [
  "bar",
  "grill",
  "main_kitchen",
  "dessert",
  "cold_station",
] as const;

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

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatModifiers(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value
    .map((modifier) => {
      if (!modifier || typeof modifier !== "object" || Array.isArray(modifier)) {
        return null;
      }

      const { label, value: modifierValue } = modifier as {
        label?: unknown;
        value?: unknown;
      };

      return [label, modifierValue].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join(", ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildKitchenTicketHtml(ticket: KitchenTicket) {
  const allergenText = Array.from(
    new Set(ticket.items.flatMap((item) => item.allergens)),
  ).map(formatLabel).join(", ");
  const dietaryText = Array.from(
    new Set(ticket.items.flatMap((item) => item.dietary)),
  ).map(formatLabel).join(", ");
  const printedAt = new Date().toLocaleString();
  const firedAt = new Date(
    ticket.items.map((item) => item.sentAt).find(Boolean) ?? ticket.createdAt,
  ).toLocaleString();
  const ticketNumber = ticket.id.toUpperCase();
  const noteRows = [
    allergenText ? `<p class="warning"><strong>Allergens:</strong> ${escapeHtml(allergenText)}</p>` : "",
    dietaryText ? `<p><strong>Dietary:</strong> ${escapeHtml(dietaryText)}</p>` : "",
  ].join("");
  const itemRows = ticket.items
    .map((item) => {
      const modifierText = formatModifiers(item.modifiers);
      const details = [
        modifierText ? `<p><strong>Modifiers:</strong> ${escapeHtml(modifierText)}</p>` : "",
        item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : "",
      ].join("");

      return `
        <div class="item-line">
          <strong>${item.quantity}x ${escapeHtml(item.name)}</strong>
          ${details}
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Kitchen ticket ${escapeHtml(ticketNumber)}</title>
    <style>
      @page { margin: 8mm; size: 80mm auto; }
      * { box-sizing: border-box; }
      body {
        color: #111827;
        font-family: Arial, sans-serif;
        font-size: 12px;
        margin: 0;
      }
      .ticket {
        width: 100%;
      }
      .header {
        border-bottom: 2px solid #111827;
        margin-bottom: 10px;
        padding-bottom: 8px;
        text-align: center;
      }
      h1 {
        font-size: 18px;
        letter-spacing: 0;
        margin: 0 0 4px;
        text-transform: uppercase;
      }
      .meta {
        border-bottom: 1px dashed #6b7280;
        display: grid;
        gap: 4px;
        margin-bottom: 12px;
        padding-bottom: 10px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .item {
        border-bottom: 2px solid #111827;
        margin-bottom: 10px;
        padding-bottom: 10px;
      }
      .item-line {
        border-bottom: 1px dashed #d1d5db;
        padding: 8px 0;
      }
      .item-line:last-child {
        border-bottom: 0;
      }
      .item-line strong {
        display: block;
        font-size: 20px;
        line-height: 1.2;
      }
      p {
        margin: 6px 0;
      }
      .footer {
        color: #374151;
        font-size: 11px;
        text-align: center;
      }
      .warning {
        border: 2px solid #b91c1c;
        color: #991b1b;
        font-size: 14px;
        padding: 6px;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <main class="ticket">
      <section class="header">
        <h1>${escapeHtml(ticket.stationName)}</h1>
        <div>${escapeHtml(ticket.restaurantName)}</div>
      </section>
      <section class="meta">
        <div class="row"><span>Ticket</span><strong>${escapeHtml(ticketNumber)}</strong></div>
        <div class="row"><span>Table</span><strong>${escapeHtml(ticket.tableName)}</strong></div>
        <div class="row"><span>Covers</span><strong>${ticket.covers}</strong></div>
        <div class="row"><span>Course</span><strong>${ticket.course}</strong></div>
        <div class="row"><span>Fired</span><strong>${escapeHtml(firedAt)}</strong></div>
      </section>
      <section class="item">
        ${noteRows}
        ${itemRows}
      </section>
      <section class="footer">Printed ${escapeHtml(printedAt)}</section>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.print();
      });
    </script>
  </body>
</html>`;
}

export default function KitchenPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [data, setData] = useState<RestaurantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const orders = useMemo<KitchenOrder[]>(() => {
    return (data?.restaurants ?? []).flatMap((restaurant) =>
      restaurant.orders
        .filter(
          (order) => !["draft", "served", "closed", "cancelled"].includes(order.status),
        )
        .map((order) => ({
          ...order,
          covers: restaurant.tables.find((table) => table.id === order.tableId)
            ?.coverCount ?? 0,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          tableName: order.tableId
            ? restaurant.tables.find((table) => table.id === order.tableId)?.name ??
              "Table"
            : "Counter / takeaway",
        })),
    );
  }, [data?.restaurants]);

  const tickets = useMemo<KitchenTicket[]>(() => {
    return orders.flatMap((order) => {
      const groups = new Map<string, KitchenItem[]>();

      for (const item of order.items.filter((candidate) =>
        ["sent", "preparing", "ready"].includes(candidate.status),
      )) {
        const station = item.kitchenStation ?? "main_kitchen";
        const key = `${order.id}:${station}:${item.course}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }

      return Array.from(groups.entries()).map(([key, items]) => {
        const station = key.split(":")[1] ?? "main_kitchen";
        const course = items[0]?.course ?? 1;
        const startedAt = Math.min(
          ...items.map((item) => new Date(item.sentAt ?? order.createdAt).getTime()),
        );
        const stationName =
          (data?.restaurants ?? [])
            .flatMap((restaurant) => restaurant.kitchenStations)
            .find((candidate) => candidate.type === station)?.name ??
          formatLabel(station);

        return {
          covers: order.covers,
          course,
          createdAt: order.createdAt,
          elapsedMinutes: Math.max(0, Math.floor((now - startedAt) / 60000)),
          id: `${order.id.slice(-6)}-${station}-${course}`,
          items,
          orderId: order.id,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurantName,
          station,
          stationName,
          status: ticketStatusForItems(items),
          tableName: order.tableName,
        };
      });
    });
  }, [data?.restaurants, now, orders]);

  const stations = useMemo(() => {
    const configured = (data?.restaurants ?? []).flatMap((restaurant) =>
      restaurant.kitchenStations.map((station) => ({
        name: station.name,
        type: station.type,
      })),
    );
    const configuredTypes = new Set(configured.map((station) => station.type));
    const fallbackStations = kitchenStationFallbacks
      .filter((station) => tickets.some((ticket) => ticket.station === station))
      .filter((station) => !configuredTypes.has(station))
      .map((station) => ({ name: formatLabel(station), type: station }));

    return [...configured, ...fallbackStations];
  }, [data?.restaurants, tickets]);

  const restaurantIds = useMemo(
    () => (data?.restaurants ?? []).map((restaurant) => restaurant.id).join(","),
    [data?.restaurants],
  );

  async function getOrganizationToken() {
    return getToken(organization ? { organizationId: organization.id } : undefined);
  }

  async function loadKitchen() {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setLoadState("loading");
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setLoadState("error");
      setError("Select or create a workspace organization before opening kitchen.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/restaurants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setLoadState("error");
        setError(await readApiMessage(response, "Could not load kitchen orders."));
        return;
      }

      setData((await response.json()) as RestaurantResponse);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("Could not reach the Rayaan API. Check that the API is running.");
    }
  }

  useEffect(() => {
    void loadKitchen();
  }, [getToken, isLoaded, isSignedIn, organization]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !restaurantIds) {
      return;
    }

    let isClosed = false;
    const sources: EventSource[] = [];
    const eventNames = [
      "item_fired",
      "item_ready",
      "item_voided",
      "order_cancelled",
      "course_ready",
    ];

    void getOrganizationToken().then((token) => {
      if (!token || isClosed) {
        return;
      }

      for (const restaurantId of restaurantIds.split(",")) {
        const source = new EventSource(
          `${process.env.NEXT_PUBLIC_API_URL}/events/kitchen/${restaurantId}?access_token=${encodeURIComponent(token)}`,
        );
        const reloadKitchen = () => void loadKitchen();

        for (const eventName of eventNames) {
          source.addEventListener(eventName, reloadKitchen);
        }

        sources.push(source);
      }
    });

    return () => {
      isClosed = true;

      for (const source of sources) {
        source.close();
      }
    };
  }, [isLoaded, isSignedIn, organization, restaurantIds]);

  async function updateKitchenTicketStatus(ticket: KitchenTicket, status: "preparing" | "ready") {
    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before updating kitchen items.");
      return;
    }

    setError(null);
    setUpdatingItemId(ticket.id);

    const itemsToUpdate = ticket.items.filter((item) =>
      status === "preparing"
        ? item.status === "sent"
        : ["sent", "preparing"].includes(item.status),
    );

    for (const item of itemsToUpdate) {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${ticket.restaurantId}/orders/${ticket.orderId}/items/${item.id}/status`,
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
        setUpdatingItemId(null);
        setError(await readApiMessage(response, "Could not update kitchen ticket."));
        return;
      }
    }

    setUpdatingItemId(null);

    await loadKitchen();
  }

  function printTicket(ticket: KitchenTicket) {
    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      setError("Allow popups to print kitchen tickets.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildKitchenTicketHtml(ticket));
    printWindow.document.close();
  }

  return (
    <div className="operations-grid">
      <section className="notice-panel operations-header">
        <div>
          <p className="eyebrow">Kitchen</p>
          <h2>{data?.tenant.name ?? "Kitchen board"}</h2>
          <p>Track live restaurant orders from sent to preparing to ready.</p>
        </div>
        <button
          disabled={loadState === "loading"}
          onClick={loadKitchen}
          type="button"
        >
          <RefreshCw aria-hidden="true" />
          {loadState === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <nav aria-label="Kitchen workspace" className="workbench-jump-nav">
        <a href="#kitchen-summary">Summary</a>
        <a href="#kitchen-board">Stations</a>
      </nav>

      <section className="status-grid property-stats" id="kitchen-summary">
        <div>
          <span>Queued</span>
          <strong>{tickets.filter((ticket) => ticket.status === "sent").length}</strong>
        </div>
        <div>
          <span>Preparing</span>
          <strong>
            {tickets.filter((ticket) => ticket.status === "preparing").length}
          </strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{tickets.filter((ticket) => ticket.status === "ready").length}</strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>{data?.currentUser.role.replaceAll("_", " ") ?? "Loading"}</strong>
        </div>
      </section>

      <section className="kitchen-board" id="kitchen-board">
        {stations.map((station) => (
          <div className="notice-panel kitchen-column" key={station.type}>
            <div className="kitchen-column-header">
              <ChefHat aria-hidden="true" />
              <div>
                <p className="eyebrow">Station</p>
                <h2>
                  {station.name}{" "}
                  {tickets.filter((ticket) => ticket.station === station.type).length}
                </h2>
              </div>
            </div>

            <div className="restaurant-order-list">
              {tickets
                .filter((ticket) => ticket.station === station.type)
                .map((ticket) => {
                  const flags = Array.from(
                    new Set(
                      ticket.items.flatMap((item) => [
                        ...item.allergens,
                        ...item.dietary,
                      ]),
                    ),
                  );
                  const heatClass =
                    ticket.elapsedMinutes >= 20
                      ? " kitchen-order-critical"
                      : ticket.elapsedMinutes >= 10
                        ? " kitchen-order-alert"
                        : "";

                  return (
                  <div className={`team-row kitchen-order${heatClass}`} key={ticket.id}>
                    <div>
                      <strong>{ticket.tableName}</strong>
                      <span>{ticket.restaurantName}</span>
                      <span>
                        Course {ticket.course} - {formatLabel(ticket.status)}
                      </span>
                      <div className="kitchen-ticket-items">
                        {ticket.items.map((item) => {
                          const modifierText = formatModifiers(item.modifiers);

                          return (
                            <div key={item.id}>
                              <small>
                                {item.quantity}x {item.name}
                                {item.status !== ticket.status
                                  ? ` (${formatLabel(item.status)})`
                                  : ""}
                              </small>
                              {modifierText ? <small>{modifierText}</small> : null}
                              {item.notes ? <small>{item.notes}</small> : null}
                            </div>
                          );
                        })}
                      </div>
                      {flags.length ? (
                        <span className="kitchen-item-flags">
                          {flags.map((flag) => (
                            <small
                              className={
                                ticket.items.some((item) => item.allergens.includes(flag))
                                  ? "allergen-flag"
                                  : "dietary-flag"
                              }
                              key={flag}
                            >
                              {formatLabel(flag)}
                            </small>
                          ))}
                        </span>
                      ) : null}
                      <small>
                        <Timer aria-hidden="true" />
                        {ticket.elapsedMinutes} min
                      </small>
                    </div>
                    <div className="team-row-actions">
                      <button
                        aria-label={`Print ${ticket.tableName} kitchen ticket`}
                        onClick={() => printTicket(ticket)}
                        title="Print ticket"
                        type="button"
                      >
                        <Printer aria-hidden="true" />
                      </button>
                      {ticket.status === "sent" &&
                      data?.allowedOrderStatuses.includes("preparing") ? (
                        <button
                          disabled={updatingItemId === ticket.id}
                          onClick={() => updateKitchenTicketStatus(ticket, "preparing")}
                          type="button"
                        >
                          Start
                        </button>
                      ) : null}
                      {ticket.status === "preparing" &&
                      data?.allowedOrderStatuses.includes("ready") ? (
                        <button
                          disabled={updatingItemId === ticket.id}
                          onClick={() => updateKitchenTicketStatus(ticket, "ready")}
                          type="button"
                        >
                          Ready
                        </button>
                      ) : null}
                    </div>
                  </div>
                  );
                })}

              {!tickets.some((ticket) => ticket.station === station.type) ? (
                <div className="empty-state">No tickets for this station.</div>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
