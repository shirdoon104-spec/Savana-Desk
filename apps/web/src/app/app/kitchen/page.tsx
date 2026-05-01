"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { ChefHat, RefreshCw, Timer } from "lucide-react";
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
      items: Array<{
        id: string;
        name: string;
        notes: string | null;
        quantity: number;
      }>;
      status: string;
      tableId: string | null;
      totalAmount: number;
    }>;
    property: {
      name: string;
    };
    tables: Array<{
      id: string;
      name: string;
    }>;
  }>;
}

interface KitchenOrder {
  createdAt: string;
  currency: string;
  id: string;
  items: Array<{
    id: string;
    name: string;
    notes: string | null;
    quantity: number;
  }>;
  restaurantId: string;
  restaurantName: string;
  status: string;
  tableName: string;
  totalAmount: number;
}

const kitchenColumns = ["sent", "preparing", "ready"] as const;

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

export default function KitchenPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [data, setData] = useState<RestaurantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const orders = useMemo<KitchenOrder[]>(() => {
    return (data?.restaurants ?? []).flatMap((restaurant) =>
      restaurant.orders
        .filter((order) => !["draft", "served", "cancelled"].includes(order.status))
        .map((order) => ({
          ...order,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          tableName: order.tableId
            ? restaurant.tables.find((table) => table.id === order.tableId)?.name ??
              "Table"
            : "Counter / takeaway",
        })),
    );
  }, [data?.restaurants]);

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

  async function updateOrderStatus(order: KitchenOrder, status: string) {
    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before updating orders.");
      return;
    }

    setError(null);
    setUpdatingOrderId(order.id);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${order.restaurantId}/orders/${order.id}/status`,
      {
        body: JSON.stringify({ status }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    setUpdatingOrderId(null);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update order status."));
      return;
    }

    await loadKitchen();
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

      <section className="status-grid property-stats">
        <div>
          <span>Queued</span>
          <strong>{orders.filter((order) => order.status === "sent").length}</strong>
        </div>
        <div>
          <span>Preparing</span>
          <strong>
            {orders.filter((order) => order.status === "preparing").length}
          </strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{orders.filter((order) => order.status === "ready").length}</strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>{data?.currentUser.role.replaceAll("_", " ") ?? "Loading"}</strong>
        </div>
      </section>

      <section className="kitchen-board">
        {kitchenColumns.map((status) => (
          <div className="notice-panel kitchen-column" key={status}>
            <div className="kitchen-column-header">
              <ChefHat aria-hidden="true" />
              <div>
                <p className="eyebrow">{formatLabel(status)}</p>
                <h2>{orders.filter((order) => order.status === status).length}</h2>
              </div>
            </div>

            <div className="restaurant-order-list">
              {orders
                .filter((order) => order.status === status)
                .map((order) => (
                  <div className="team-row kitchen-order" key={order.id}>
                    <div>
                      <strong>{order.tableName}</strong>
                      <span>{order.restaurantName}</span>
                      <span>
                        {order.currency} {order.totalAmount.toFixed(2)}
                      </span>
                      {order.items.map((item) => (
                        <small key={item.id}>
                          {item.quantity}x {item.name}
                          {item.notes ? ` - ${item.notes}` : ""}
                        </small>
                      ))}
                      <small>
                        <Timer aria-hidden="true" />
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </small>
                    </div>
                    <div className="team-row-actions">
                      {status === "sent" &&
                      data?.allowedOrderStatuses.includes("preparing") ? (
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order, "preparing")}
                          type="button"
                        >
                          Start
                        </button>
                      ) : null}
                      {status === "preparing" &&
                      data?.allowedOrderStatuses.includes("ready") ? (
                        <button
                          disabled={updatingOrderId === order.id}
                          onClick={() => updateOrderStatus(order, "ready")}
                          type="button"
                        >
                          Ready
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

              {!orders.some((order) => order.status === status) ? (
                <div className="empty-state">No {formatLabel(status)} orders.</div>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
