"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { Plus, RefreshCw, ReceiptText, Utensils } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

interface RestaurantResponse {
  allowedOrderStatuses: string[];
  allowedTableStatuses: string[];
  canCreateOrder: boolean;
  canManageRestaurant: boolean;
  currentUser: {
    clerkUserId: string;
    role: string;
  };
  properties: Array<{
    id: string;
    name: string;
  }>;
  tenant: {
    id: string;
    name: string;
    slug: string;
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
        menuItemId: string | null;
        name: string;
        notes: string | null;
        quantity: number;
        totalPrice: number;
        unitPrice: number;
      }>;
      status: string;
      tableId: string | null;
      totalAmount: number;
    }>;
    menuCategories: Array<{
      id: string;
      items: Array<{
        categoryId: string | null;
        currency: string;
        description: string | null;
        id: string;
        name: string;
        price: number;
      }>;
      name: string;
    }>;
    menuItems: Array<{
      categoryId: string | null;
      currency: string;
      description: string | null;
      id: string;
      name: string;
      price: number;
    }>;
    property: {
      id: string;
      name: string;
    };
    serviceStyle: string | null;
    tables: Array<{
      id: string;
      name: string;
      qrCode: string | null;
      status: string;
    }>;
  }>;
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

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function RestaurantsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [data, setData] = useState<RestaurantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [newRestaurantPropertyId, setNewRestaurantPropertyId] = useState("");
  const [newRestaurantServiceStyle, setNewRestaurantServiceStyle] =
    useState("table_service");
  const [newTableName, setNewTableName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newMenuItemCategoryId, setNewMenuItemCategoryId] = useState("");
  const [newMenuItemDescription, setNewMenuItemDescription] = useState("");
  const [newMenuItemName, setNewMenuItemName] = useState("");
  const [newMenuItemPrice, setNewMenuItemPrice] = useState("");
  const [orderTableId, setOrderTableId] = useState("");
  const [orderMenuItemId, setOrderMenuItemId] = useState("");
  const [orderItemNotes, setOrderItemNotes] = useState("");
  const [orderItemQuantity, setOrderItemQuantity] = useState("1");
  const [orderItems, setOrderItems] = useState<
    Array<{ menuItemId: string; notes: string; quantity: number }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRestaurant = useMemo(
    () =>
      data?.restaurants.find(
        (restaurant) => restaurant.id === selectedRestaurantId,
      ) ?? data?.restaurants[0],
    [data?.restaurants, selectedRestaurantId],
  );

  const ordersByTable = useMemo(() => {
    const orderMap = new Map<string, RestaurantResponse["restaurants"][number]["orders"]>();

    for (const order of selectedRestaurant?.orders ?? []) {
      if (!order.tableId) {
        continue;
      }

      orderMap.set(order.tableId, [...(orderMap.get(order.tableId) ?? []), order]);
    }

    return orderMap;
  }, [selectedRestaurant?.orders]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((total, item) => {
      const menuItem = selectedRestaurant?.menuItems.find(
        (candidate) => candidate.id === item.menuItemId,
      );

      return total + (menuItem?.price ?? 0) * item.quantity;
    }, 0);
  }, [orderItems, selectedRestaurant?.menuItems]);

  async function getOrganizationToken() {
    return getToken(organization ? { organizationId: organization.id } : undefined);
  }

  async function loadRestaurants() {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setLoadState("loading");
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setLoadState("error");
      setError("Select or create a workspace organization before opening restaurants.");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/restaurants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setLoadState("error");
        setError(await readApiMessage(response, "Could not load restaurants."));
        return;
      }

      const payload = (await response.json()) as RestaurantResponse;
      setData(payload);
      setSelectedRestaurantId(
        (current) => current || payload.restaurants[0]?.id || "",
      );
      setNewRestaurantPropertyId(
        (current) => current || payload.properties[0]?.id || "",
      );
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("Could not reach the Rayaan API. Check that the API is running.");
    }
  }

  useEffect(() => {
    void loadRestaurants();
  }, [getToken, isLoaded, isSignedIn, organization]);

  async function createRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();

    if (!token || !newRestaurantPropertyId) {
      setError("Choose a property before enabling restaurant operations.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/restaurants`, {
      body: JSON.stringify({
        name: newRestaurantName,
        propertyId: newRestaurantPropertyId,
        serviceStyle: newRestaurantServiceStyle,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create restaurant."));
      return;
    }

    setNewRestaurantName("");
    await loadRestaurants();
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before adding tables.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/tables`,
      {
        body: JSON.stringify({ name: newTableName }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create table."));
      return;
    }

    setNewTableName("");
    await loadRestaurants();
  }

  async function createMenuCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before adding menu categories.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/menu-categories`,
      {
        body: JSON.stringify({ name: newCategoryName }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create menu category."));
      return;
    }

    setNewCategoryName("");
    await loadRestaurants();
  }

  async function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before adding menu items.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/menu-items`,
      {
        body: JSON.stringify({
          categoryId: newMenuItemCategoryId || undefined,
          description: newMenuItemDescription || undefined,
          name: newMenuItemName,
          price: Number(newMenuItemPrice),
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
      setError(await readApiMessage(response, "Could not create menu item."));
      return;
    }

    setNewMenuItemDescription("");
    setNewMenuItemName("");
    setNewMenuItemPrice("");
    await loadRestaurants();
  }

  async function updateTableStatus(tableId: string, status: string) {
    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before changing table status.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/tables/${tableId}/status`,
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
      setError(await readApiMessage(response, "Could not update table."));
      return;
    }

    await loadRestaurants();
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before creating an order.");
      setIsSubmitting(false);
      return;
    }

    if (!orderItems.length) {
      setError("Add at least one menu item before sending the order.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/orders`,
      {
        body: JSON.stringify({
          items: orderItems,
          tableId: orderTableId || undefined,
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
      setError(await readApiMessage(response, "Could not create order."));
      return;
    }

    setOrderItems([]);
    setOrderTableId("");
    await loadRestaurants();
  }

  function addOrderItem() {
    if (!orderMenuItemId) {
      return;
    }

    setOrderItems((current) => [
      ...current,
      {
        menuItemId: orderMenuItemId,
        notes: orderItemNotes,
        quantity: Number(orderItemQuantity) || 1,
      },
    ]);
    setOrderItemNotes("");
    setOrderItemQuantity("1");
    setOrderMenuItemId("");
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before changing order status.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/orders/${orderId}/status`,
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
      setError(await readApiMessage(response, "Could not update order."));
      return;
    }

    await loadRestaurants();
  }

  return (
    <div className="operations-grid">
      <section className="notice-panel operations-header">
        <div>
          <p className="eyebrow">Restaurants</p>
          <h2>{data?.tenant.name ?? "Restaurant operations"}</h2>
          <p>
            Manage tables and simple restaurant orders inside the active tenant.
          </p>
        </div>
        <button
          disabled={loadState === "loading"}
          onClick={loadRestaurants}
          type="button"
        >
          <RefreshCw aria-hidden="true" />
          {loadState === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="status-grid property-stats">
        <div>
          <span>Restaurants</span>
          <strong>{data?.restaurants.length ?? 0}</strong>
        </div>
        <div>
          <span>Tables</span>
          <strong>
            {data?.restaurants.reduce(
              (total, restaurant) => total + restaurant.tables.length,
              0,
            ) ?? 0}
          </strong>
        </div>
        <div>
          <span>Open orders</span>
          <strong>
            {data?.restaurants.reduce(
              (total, restaurant) =>
                total +
                restaurant.orders.filter(
                  (order) =>
                    !["served", "cancelled"].includes(order.status),
                ).length,
              0,
            ) ?? 0}
          </strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>{data?.currentUser.role.replaceAll("_", " ") ?? "Loading"}</strong>
        </div>
      </section>

      <section className="property-layout">
        <div className="property-list">
          {(data?.restaurants ?? []).map((restaurant) => (
            <button
              className="property-card"
              data-selected={selectedRestaurant?.id === restaurant.id}
              key={restaurant.id}
              onClick={() => setSelectedRestaurantId(restaurant.id)}
              type="button"
            >
              <Utensils aria-hidden="true" />
              <strong>{restaurant.name}</strong>
              <span>{restaurant.property.name}</span>
              <small>
                {restaurant.tables.length} tables -{" "}
                {restaurant.serviceStyle ?? "service"}
              </small>
            </button>
          ))}

          {!data?.restaurants.length && loadState !== "loading" ? (
            <div className="empty-state">
              No restaurants exist for this workspace yet.
            </div>
          ) : null}
        </div>

        <div className="property-detail">
          {!selectedRestaurant && data?.canManageRestaurant ? (
            <section className="notice-panel compact-panel">
              <p className="eyebrow">Enable restaurant</p>
              <h2>Create restaurant operations</h2>
              <p>
                Connect a restaurant to one of your existing hotel properties.
              </p>
              <form className="restaurant-order-form" onSubmit={createRestaurant}>
                <label>
                  Property
                  <select
                    onChange={(event) =>
                      setNewRestaurantPropertyId(event.target.value)
                    }
                    required
                    value={newRestaurantPropertyId}
                  >
                    <option value="">Choose property</option>
                    {(data?.properties ?? []).map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Restaurant name
                  <input
                    onChange={(event) => setNewRestaurantName(event.target.value)}
                    placeholder="Rayaan Restaurant"
                    required
                    value={newRestaurantName}
                  />
                </label>
                <label>
                  Service style
                  <select
                    onChange={(event) =>
                      setNewRestaurantServiceStyle(event.target.value)
                    }
                    value={newRestaurantServiceStyle}
                  >
                    <option value="table_service">Table service</option>
                    <option value="counter_service">Counter service</option>
                    <option value="room_service">Room service</option>
                  </select>
                </label>
                <button disabled={isSubmitting} type="submit">
                  <Plus aria-hidden="true" />
                  Create restaurant
                </button>
              </form>
            </section>
          ) : null}

          {!selectedRestaurant && !data?.canManageRestaurant ? (
            <div className="empty-state">
              Ask an owner, admin, or restaurant manager to enable restaurant
              operations.
            </div>
          ) : null}

          {selectedRestaurant ? (
            <>
              <section className="notice-panel property-detail-card">
                <p className="eyebrow">Table floor</p>
                <h2>{selectedRestaurant.name}</h2>
                <p>
                  {selectedRestaurant.property.name} -{" "}
                  {selectedRestaurant.serviceStyle ?? "restaurant service"}
                </p>

                <div className="restaurant-table-grid">
                  {selectedRestaurant.tables.map((table) => {
                    const tableOrders = ordersByTable.get(table.id) ?? [];

                    return (
                      <div className="restaurant-table-card" key={table.id}>
                        <Utensils aria-hidden="true" />
                        <strong>{table.name}</strong>
                        {data?.allowedTableStatuses.length ? (
                          <select
                            aria-label={`Status for ${table.name}`}
                            onChange={(event) =>
                              updateTableStatus(table.id, event.target.value)
                            }
                            value={table.status}
                          >
                            {data.allowedTableStatuses.includes(table.status)
                              ? null
                              : (
                                  <option value={table.status}>
                                    {formatLabel(table.status)}
                                  </option>
                                )}
                            {data.allowedTableStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{formatLabel(table.status)}</span>
                        )}

                        {tableOrders.slice(0, 2).map((order) => (
                          <small key={order.id}>
                            {order.currency} {order.totalAmount.toFixed(2)} -{" "}
                            {formatLabel(order.status)}
                          </small>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {!selectedRestaurant.tables.length ? (
                  <div className="empty-state">No tables have been created yet.</div>
                ) : null}
              </section>

              {data?.canManageRestaurant ? (
                <section className="notice-panel compact-panel">
                  <p className="eyebrow">Menu</p>
                  <h2>Menu setup</h2>
                  <form className="restaurant-menu-form" onSubmit={createMenuCategory}>
                    <label>
                      Category
                      <input
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        placeholder="Breakfast"
                        required
                        value={newCategoryName}
                      />
                    </label>
                    <button disabled={isSubmitting} type="submit">
                      <Plus aria-hidden="true" />
                      Add category
                    </button>
                  </form>

                  <form className="restaurant-menu-form" onSubmit={createMenuItem}>
                    <label>
                      Item
                      <input
                        onChange={(event) => setNewMenuItemName(event.target.value)}
                        placeholder="Chicken suqaar"
                        required
                        value={newMenuItemName}
                      />
                    </label>
                    <label>
                      Category
                      <select
                        onChange={(event) =>
                          setNewMenuItemCategoryId(event.target.value)
                        }
                        value={newMenuItemCategoryId}
                      >
                        <option value="">Uncategorized</option>
                        {selectedRestaurant.menuCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Price
                      <input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => setNewMenuItemPrice(event.target.value)}
                        placeholder="8.00"
                        required
                        type="number"
                        value={newMenuItemPrice}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        onChange={(event) =>
                          setNewMenuItemDescription(event.target.value)
                        }
                        placeholder="Optional"
                        value={newMenuItemDescription}
                      />
                    </label>
                    <button disabled={isSubmitting} type="submit">
                      <Plus aria-hidden="true" />
                      Add item
                    </button>
                  </form>

                  <div className="menu-grid">
                    {selectedRestaurant.menuItems.map((item) => (
                      <div className="menu-item-card" key={item.id}>
                        <strong>{item.name}</strong>
                        <span>
                          {item.currency} {item.price.toFixed(2)}
                        </span>
                        {item.description ? <small>{item.description}</small> : null}
                      </div>
                    ))}
                    {!selectedRestaurant.menuItems.length ? (
                      <div className="empty-state">No menu items yet.</div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="notice-panel compact-panel">
                <p className="eyebrow">Orders</p>
                {data?.canCreateOrder ? (
                  <form className="restaurant-order-builder" onSubmit={createOrder}>
                    <div className="restaurant-order-form">
                      <label>
                        Table
                        <select
                          onChange={(event) => setOrderTableId(event.target.value)}
                          value={orderTableId}
                        >
                          <option value="">Counter / takeaway</option>
                          {selectedRestaurant.tables.map((table) => (
                            <option key={table.id} value={table.id}>
                              {table.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Menu item
                        <select
                          onChange={(event) => setOrderMenuItemId(event.target.value)}
                          value={orderMenuItemId}
                        >
                          <option value="">Choose item</option>
                          {selectedRestaurant.menuItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} - {item.currency} {item.price.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Qty
                        <input
                          min="1"
                          onChange={(event) =>
                            setOrderItemQuantity(event.target.value)
                          }
                          type="number"
                          value={orderItemQuantity}
                        />
                      </label>
                    </div>
                    <div className="restaurant-order-form">
                      <label>
                        Notes
                        <input
                          onChange={(event) => setOrderItemNotes(event.target.value)}
                          placeholder="No onions"
                          value={orderItemNotes}
                        />
                      </label>
                      <button onClick={addOrderItem} type="button">
                        <Plus aria-hidden="true" />
                        Add item
                      </button>
                      <button disabled={isSubmitting || !orderItems.length} type="submit">
                        <Plus aria-hidden="true" />
                        Send order
                      </button>
                    </div>

                    {orderItems.length ? (
                      <div className="order-draft-list">
                        {orderItems.map((item, index) => {
                          const menuItem = selectedRestaurant.menuItems.find(
                            (candidate) => candidate.id === item.menuItemId,
                          );

                          return (
                            <div className="order-draft-row" key={`${item.menuItemId}-${index}`}>
                              <span>
                                {item.quantity}x {menuItem?.name ?? "Menu item"}
                              </span>
                              <strong>
                                {menuItem?.currency ?? selectedRestaurant.orders[0]?.currency ?? "USD"}{" "}
                                {((menuItem?.price ?? 0) * item.quantity).toFixed(2)}
                              </strong>
                              <button
                                className="danger-button"
                                onClick={() =>
                                  setOrderItems((current) =>
                                    current.filter((_, itemIndex) => itemIndex !== index),
                                  )
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                        <div className="order-draft-total">
                          <span>Total</span>
                          <strong>{orderTotal.toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : null}
                  </form>
                ) : null}

                <div className="restaurant-order-list">
                  {selectedRestaurant.orders.map((order) => (
                    <div className="team-row" key={order.id}>
                      <div>
                        <strong>
                          {order.currency} {order.totalAmount.toFixed(2)}
                        </strong>
                        <span>
                          {order.tableId
                            ? selectedRestaurant.tables.find(
                                (table) => table.id === order.tableId,
                              )?.name ?? "Table"
                            : "Counter / takeaway"}
                        </span>
                        <span>
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                        {order.items.map((item) => (
                          <small key={item.id}>
                            {item.quantity}x {item.name}
                            {item.notes ? ` - ${item.notes}` : ""}
                          </small>
                        ))}
                      </div>
                      <div className="team-row-actions">
                        <ReceiptText aria-hidden="true" />
                        {data?.allowedOrderStatuses.length ? (
                          <select
                            aria-label={`Status for order ${order.id}`}
                            onChange={(event) =>
                              updateOrderStatus(order.id, event.target.value)
                            }
                            value={order.status}
                          >
                            {data.allowedOrderStatuses.includes(order.status)
                              ? null
                              : (
                                  <option value={order.status}>
                                    {formatLabel(order.status)}
                                  </option>
                                )}
                            {data.allowedOrderStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="role-pill">
                            {formatLabel(order.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {!selectedRestaurant.orders.length ? (
                    <div className="empty-state">No orders yet.</div>
                  ) : null}
                </div>
              </section>

              {data?.canManageRestaurant ? (
                <section className="notice-panel compact-panel">
                  <p className="eyebrow">Add table</p>
                  <form className="restaurant-order-form" onSubmit={createTable}>
                    <label>
                      Table name
                      <input
                        onChange={(event) => setNewTableName(event.target.value)}
                        placeholder="Table 1"
                        required
                        value={newTableName}
                      />
                    </label>
                    <button disabled={isSubmitting} type="submit">
                      <Plus aria-hidden="true" />
                      Add table
                    </button>
                  </form>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
