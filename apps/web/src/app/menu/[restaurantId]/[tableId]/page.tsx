"use client";

import { CheckCircle2, Minus, Plus, ShoppingBag, Utensils } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

interface PublicMenuResponse {
  property: {
    currency: string;
    name: string;
  };
  restaurant: {
    id: string;
    name: string;
    serviceStyle: string | null;
  };
  table: {
    coverCount: number;
    id: string;
    name: string;
    status: string;
  };
  menuCategories: Array<{
    id: string;
    name: string;
    items: PublicMenuItem[];
  }>;
  menuItems: PublicMenuItem[];
}

interface PublicMenuItem {
  allergens: string[];
  categoryId: string | null;
  currency: string;
  description: string | null;
  dietary: string[];
  id: string;
  imageUrl: string | null;
  name: string;
  price: number;
}

interface PublicOrderResponse {
  currency: string;
  id: string;
  status: string;
  totalAmount: number;
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

export default function PublicMenuPage() {
  const params = useParams<{ restaurantId: string; tableId: string }>();
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [submittedOrder, setSubmittedOrder] = useState<PublicOrderResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItems = useMemo(
    () =>
      Object.entries(orderItems)
        .map(([menuItemId, quantity]) => {
          const menuItem = data?.menuItems.find((item) => item.id === menuItemId);

          return menuItem && quantity > 0 ? { menuItem, quantity } : null;
        })
        .filter(Boolean) as Array<{ menuItem: PublicMenuItem; quantity: number }>,
    [data?.menuItems, orderItems],
  );

  const subtotal = selectedItems.reduce(
    (total, item) => total + item.menuItem.price * item.quantity,
    0,
  );
  const uncategorizedItems = data?.menuItems.filter((item) => !item.categoryId) ?? [];

  useEffect(() => {
    async function loadMenu() {
      setLoadState("loading");
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/menu/${params.restaurantId}/${params.tableId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setError(await readApiMessage(response, "This menu is not available."));
        setLoadState("error");
        return;
      }

      setData((await response.json()) as PublicMenuResponse);
      setLoadState("ready");
    }

    if (params.restaurantId && params.tableId) {
      void loadMenu();
    }
  }, [params.restaurantId, params.tableId]);

  function updateQuantity(menuItemId: string, delta: number) {
    setSubmittedOrder(null);
    setOrderItems((current) => {
      const quantity = Math.max(0, (current[menuItemId] ?? 0) + delta);
      const next = { ...current };

      if (quantity === 0) {
        delete next[menuItemId];
      } else {
        next[menuItemId] = quantity;
      }

      return next;
    });
  }

  async function submitOrder() {
    if (!selectedItems.length || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/public/menu/${params.restaurantId}/${params.tableId}/orders`,
      {
        body: JSON.stringify({
          guestName: guestName || undefined,
          idempotencyKey: crypto.randomUUID(),
          items: selectedItems.map((item) => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
          })),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not send your order."));
      return;
    }

    setSubmittedOrder((await response.json()) as PublicOrderResponse);
    setOrderItems({});
  }

  if (loadState === "loading" || loadState === "idle") {
    return (
      <main className="public-menu-shell">
        <section className="public-menu-status">Loading menu...</section>
      </main>
    );
  }

  if (!data || loadState === "error") {
    return (
      <main className="public-menu-shell">
        <section className="public-menu-status">
          <Utensils aria-hidden="true" />
          <h1>Menu unavailable</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="public-menu-shell">
      <header className="public-menu-header">
        <div>
          <p className="eyebrow">{data.property.name}</p>
          <h1>{data.restaurant.name}</h1>
          <span>{data.table.name}</span>
        </div>
        <ShoppingBag aria-hidden="true" />
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {submittedOrder ? (
        <section className="public-order-success">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Order sent for waiter confirmation</strong>
            <span>
              {submittedOrder.currency} {submittedOrder.totalAmount.toFixed(2)}
            </span>
          </div>
        </section>
      ) : null}

      <section className="public-menu-layout">
        <div className="public-menu-list">
          {data.menuCategories.map((category) =>
            category.items.length ? (
              <section className="public-menu-section" key={category.id}>
                <h2>{category.name}</h2>
                <div className="public-menu-items">
                  {category.items.map((item) => (
                    <article className="public-menu-item" key={item.id}>
                      {item.imageUrl ? (
                        <img alt="" loading="lazy" src={item.imageUrl} />
                      ) : (
                        <div aria-hidden="true" className="public-menu-image-placeholder">
                          <Utensils />
                        </div>
                      )}
                      <div>
                        <h3>{item.name}</h3>
                        {item.description ? <p>{item.description}</p> : null}
                        <div className="menu-item-flags">
                          {item.allergens.map((flag) => (
                            <small className="allergen-flag" key={flag}>
                              {formatLabel(flag)}
                            </small>
                          ))}
                          {item.dietary.map((flag) => (
                            <small className="dietary-flag" key={flag}>
                              {formatLabel(flag)}
                            </small>
                          ))}
                        </div>
                        <strong>
                          {item.currency} {item.price.toFixed(2)}
                        </strong>
                      </div>
                      <div className="public-quantity-controls">
                        <button
                          aria-label={`Remove ${item.name}`}
                          onClick={() => updateQuantity(item.id, -1)}
                          type="button"
                        >
                          <Minus aria-hidden="true" />
                        </button>
                        <span>{orderItems[item.id] ?? 0}</span>
                        <button
                          aria-label={`Add ${item.name}`}
                          onClick={() => updateQuantity(item.id, 1)}
                          type="button"
                        >
                          <Plus aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null,
          )}
          {uncategorizedItems.length ? (
            <section className="public-menu-section">
              <h2>Other</h2>
              <div className="public-menu-items">
                {uncategorizedItems.map((item) => (
                  <article className="public-menu-item" key={item.id}>
                    {item.imageUrl ? (
                      <img alt="" loading="lazy" src={item.imageUrl} />
                    ) : (
                      <div aria-hidden="true" className="public-menu-image-placeholder">
                        <Utensils />
                      </div>
                    )}
                    <div>
                      <h3>{item.name}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                      <div className="menu-item-flags">
                        {item.allergens.map((flag) => (
                          <small className="allergen-flag" key={flag}>
                            {formatLabel(flag)}
                          </small>
                        ))}
                        {item.dietary.map((flag) => (
                          <small className="dietary-flag" key={flag}>
                            {formatLabel(flag)}
                          </small>
                        ))}
                      </div>
                      <strong>
                        {item.currency} {item.price.toFixed(2)}
                      </strong>
                    </div>
                    <div className="public-quantity-controls">
                      <button
                        aria-label={`Remove ${item.name}`}
                        onClick={() => updateQuantity(item.id, -1)}
                        type="button"
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span>{orderItems[item.id] ?? 0}</span>
                      <button
                        aria-label={`Add ${item.name}`}
                        onClick={() => updateQuantity(item.id, 1)}
                        type="button"
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="public-order-panel">
          <label>
            Name
            <input
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Optional"
              value={guestName}
            />
          </label>
          <div className="public-order-lines">
            {selectedItems.map((item) => (
              <div key={item.menuItem.id}>
                <span>
                  {item.quantity}x {item.menuItem.name}
                </span>
                <strong>
                  {item.menuItem.currency}{" "}
                  {(item.menuItem.price * item.quantity).toFixed(2)}
                </strong>
              </div>
            ))}
            {!selectedItems.length ? <p>Your order is empty.</p> : null}
          </div>
          <div className="public-order-total">
            <span>Subtotal</span>
            <strong>
              {data.property.currency} {subtotal.toFixed(2)}
            </strong>
          </div>
          <button
            disabled={!selectedItems.length || isSubmitting}
            onClick={submitOrder}
            type="button"
          >
            <ShoppingBag aria-hidden="true" />
            Send order
          </button>
        </aside>
      </section>
    </main>
  );
}
