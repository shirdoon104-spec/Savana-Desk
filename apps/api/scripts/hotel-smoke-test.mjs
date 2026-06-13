import { randomUUID } from "node:crypto";

const apiUrl = (
  process.env.RAYAAN_SMOKE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");
const token = process.env.RAYAAN_SMOKE_TOKEN;
const runId = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14);
const prefix = process.env.RAYAAN_SMOKE_PREFIX ?? `Smoke ${runId}`;

if (!token) {
  throw new Error(
    "Set RAYAAN_SMOKE_TOKEN to a Clerk bearer token before running the hotel smoke test.",
  );
}

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = text;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? Array.isArray(body.message)
          ? body.message.join(" ")
          : body.message
        : text;

    const error = new Error(
      `${options.method ?? "GET"} ${path} failed with ${response.status}: ${message}`,
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function tomorrowDateInput() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function printStep(message) {
  console.log(`hotel-smoke: ${message}`);
}

printStep(`targeting ${apiUrl}`);

const property = await api("/properties", {
  body: JSON.stringify({
    city: "Mogadishu",
    currency: "USD",
    name: `${prefix} Property`,
  }),
  method: "POST",
});
assert(property.id, "Property response did not include an id.");
printStep(`created property ${property.id}`);

const roomPayload = await api(`/properties/${property.id}/rooms`, {
  body: JSON.stringify({
    from: 1,
    prefix: `SMK${runId}-`,
    to: 1,
    type: "Smoke Standard",
  }),
  method: "POST",
});
const room = roomPayload.rooms?.find((candidate) =>
  String(candidate.number).startsWith(`SMK${runId}-`),
);
assert(room?.id, "Room creation did not return the smoke room.");
printStep(`created room ${room.number}`);

const stay = await api(`/properties/${property.id}/rooms/${room.id}/check-in`, {
  body: JSON.stringify({
    email: `smoke-${runId}@example.com`,
    expectedCheckOutAt: tomorrowDateInput(),
    firstName: "Smoke",
    lastName: "Guest",
    phone: "0700000000",
  }),
  headers: {
    "Idempotency-Key": `hotel-smoke-check-in:${randomUUID()}`,
  },
  method: "POST",
});
assert(stay.id, "Check-in response did not include a stay id.");
printStep(`checked in stay ${stay.id}`);

const restaurant = await api("/restaurants", {
  body: JSON.stringify({
    name: `${prefix} Restaurant`,
    propertyId: property.id,
    serviceStyle: "smoke-test",
  }),
  method: "POST",
});
assert(restaurant.id, "Restaurant response did not include an id.");
printStep(`created restaurant ${restaurant.id}`);

const menuItem = await api(`/restaurants/${restaurant.id}/menu-items`, {
  body: JSON.stringify({
    kitchenStation: "main_kitchen",
    name: `${prefix} Room Charge Item`,
    price: 12.76,
  }),
  method: "POST",
});
assert(menuItem.id, "Menu item response did not include an id.");
printStep(`created menu item ${menuItem.id}`);

const order = await api(`/restaurants/${restaurant.id}/orders`, {
  body: JSON.stringify({
    items: [{ menuItemId: menuItem.id, quantity: 1 }],
    notes: "Hotel smoke room-charge order",
  }),
  headers: {
    "Idempotency-Key": randomUUID(),
  },
  method: "POST",
});
assert(order.id, "Order response did not include an id.");
assert(
  Number(order.totalAmount) > 0,
  "Order total should be greater than zero.",
);
printStep(`created restaurant order ${order.id}`);

const charge = await api(`/folios/${stay.id}/charges`, {
  body: JSON.stringify({
    amount: Number(order.totalAmount),
    description: `Smoke room charge for order ${order.id}`,
    orderId: order.id,
    restaurantId: restaurant.id,
  }),
  method: "POST",
});
assert(charge.status === "posted", "Room charge was not posted.");
printStep(`posted room charge ${charge.chargeId}`);

let checkoutWarning = null;

try {
  await api(`/properties/${property.id}/rooms/${room.id}/check-out`, {
    headers: {
      "Idempotency-Key": `hotel-smoke-check-out:${randomUUID()}`,
    },
    method: "POST",
  });
} catch (error) {
  if (
    error.status === 400 &&
    String(error.message).includes("Review 1 posted")
  ) {
    checkoutWarning = error;
  } else {
    throw error;
  }
}

assert(checkoutWarning, "Checkout should require room-charge acknowledgement.");
printStep("checkout correctly required room-charge acknowledgement");

const checkout = await api(
  `/properties/${property.id}/rooms/${room.id}/check-out`,
  {
    body: JSON.stringify({ acknowledgeRestaurantCharges: true }),
    headers: {
      "Idempotency-Key": `hotel-smoke-check-out-confirmed:${randomUUID()}`,
    },
    method: "POST",
  },
);
assert(checkout.status === "checked_out", "Stay was not checked out.");
printStep(`checked out stay ${checkout.id}`);

const properties = await api("/properties");
const smokeProperty = properties.properties?.find(
  (candidate) => candidate.id === property.id,
);
const smokeRoom = smokeProperty?.rooms?.find(
  (candidate) => candidate.id === room.id,
);
assert(
  smokeRoom?.status === "cleaning",
  "Room should be cleaning after checkout.",
);
assert(
  !smokeRoom.activeStay,
  "Checked-out room should not show an active stay.",
);

printStep("passed");
