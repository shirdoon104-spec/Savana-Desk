"use client";

import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldCheck,
  BarChart3,
  Trash2,
  Users,
  Utensils,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  countQueuedRestaurantActions,
  enqueueRestaurantAction,
  listQueuedRestaurantActions,
  markRestaurantActionsFailed,
  markRestaurantActionsSynced,
  markRestaurantActionsTerminal,
} from "./offline-actions";

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
  assignableWaiters: Array<{
    clerkUserId: string;
    email: string | null;
    name: string;
    role: string;
  }>;
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
        course?: number;
        menuItemId: string | null;
        name: string;
        notes: string | null;
        quantity: number;
        status?: string;
        totalPrice: number;
        unitPrice: number;
      }>;
      notes: string | null;
      paidAmount: number;
      paymentStatus: string;
      status: string;
      tableId: string | null;
      totalAmount: number;
    }>;
    menuCategories: Array<{
      id: string;
      items: Array<{
        allergens: string[];
        categoryId: string | null;
          currency: string;
          currentStock: number | null;
          dietary: string[];
          description: string | null;
          id: string;
          imageUrl: string | null;
          isAvailable: boolean;
          name: string;
          price: number;
          stockEnabled: boolean;
      }>;
      name: string;
    }>;
    menuItems: Array<{
      allergens: string[];
      categoryId: string | null;
      currency: string;
      currentStock: number | null;
      dietary: string[];
      description: string | null;
      id: string;
      imageUrl: string | null;
      isAvailable: boolean;
      name: string;
      price: number;
      stockEnabled: boolean;
    }>;
    property: {
      id: string;
      name: string;
    };
    reservations: Array<{
      createdAt: string;
      guestName: string;
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
      notes: string | null;
      partySize: number;
      scheduledAt: string;
      status: string;
      suggestedTables: Array<{
        coverCount: number;
        id: string;
        name: string;
        status: string;
      }>;
      tableId: string | null;
    }>;
    serviceStyle: string | null;
    tables: Array<{
      assignedWaiterName: string | null;
      assignedWaiterUserId: string | null;
      coverCount: number;
      id: string;
      name: string;
      qrCode: string | null;
      status: string;
    }>;
  }>;
}

interface PaymentInitiationResponse {
  raw?: {
    authorization_url?: string;
  };
  status: string;
}

interface SplitOrderPreview {
  currency: string;
  mode: "equal" | "items";
  orderId: string;
  outstandingAmount: number;
  splitCount?: number;
  splits: Array<{
    amount: number;
    itemIds?: string[];
    label: string;
  }>;
  totalSplitAmount: number;
}

interface ActiveStayOption {
  checkoutDate: string | null;
  folioId: string;
  guestName: string;
  outstandingBalance: string;
  roomNumber: string;
  stayId: string;
}

interface OfflineConflictAction {
  actionType: string;
  actorUserId: string;
  conflictReason: string | null;
  createdAt: string;
  deviceId: string;
  entityId: string | null;
  entityType: string;
  id: string;
  lastError: string | null;
  occurredAt: string;
  payload: unknown;
  propertyId: string;
  restaurantId: string | null;
  retryCount: number;
  status: string;
  updatedAt: string;
}

interface FrontOfHouseNotification {
  course?: number;
  id: string;
  message: string;
  orderId: string;
  receivedAt: string;
  tableId: string | null;
  tableName: string;
  type: "course_ready" | "order_alert";
}

interface LiveDashboardResponse {
  generatedAt: string;
  kds: {
    averagePrepMinutesByCourse: Array<{
      averageMinutes: string;
      course: number;
      sampleSize: number;
    }>;
    stationQueueDepth: Array<{
      preparing: number;
      ready: number;
      sent: number;
      station: string;
      total: number;
    }>;
  };
  openOrders: {
    count: number;
    outstandingValue: string;
    paidValue: string;
    totalValue: string;
  };
  roomCharges: {
    confirmedPosted: Array<{
      amount: string;
      currency: string;
      method: string;
    }>;
  };
  tables: {
    activeTableCount: number;
    coversInHouse: number;
  };
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

function isCompletedOrder(status: string) {
  return ["closed", "cancelled"].includes(status);
}

function isGuestQrOrder(
  order: RestaurantResponse["restaurants"][number]["orders"][number],
) {
  return order.status === "draft" && order.notes?.startsWith("QR guest");
}

function isKitchenReadyItem(item: {
  status?: string;
}) {
  return item.status === "ready";
}

function formatElapsedTime(startedAt: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000),
  );
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function summarizeOfflinePayload(action: OfflineConflictAction) {
  if (!action.payload || typeof action.payload !== "object" || Array.isArray(action.payload)) {
    return action.entityId ? `Entity ${action.entityId}` : "No structured payload";
  }

  const payload = action.payload as {
    amount?: unknown;
    items?: unknown;
    orderId?: unknown;
    tableId?: unknown;
  };

  if (typeof payload.orderId === "string" && typeof payload.amount === "number") {
    return `Order ${payload.orderId} for ${payload.amount.toFixed(2)}`;
  }

  if (typeof payload.orderId === "string" && typeof payload.tableId === "string") {
    return `Order ${payload.orderId} to table ${payload.tableId}`;
  }

  if (Array.isArray(payload.items)) {
    return `${payload.items.length} item${payload.items.length === 1 ? "" : "s"}`;
  }

  return typeof payload.orderId === "string" ? `Order ${payload.orderId}` : "Review payload";
}

const paymentMethods = [
  { id: "paystack", label: "Paystack" },
  { id: "cash", label: "Cash" },
  { id: "card_manual", label: "Card" },
  { id: "room_charge", label: "Room" },
  { id: "voucher", label: "Voucher" },
  { id: "complimentary", label: "Comp" },
];

const managerActions = [
  { id: "discount", label: "Discount" },
  { id: "void_item", label: "Void item" },
  { id: "transfer", label: "Transfer" },
  { id: "cancel", label: "Cancel" },
  { id: "reprint", label: "Reprint" },
];

const allergenOptions = ["nuts", "gluten", "dairy", "eggs", "shellfish", "soy"];
const dietaryOptions = ["vegan", "vegetarian", "halal", "kosher", "gluten_free"];
const reservationStatuses = ["confirmed", "waitlisted", "seated", "cancelled", "no_show"];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRestaurantDeviceId() {
  const key = "rayaan-pos-device-id";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const deviceId = crypto.randomUUID();
  window.localStorage.setItem(key, deviceId);

  return deviceId;
}

export default function RestaurantsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const { user } = useUser();
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
  const [newMenuItemAllergens, setNewMenuItemAllergens] = useState<string[]>([]);
  const [newMenuItemDietary, setNewMenuItemDietary] = useState<string[]>([]);
  const [newMenuItemImageUrl, setNewMenuItemImageUrl] = useState("");
  const [newMenuItemIsAvailable, setNewMenuItemIsAvailable] = useState(true);
  const [newMenuItemName, setNewMenuItemName] = useState("");
  const [newMenuItemPrice, setNewMenuItemPrice] = useState("");
  const [newMenuItemStock, setNewMenuItemStock] = useState("");
  const [newMenuItemStockEnabled, setNewMenuItemStockEnabled] = useState(false);
  const [reservationGuestName, setReservationGuestName] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [reservationPartySize, setReservationPartySize] = useState("2");
  const [reservationScheduledAt, setReservationScheduledAt] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [reservationStatus, setReservationStatus] = useState("confirmed");
  const [reservationTableId, setReservationTableId] = useState("");
  const [reservationItems, setReservationItems] = useState<
    Array<{ menuItemId: string; notes: string; quantity: number }>
  >([]);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [tableCoverCount, setTableCoverCount] = useState("0");
  const [tableWaiterUserId, setTableWaiterUserId] = useState("");
  const [tableStatus, setTableStatus] = useState("");
  const [orderTableId, setOrderTableId] = useState("");
  const [orderMenuItemId, setOrderMenuItemId] = useState("");
  const [orderItemNotes, setOrderItemNotes] = useState("");
  const [orderItemQuantity, setOrderItemQuantity] = useState("1");
  const [orderMenuSearch, setOrderMenuSearch] = useState("");
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState("all");
  const [orderItems, setOrderItems] = useState<
    Array<{ menuItemId: string; notes: string; quantity: number }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentDrawerOrderId, setPaymentDrawerOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentSplitMode, setPaymentSplitMode] = useState<"equal" | "items">("equal");
  const [paymentSplitCount, setPaymentSplitCount] = useState("1");
  const [paymentSplitItemIds, setPaymentSplitItemIds] = useState<string[]>([]);
  const [isPreviewingSplit, setIsPreviewingSplit] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [cashTendered, setCashTendered] = useState("");
  const [staySearch, setStaySearch] = useState("");
  const [stayOptions, setStayOptions] = useState<ActiveStayOption[]>([]);
  const [selectedFolioId, setSelectedFolioId] = useState("");
  const [managerPanelOrderId, setManagerPanelOrderId] = useState<string | null>(null);
  const [managerAction, setManagerAction] = useState("discount");
  const [managerActionError, setManagerActionError] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState("fixed");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountItemId, setDiscountItemId] = useState("");
  const [voidItemId, setVoidItemId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [transferTableId, setTransferTableId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [managerConfirmation, setManagerConfirmation] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [queuedActionCount, setQueuedActionCount] = useState(0);
  const [offlineConflicts, setOfflineConflicts] = useState<OfflineConflictAction[]>([]);
  const [reviewingConflictId, setReviewingConflictId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportKind, setReportKind] = useState<"z-report" | "shift-report">("z-report");
  const [liveDashboard, setLiveDashboard] = useState<LiveDashboardResponse | null>(null);
  const [frontOfHouseNotifications, setFrontOfHouseNotifications] = useState<
    FrontOfHouseNotification[]
  >([]);
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [orderListMode, setOrderListMode] = useState<"active" | "history">(
    "active",
  );

  const selectedRestaurant = useMemo(
    () =>
      data?.restaurants.find(
        (restaurant) => restaurant.id === selectedRestaurantId,
      ) ?? data?.restaurants[0],
    [data?.restaurants, selectedRestaurantId],
  );

  function toggleNewMenuFlag(kind: "allergens" | "dietary", value: string) {
    const setter =
      kind === "allergens" ? setNewMenuItemAllergens : setNewMenuItemDietary;

    setter((current) =>
      current.includes(value)
        ? current.filter((candidate) => candidate !== value)
        : [...current, value],
    );
  }

  function addReservationItem(menuItemId: string) {
    setReservationItems((current) => {
      const existing = current.find((item) => item.menuItemId === menuItemId);

      if (existing) {
        return current.map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { menuItemId, notes: "", quantity: 1 }];
    });
  }

  function updateReservationItemQuantity(index: number, quantity: number) {
    setReservationItems((current) =>
      current
        .map((item, itemIndex) =>
          itemIndex === index ? { ...item, quantity } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  const reportQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (reportDate) {
      params.set("date", reportDate);
    }

    if (selectedRestaurant?.property.id) {
      params.set("propertyId", selectedRestaurant.property.id);
    }

    if (selectedRestaurant?.id) {
      params.set("restaurantId", selectedRestaurant.id);
    }

    return params.toString();
  }, [reportDate, selectedRestaurant?.id, selectedRestaurant?.property.id]);

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

  const selectedTable = useMemo(
    () =>
      selectedRestaurant?.tables.find((table) => table.id === selectedTableId) ??
      selectedRestaurant?.tables[0] ??
      null,
    [selectedRestaurant?.tables, selectedTableId],
  );

  const activeTableOrder = useMemo(() => {
    if (!selectedTable) {
      return null;
    }

    return (
      (ordersByTable.get(selectedTable.id) ?? []).find(
        (order) => !isCompletedOrder(order.status),
      ) ?? null
    );
  }, [ordersByTable, selectedTable]);

  const seatedTablesCount = useMemo(
    () =>
      selectedRestaurant?.tables.filter((table) =>
        ["reserved", "seated", "ordering", "served"].includes(table.status),
      ).length ?? 0,
    [selectedRestaurant?.tables],
  );

  const coverCount = useMemo(
    () =>
      selectedRestaurant?.tables.reduce(
        (total, table) => total + table.coverCount,
        0,
      ) ?? 0,
    [selectedRestaurant?.tables],
  );
  const activeOrders = useMemo(
    () =>
      (selectedRestaurant?.orders ?? []).filter(
        (order) => !isCompletedOrder(order.status),
      ),
    [selectedRestaurant?.orders],
  );
  const upcomingReservations = useMemo(
    () =>
      (selectedRestaurant?.reservations ?? []).filter(
        (reservation) => !["cancelled", "no_show"].includes(reservation.status),
      ),
    [selectedRestaurant?.reservations],
  );
  const completedOrders = useMemo(
    () =>
      (selectedRestaurant?.orders ?? []).filter((order) =>
        isCompletedOrder(order.status),
      ),
    [selectedRestaurant?.orders],
  );

  const managerPanelOrder = useMemo(
    () =>
      (selectedRestaurant?.orders ?? []).find(
        (order) => order.id === managerPanelOrderId,
      ) ?? null,
    [managerPanelOrderId, selectedRestaurant?.orders],
  );

  const paymentDrawerOrder = useMemo(
    () =>
      activeOrders.find((order) => order.id === paymentDrawerOrderId) ?? null,
    [activeOrders, paymentDrawerOrderId],
  );

  const paymentOutstanding = useMemo(() => {
    if (!paymentDrawerOrder) {
      return 0;
    }

    return Math.max(
      0,
      paymentDrawerOrder.totalAmount - (paymentDrawerOrder.paidAmount ?? 0),
    );
  }, [paymentDrawerOrder]);

  const paymentDrawerTableName = useMemo(() => {
    if (!paymentDrawerOrder) {
      return "";
    }

    return paymentDrawerOrder.tableId
      ? selectedRestaurant?.tables.find(
          (table) => table.id === paymentDrawerOrder.tableId,
        )?.name ?? "Table"
      : "Counter / takeaway";
  }, [paymentDrawerOrder, selectedRestaurant?.tables]);

  const cashChange = useMemo(() => {
    const tendered = Number(cashTendered) || 0;
    const amount = Number(paymentAmount) || paymentOutstanding;

    return Math.max(0, tendered - amount);
  }, [cashTendered, paymentAmount, paymentOutstanding]);

  const splitAmount = useMemo(() => {
    const count = Math.max(1, Number(paymentSplitCount) || 1);

    return paymentOutstanding > 0 ? paymentOutstanding / count : 0;
  }, [paymentOutstanding, paymentSplitCount]);

  const itemSplitAmount = useMemo(() => {
    if (!paymentDrawerOrder) {
      return 0;
    }

    return paymentDrawerOrder.items
      .filter((item) => paymentSplitItemIds.includes(item.id))
      .reduce((total, item) => total + item.totalPrice, 0);
  }, [paymentDrawerOrder, paymentSplitItemIds]);

  const transferTableOptions = useMemo(
    () =>
      selectedRestaurant?.tables.filter(
        (table) =>
          table.id !== managerPanelOrder?.tableId &&
          !["seated", "ordering", "served"].includes(table.status),
      ) ?? [],
    [managerPanelOrder?.tableId, selectedRestaurant?.tables],
  );

  const orderTotal = useMemo(() => {
    return orderItems.reduce((total, item) => {
      const menuItem = selectedRestaurant?.menuItems.find(
        (candidate) => candidate.id === item.menuItemId,
      );

      return total + (menuItem?.price ?? 0) * item.quantity;
    }, 0);
  }, [orderItems, selectedRestaurant?.menuItems]);

  const filteredMenuItems = useMemo(() => {
    const search = orderMenuSearch.trim().toLowerCase();

    return (selectedRestaurant?.menuItems ?? []).filter((item) => {
      const matchesCategory =
        selectedMenuCategoryId === "all" ||
        (selectedMenuCategoryId === "uncategorized" && !item.categoryId) ||
        item.categoryId === selectedMenuCategoryId;
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [orderMenuSearch, selectedMenuCategoryId, selectedRestaurant?.menuItems]);

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

  async function loadOfflineConflicts() {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sync/conflicts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { actions?: OfflineConflictAction[] };
    setOfflineConflicts(payload.actions ?? []);
  }

  async function markOfflineConflictReviewed(actionId: string) {
    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before reviewing conflicts.");
      return;
    }

    setReviewingConflictId(actionId);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/sync/conflicts/${actionId}/resolve`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        method: "POST",
      },
    );

    setReviewingConflictId(null);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not mark conflict reviewed."));
      return;
    }

    await loadOfflineConflicts();
  }

  async function openAuthenticatedReport(format: "json" | "csv") {
    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before opening reports.");
      return;
    }

    const basePath =
      reportKind === "shift-report"
        ? "reports/restaurant-shift-report"
        : "reports/restaurant-z-report";
    const path = format === "csv" ? `${basePath}.csv` : basePath;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/${path}?${reportQuery}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not open restaurant report."));
      return;
    }

    const blob =
      format === "csv"
        ? await response.blob()
        : new Blob([JSON.stringify(await response.json(), null, 2)], {
            type: "application/json",
          });
    const url = URL.createObjectURL(blob);

    if (format === "csv") {
      const link = document.createElement("a");
      link.href = url;
      link.download = `restaurant-${reportKind}-${reportDate || "today"}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function loadLiveDashboard() {
    if (!isLoaded || !isSignedIn || !selectedRestaurant) {
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      return;
    }

    const params = new URLSearchParams();
    params.set("propertyId", selectedRestaurant.property.id);
    params.set("restaurantId", selectedRestaurant.id);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/reports/restaurant-live-dashboard?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      return;
    }

    setLiveDashboard((await response.json()) as LiveDashboardResponse);
  }

  function appendFrontOfHouseNotification(
    type: FrontOfHouseNotification["type"],
    eventData: {
      course?: number;
      message?: string;
      orderId?: string;
      tableId?: string | null;
    },
  ) {
    if (!selectedRestaurant || !eventData.orderId || !data) {
      return;
    }

    const table = eventData.tableId
      ? selectedRestaurant.tables.find((candidate) => candidate.id === eventData.tableId)
      : null;

    if (
      !data.canManageRestaurant &&
      table?.assignedWaiterUserId &&
      table.assignedWaiterUserId !== data.currentUser.clerkUserId
    ) {
      return;
    }

    const tableName = table?.name ?? "Counter / takeaway";
    const message =
      eventData.message ??
      (type === "course_ready"
        ? `Course ${eventData.course ?? ""} is ready for service.`
        : "Kitchen needs front-of-house attention.");
    const orderId = eventData.orderId;

    setFrontOfHouseNotifications((current) => {
      const id = `${type}:${orderId}:${eventData.tableId ?? "counter"}:${
        eventData.course ?? "item"
      }:${eventData.message ?? ""}`;
      if (current.some((notification) => notification.id === id)) {
        return current;
      }

      showBrowserServiceNotification(id, tableName, message);

      const nextNotification = {
        course: eventData.course,
        id,
        message,
        orderId,
        receivedAt: new Date().toISOString(),
        tableId: eventData.tableId ?? null,
        tableName,
        type,
      };
      const withoutDuplicate = current.filter(
        (notification) => notification.id !== id,
      );

      return [nextNotification, ...withoutDuplicate].slice(0, 8);
    });
  }

  function showBrowserServiceNotification(
    id: string,
    tableName: string,
    message: string,
  ) {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      browserNotificationPermission !== "granted"
    ) {
      return;
    }

    new Notification("Kitchen service alert", {
      body: `${tableName}: ${message}`,
      tag: id,
    });
  }

  async function requestBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserNotificationPermission(permission);
  }

  async function flushQueuedRestaurantActions() {
    if (!isLoaded || !isSignedIn || typeof navigator === "undefined" || !navigator.onLine) {
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      return;
    }

    const queuedActions = await listQueuedRestaurantActions();

    if (!queuedActions.length) {
      setQueuedActionCount(0);
      return;
    }

    const batch = queuedActions.slice(0, 100);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sync/actions`, {
        body: JSON.stringify(batch),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        await markRestaurantActionsFailed(batch.map((action) => action.id));
        setQueuedActionCount(await countQueuedRestaurantActions());
        return;
      }

      const payload = (await response.json()) as {
        accepted?: Array<{ id: string; message?: string; status: string }>;
      };
      const syncedIds =
        payload.accepted
          ?.filter((action) => action.status === "synced")
          .map((action) => action.id) ?? [];
      const failedIds =
        payload.accepted
          ?.filter((action) => action.status === "failed")
          .map((action) => action.id) ?? [];
      const terminalActions =
        payload.accepted
          ?.filter(
            (
              action,
            ): action is {
              id: string;
              message?: string;
              status: "conflicted" | "rejected";
            } => action.status === "conflicted" || action.status === "rejected",
          )
          .map((action) => ({
            id: action.id,
            message: action.message,
            status: action.status,
          })) ?? [];

      if (syncedIds.length) {
        await markRestaurantActionsSynced(syncedIds);
      }

      if (failedIds.length) {
        await markRestaurantActionsFailed(failedIds);
      }

      if (terminalActions.length) {
        await markRestaurantActionsTerminal(terminalActions);
        setError(
          `${terminalActions.length} offline action${
            terminalActions.length === 1 ? "" : "s"
          } need manager review.`,
        );
        await loadOfflineConflicts();
      }

      setQueuedActionCount(await countQueuedRestaurantActions());
      await loadRestaurants();
    } catch {
      await markRestaurantActionsFailed(batch.map((action) => action.id));
      setQueuedActionCount(await countQueuedRestaurantActions());
    }
  }

  useEffect(() => {
    void loadRestaurants();
  }, [getToken, isLoaded, isSignedIn, organization]);

  useEffect(() => {
    if (data?.canManageRestaurant) {
      void loadOfflineConflicts();
      void loadLiveDashboard();
    } else {
      setOfflineConflicts([]);
      setLiveDashboard(null);
    }
  }, [
    data?.canManageRestaurant,
    getToken,
    isLoaded,
    isSignedIn,
    organization,
    selectedRestaurant?.id,
  ]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !selectedRestaurant) {
      setFrontOfHouseNotifications([]);
      return;
    }

    let isClosed = false;
    let source: EventSource | null = null;
    const eventNames: FrontOfHouseNotification["type"][] = [
      "course_ready",
      "order_alert",
    ];

    void getOrganizationToken().then((token) => {
      if (!token || isClosed) {
        return;
      }

      source = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL}/events/kitchen/${
          selectedRestaurant.id
        }?access_token=${encodeURIComponent(token)}`,
      );

      for (const eventName of eventNames) {
        source.addEventListener(eventName, (event) => {
          try {
            appendFrontOfHouseNotification(
              eventName,
              JSON.parse((event as MessageEvent).data) as {
                course?: number;
                message?: string;
                orderId?: string;
                tableId?: string | null;
              },
            );
            void loadRestaurants();
          } catch {
            // Ignore malformed SSE payloads; the next poll/load will restore state.
          }
        });
      }
    });

    return () => {
      isClosed = true;
      source?.close();
    };
  }, [
    data?.canManageRestaurant,
    data?.currentUser.clerkUserId,
    getToken,
    isLoaded,
    isSignedIn,
    organization,
    selectedRestaurant?.id,
    selectedRestaurant?.tables,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setBrowserNotificationPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );

    const refreshQueueCount = () => {
      void countQueuedRestaurantActions()
        .then(setQueuedActionCount)
        .catch(() => setQueuedActionCount(0));
    };
    const updateOnlineState = () => {
      setIsOnline(navigator.onLine);
      refreshQueueCount();
    };

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      void flushQueuedRestaurantActions();
    }
  }, [getToken, isLoaded, isOnline, isSignedIn, organization]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !selectedRestaurant) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      void loadRestaurants();
    }, 10000);

    return () => window.clearInterval(refreshTimer);
  }, [getToken, isLoaded, isSignedIn, organization, selectedRestaurant?.id]);

  useEffect(() => {
    if (!data || !selectedRestaurant) {
      return;
    }

    for (const order of selectedRestaurant.orders) {
      if (isCompletedOrder(order.status) || isGuestQrOrder(order)) {
        continue;
      }

      for (const item of order.items) {
        if (!isKitchenReadyItem(item)) {
          continue;
        }

        appendFrontOfHouseNotification("order_alert", {
          message: `${item.name} is ready.`,
          orderId: order.id,
          tableId: order.tableId,
        });
      }
    }
  }, [
    data?.canManageRestaurant,
    data?.currentUser.clerkUserId,
    selectedRestaurant?.id,
    selectedRestaurant?.orders,
    selectedRestaurant?.tables,
  ]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedTableId("");
      setTableCoverCount("0");
      setTableWaiterUserId("");
      setTableStatus("");
      return;
    }

    setSelectedTableId((current) => current || selectedTable.id);
    setTableCoverCount(String(selectedTable.coverCount));
    setTableWaiterUserId(selectedTable.assignedWaiterUserId ?? "");
    setTableStatus(selectedTable.status);
  }, [selectedTable]);

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
          allergens: newMenuItemAllergens,
          categoryId: newMenuItemCategoryId || undefined,
          dietary: newMenuItemDietary,
          description: newMenuItemDescription || undefined,
          imageUrl: newMenuItemImageUrl || undefined,
          isAvailable: newMenuItemIsAvailable,
          name: newMenuItemName,
          price: Number(newMenuItemPrice),
          stockEnabled: newMenuItemStockEnabled,
          currentStock: newMenuItemStockEnabled
            ? Number(newMenuItemStock) || 0
            : undefined,
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
    setNewMenuItemAllergens([]);
    setNewMenuItemDietary([]);
    setNewMenuItemImageUrl("");
    setNewMenuItemIsAvailable(true);
    setNewMenuItemName("");
    setNewMenuItemPrice("");
    setNewMenuItemStock("");
    setNewMenuItemStockEnabled(false);
    await loadRestaurants();
  }

  async function updateMenuItemStock(
    menuItemId: string,
    body: {
      currentStock?: number;
      isAvailable?: boolean;
      stockEnabled?: boolean;
    },
  ) {
    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before updating menu stock.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/menu-items/${menuItemId}/stock`,
      {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update menu stock."));
      return;
    }

    await loadRestaurants();
  }

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before creating reservations.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/reservations`,
      {
        body: JSON.stringify({
          guestName: reservationGuestName,
          notes: reservationNotes || undefined,
          items: reservationItems,
          partySize: Number(reservationPartySize),
          scheduledAt: new Date(reservationScheduledAt).toISOString(),
          status: reservationStatus,
          tableId: reservationTableId || undefined,
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
      setError(await readApiMessage(response, "Could not create reservation."));
      return;
    }

    setReservationGuestName("");
    setReservationNotes("");
    setReservationPartySize("2");
    setReservationStatus("confirmed");
    setReservationTableId("");
    setReservationItems([]);
    setIsReservationModalOpen(false);
    await loadRestaurants();
  }

  async function updateReservation(
    reservationId: string,
    body: Record<string, unknown>,
  ) {
    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;

    if (!token || !restaurantId) {
      setError("Choose a restaurant before updating reservations.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/reservations/${reservationId}`,
      {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update reservation."));
      return;
    }

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
          "Idempotency-Key": crypto.randomUUID(),
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

  async function updateTableDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = await getOrganizationToken();
    const restaurantId = selectedRestaurant?.id;
    const tableId = selectedTable?.id;

    if (!token || !restaurantId || !tableId) {
      setError("Choose a table before updating table service details.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/tables/${tableId}`,
      {
        body: JSON.stringify({
          assignedWaiterUserId: tableWaiterUserId,
          coverCount: Number(tableCoverCount) || 0,
          status: tableStatus,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update table details."));
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

    if (!token || !restaurantId || !data || !selectedRestaurant) {
      setError("Choose a restaurant before creating an order.");
      setIsSubmitting(false);
      return;
    }

    if (!orderItems.length) {
      setError("Add at least one menu item before sending the order.");
      setIsSubmitting(false);
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const payload = {
      idempotencyKey,
      items: orderItems,
      tableId: orderTableId || undefined,
    };

    if (!isOnline) {
      await enqueueRestaurantAction({
        actionType: "order.create",
        actorUserId: data.currentUser.clerkUserId,
        createdAt: new Date().toISOString(),
        deviceId: getRestaurantDeviceId(),
        entityType: "order",
        id: crypto.randomUUID(),
        idempotencyKey,
        occurredAt: new Date().toISOString(),
        payload,
        propertyId: selectedRestaurant.property.id,
        restaurantId,
        retryCount: 0,
        status: "queued",
        tenantId: data.tenant.id,
      });
      setQueuedActionCount(await countQueuedRestaurantActions());
      setOrderItems([]);
      setOrderTableId("");
      setIsSubmitting(false);
      setError("Offline order queued. It will sync when the connection is restored.");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${restaurantId}/orders`,
        {
          body: JSON.stringify(payload),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          method: "POST",
        },
      );

      setIsSubmitting(false);

      if (!response.ok) {
        setError(await readApiMessage(response, "Could not create order."));
        return;
      }
    } catch {
      await enqueueRestaurantAction({
        actionType: "order.create",
        actorUserId: data.currentUser.clerkUserId,
        createdAt: new Date().toISOString(),
        deviceId: getRestaurantDeviceId(),
        entityType: "order",
        id: crypto.randomUUID(),
        idempotencyKey,
        occurredAt: new Date().toISOString(),
        payload,
        propertyId: selectedRestaurant.property.id,
        restaurantId,
        retryCount: 0,
        status: "queued",
        tenantId: data.tenant.id,
      });
      setQueuedActionCount(await countQueuedRestaurantActions());
      setOrderItems([]);
      setOrderTableId("");
      setIsSubmitting(false);
      setError("Network dropped. Order queued locally for sync.");
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

    const menuItem = selectedRestaurant?.menuItems.find(
      (item) => item.id === orderMenuItemId,
    );

    if (!menuItem?.isAvailable) {
      setError("That menu item is currently unavailable.");
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

  function addMenuItemToDraft(menuItemId: string) {
    const menuItem = selectedRestaurant?.menuItems.find(
      (item) => item.id === menuItemId,
    );

    if (!menuItem?.isAvailable) {
      setError("That menu item is currently unavailable.");
      return;
    }

    setOrderItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.menuItemId === menuItemId && !item.notes,
      );

      if (existingIndex === -1) {
        return [...current, { menuItemId, notes: "", quantity: 1 }];
      }

      return current.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  }

  function updateDraftItemQuantity(index: number, quantity: number) {
    if (quantity < 1) {
      return;
    }

    setOrderItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity } : item,
      ),
    );
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

  async function payOrderWithPaystack(
    order: RestaurantResponse["restaurants"][number]["orders"][number],
  ) {
    const token = await getOrganizationToken();

    if (!token || !data || !selectedRestaurant) {
      setError("Choose a restaurant before taking payment.");
      return;
    }

    setPayingOrderId(order.id);
    setError(null);
    setPaymentError(null);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/initiate`, {
      body: JSON.stringify({
        amount: order.totalAmount,
        currency: order.currency,
        customerEmail:
          user?.primaryEmailAddress?.emailAddress ??
          `guest-${data.tenant.id}@rayaan.local`,
        description: `Restaurant order ${order.id}`,
        idempotencyKey: `paystack-${order.id}`,
        orderId: order.id,
        propertyId: selectedRestaurant.property.id,
        provider: "paystack",
        restaurantId: selectedRestaurant.id,
        tenantId: data.tenant.id,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    setPayingOrderId(null);

    if (!response.ok) {
      const message = await readApiMessage(
        response,
        "Could not start Paystack checkout.",
      );
      setError(message);
      setPaymentError(message);
      return;
    }

    const payment = (await response.json()) as PaymentInitiationResponse;
    const checkoutUrl = payment.raw?.authorization_url;

    if (!checkoutUrl) {
      const message = "Paystack checkout URL was not returned.";
      setError(message);
      setPaymentError(message);
      return;
    }

    window.location.href = checkoutUrl;
  }

  function openPaymentDrawer(
    order: RestaurantResponse["restaurants"][number]["orders"][number],
  ) {
    const outstanding = Math.max(0, order.totalAmount - (order.paidAmount ?? 0));

    setPaymentDrawerOrderId(order.id);
    setPaymentMethod("paystack");
    setPaymentAmount(outstanding.toFixed(2));
    setPaymentSplitMode("equal");
    setPaymentSplitCount("2");
    setPaymentSplitItemIds([]);
    setIsPreviewingSplit(false);
    setPaymentReference("");
    setCashTendered("");
    setStaySearch("");
    setStayOptions([]);
    setSelectedFolioId("");
    setPaymentError(null);
  }

  async function previewOrderSplit(body: {
    itemIds?: string[];
    mode: "equal" | "items";
    splitCount?: number;
  }) {
    if (!selectedRestaurant || !paymentDrawerOrder) {
      throw new Error("Choose an open order before splitting payment.");
    }

    const token = await getOrganizationToken();

    if (!token) {
      throw new Error("Select or create a workspace organization before splitting payment.");
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${selectedRestaurant.id}/orders/${paymentDrawerOrder.id}/split`,
      {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(await readApiMessage(response, "Could not preview split bill."));
    }

    return (await response.json()) as SplitOrderPreview;
  }

  async function applyEqualSplit() {
    const splitCount = Number(paymentSplitCount);

    if (!Number.isInteger(splitCount) || splitCount < 2) {
      setPaymentError("Equal split requires at least 2 guests.");
      return;
    }

    setIsPreviewingSplit(true);
    setPaymentError(null);

    try {
      const preview = await previewOrderSplit({
        mode: "equal",
        splitCount,
      });
      setPaymentAmount((preview.splits[0]?.amount ?? 0).toFixed(2));
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Could not preview split bill.");
    } finally {
      setIsPreviewingSplit(false);
    }
  }

  function toggleSplitItem(itemId: string) {
    setPaymentSplitItemIds((current) =>
      current.includes(itemId)
        ? current.filter((candidate) => candidate !== itemId)
        : [...current, itemId],
    );
    setPaymentError(null);
  }

  async function applyItemSplit() {
    if (itemSplitAmount <= 0) {
      setPaymentError("Choose at least one item for item split.");
      return;
    }

    setIsPreviewingSplit(true);
    setPaymentError(null);

    try {
      const preview = await previewOrderSplit({
        itemIds: paymentSplitItemIds,
        mode: "items",
      });
      setPaymentAmount((preview.splits[0]?.amount ?? 0).toFixed(2));
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Could not preview split bill.");
    } finally {
      setIsPreviewingSplit(false);
    }
  }

  function openManagerPanel(
    order: RestaurantResponse["restaurants"][number]["orders"][number],
  ) {
    const firstItem = order.items.find((item) => item.status !== "voided");

    setManagerPanelOrderId(order.id);
    setManagerAction(isCompletedOrder(order.status) ? "reprint" : "discount");
    setManagerActionError(null);
    setDiscountType("fixed");
    setDiscountAmount("");
    setDiscountLabel("");
    setDiscountItemId(firstItem?.id ?? "");
    setVoidItemId(firstItem?.id ?? "");
    setVoidReason("");
    setTransferTableId("");
    setCancelReason("");
    setManagerConfirmation("");
  }

  function closeManagerPanel() {
    setManagerPanelOrderId(null);
    setManagerActionError(null);
    setManagerConfirmation("");
  }

  async function queueOfflineManagerAction(
    actionType: "order.item.void" | "order.table.transfer",
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (!data || !selectedRestaurant || !managerPanelOrder) {
      setManagerActionError("Choose an order before queuing manager actions.");
      return;
    }

    const now = new Date().toISOString();

    await enqueueRestaurantAction({
      actionType,
      actorUserId: data.currentUser.clerkUserId,
      createdAt: now,
      deviceId: getRestaurantDeviceId(),
      entityId: managerPanelOrder.id,
      entityType: "order",
      id: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      occurredAt: now,
      payload,
      propertyId: selectedRestaurant.property.id,
      restaurantId: selectedRestaurant.id,
      retryCount: 0,
      status: "queued",
      tenantId: data.tenant.id,
    });

    setQueuedActionCount(await countQueuedRestaurantActions());
    closeManagerPanel();
    setError(message);
  }

  async function queueOfflinePayment(
    order: RestaurantResponse["restaurants"][number]["orders"][number],
    payload: {
      amount: number;
      method: string;
      orderId: string;
      reference?: string;
    },
    message: string,
  ) {
    if (!data || !selectedRestaurant) {
      setPaymentError("Choose an order before queuing payments.");
      return;
    }

    const now = new Date().toISOString();

    await enqueueRestaurantAction({
      actionType: "order.payment.record",
      actorUserId: data.currentUser.clerkUserId,
      createdAt: now,
      deviceId: getRestaurantDeviceId(),
      entityId: order.id,
      entityType: "payment",
      id: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      occurredAt: now,
      payload,
      propertyId: selectedRestaurant.property.id,
      restaurantId: selectedRestaurant.id,
      retryCount: 0,
      status: "queued",
      tenantId: data.tenant.id,
    });

    setQueuedActionCount(await countQueuedRestaurantActions());
    setPayingOrderId(null);
    setPaymentDrawerOrderId(null);
    setPaymentError(null);
    setError(message);
  }

  async function searchActiveStays() {
    const token = await getOrganizationToken();

    if (!token) {
      setPaymentError("Select or create a workspace organization before searching stays.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/stays/active?search=${encodeURIComponent(staySearch)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      setPaymentError(await readApiMessage(response, "Could not search active stays."));
      return;
    }

    setStayOptions((await response.json()) as ActiveStayOption[]);
  }

  async function recordManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paymentDrawerOrder || !selectedRestaurant) {
      return;
    }

    const amount = Number(paymentAmount) || paymentOutstanding;

    if (amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    const paymentPayload = {
      amount,
      method: paymentMethod,
      orderId: paymentDrawerOrder.id,
      reference: paymentReference || undefined,
    };

    if (!isOnline) {
      await queueOfflinePayment(
        paymentDrawerOrder,
        paymentPayload,
        "Offline payment queued. It will sync when the connection is restored.",
      );
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      setPaymentError("Select or create a workspace organization before taking payment.");
      return;
    }

    setPayingOrderId(paymentDrawerOrder.id);
    setPaymentError(null);

    let updatedOrder: RestaurantResponse["restaurants"][number]["orders"][number];

    try {
      const paymentRequestBody = {
        amount: paymentPayload.amount,
        method: paymentPayload.method,
        reference: paymentPayload.reference,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${selectedRestaurant.id}/orders/${paymentDrawerOrder.id}/pay`,
        {
          body: JSON.stringify(paymentRequestBody),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          method: "POST",
        },
      );

      setPayingOrderId(null);

      if (!response.ok) {
        setPaymentError(await readApiMessage(response, "Could not record payment."));
        return;
      }

      updatedOrder =
        (await response.json()) as RestaurantResponse["restaurants"][number]["orders"][number];
    } catch {
      await queueOfflinePayment(
        paymentDrawerOrder,
        paymentPayload,
        "Network dropped. Payment queued locally for sync.",
      );
      return;
    }

    if (isCompletedOrder(updatedOrder.status)) {
      printReceipt(updatedOrder);
    }

    setPaymentDrawerOrderId(null);
    await loadRestaurants();
  }

  async function chargeOrderToRoom() {
    if (!paymentDrawerOrder || !selectedRestaurant || !selectedFolioId) {
      setPaymentError("Choose an active stay before charging to room.");
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      setPaymentError("Select or create a workspace organization before charging to room.");
      return;
    }

    setPayingOrderId(paymentDrawerOrder.id);
    setPaymentError(null);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/folios/${selectedFolioId}/charges`,
      {
        body: JSON.stringify({
          amount: paymentOutstanding,
          description: `Restaurant order ${paymentDrawerOrder.id}`,
          orderId: paymentDrawerOrder.id,
          restaurantId: selectedRestaurant.id,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        method: "POST",
      },
    );

    setPayingOrderId(null);

    if (!response.ok) {
      setPaymentError(await readApiMessage(response, "Could not charge order to room."));
      return;
    }

    printReceipt({
      ...paymentDrawerOrder,
      paidAmount: paymentDrawerOrder.totalAmount,
      paymentStatus: "paid",
      status: "closed",
    });

    setPaymentDrawerOrderId(null);
    await loadRestaurants();
  }

  function printReceipt(
    order: RestaurantResponse["restaurants"][number]["orders"][number],
  ) {
    const tableName = order.tableId
      ? selectedRestaurant?.tables.find((table) => table.id === order.tableId)?.name ??
        "Table"
      : "Counter / takeaway";
    const printedAt = new Date().toLocaleString();
    const rows = order.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.quantity.toString())}x ${escapeHtml(item.name)}</td>
            <td>${escapeHtml(order.currency)} ${item.totalPrice.toFixed(2)}</td>
          </tr>
        `,
      )
      .join("");
    const printWindow = window.open("", "_blank", "width=420,height=720");

    if (!printWindow) {
      setError("Allow popups to print receipts.");
      setPaymentError("Allow popups to print receipts.");
      setManagerActionError("Allow popups to reprint receipts.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Receipt ${escapeHtml(order.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1, h2, p { margin: 0; }
            header { border-bottom: 1px solid #d0d5dd; margin-bottom: 16px; padding-bottom: 12px; }
            h1 { font-size: 20px; }
            table { border-collapse: collapse; margin: 16px 0; width: 100%; }
            td { border-bottom: 1px solid #eaecf0; padding: 8px 0; }
            td:last-child { text-align: right; }
            .total { display: flex; font-size: 18px; font-weight: 700; justify-content: space-between; }
            .muted { color: #667085; font-size: 12px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <header>
            <h1>${escapeHtml(selectedRestaurant?.name ?? "Restaurant")}</h1>
            <p>${escapeHtml(tableName)}</p>
            <p class="muted">Order ${escapeHtml(order.id)}</p>
            <p class="muted">Printed ${escapeHtml(printedAt)}</p>
          </header>
          <table><tbody>${rows}</tbody></table>
          <section class="total">
            <span>Total</span>
            <span>${escapeHtml(order.currency)} ${order.totalAmount.toFixed(2)}</span>
          </section>
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function submitManagerAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!managerPanelOrder || !selectedRestaurant) {
      return;
    }

    if (managerAction === "reprint") {
      printReceipt(managerPanelOrder);
      return;
    }

    if (managerConfirmation.trim().toUpperCase() !== "APPROVE") {
      setManagerActionError("Type APPROVE to confirm this manager action.");
      return;
    }

    let endpoint = "";
    let body: Record<string, unknown> = {};
    let offlineAction:
      | {
          actionType: "order.item.void" | "order.table.transfer";
          message: string;
          payload: Record<string, unknown>;
        }
      | null = null;

    if (managerAction === "discount") {
      const amount = Number(discountAmount);

      if (amount <= 0) {
        setManagerActionError("Enter a valid discount amount.");
        return;
      }

      endpoint = "discount";
      body = {
        amount,
        label: discountLabel || undefined,
        orderItemId: discountType === "item" ? discountItemId : undefined,
        type: discountType,
      };
    }

    if (managerAction === "void_item") {
      if (!voidItemId || voidReason.trim().length < 3) {
        setManagerActionError("Choose an item and enter a void reason.");
        return;
      }

      endpoint = `items/${voidItemId}/void`;
      body = { voidReason };
      offlineAction = {
        actionType: "order.item.void",
        message: "Offline item void queued. It will sync when the connection is restored.",
        payload: {
          itemId: voidItemId,
          orderId: managerPanelOrder.id,
          voidReason,
        },
      };
    }

    if (managerAction === "transfer") {
      if (!transferTableId) {
        setManagerActionError("Choose an available target table.");
        return;
      }

      endpoint = "transfer-table";
      body = { tableId: transferTableId };
      offlineAction = {
        actionType: "order.table.transfer",
        message: "Offline table transfer queued. It will sync when the connection is restored.",
        payload: {
          orderId: managerPanelOrder.id,
          tableId: transferTableId,
        },
      };
    }

    if (managerAction === "cancel") {
      endpoint = "cancel";
      body = { reason: cancelReason || undefined };
    }

    if (offlineAction && !isOnline) {
      await queueOfflineManagerAction(
        offlineAction.actionType,
        offlineAction.payload,
        offlineAction.message,
      );
      return;
    }

    const token = await getOrganizationToken();

    if (!token) {
      setManagerActionError("Select or create a workspace organization before manager actions.");
      return;
    }

    setIsSubmitting(true);
    setManagerActionError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/restaurants/${selectedRestaurant.id}/orders/${managerPanelOrder.id}/${endpoint}`,
        {
          body: JSON.stringify(body),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          method: "POST",
        },
      );

      setIsSubmitting(false);

      if (!response.ok) {
        setManagerActionError(
          await readApiMessage(response, "Could not complete manager action."),
        );
        return;
      }
    } catch {
      setIsSubmitting(false);

      if (offlineAction) {
        await queueOfflineManagerAction(
          offlineAction.actionType,
          offlineAction.payload,
          "Network dropped. Manager action queued locally for sync.",
        );
        return;
      }

      setManagerActionError("Network dropped before this manager action could complete.");
      return;
    }

    closeManagerPanel();
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
          <div className="offline-status-row">
            <span data-online={isOnline}>
              {isOnline ? "Online" : "Offline"}
            </span>
            <span>{queuedActionCount} queued action{queuedActionCount === 1 ? "" : "s"}</span>
            <button
              disabled={
                browserNotificationPermission === "granted" ||
                browserNotificationPermission === "unsupported"
              }
              onClick={requestBrowserNotifications}
              type="button"
            >
              <BellRing aria-hidden="true" />
              {browserNotificationPermission === "granted"
                ? "Browser alerts on"
                : browserNotificationPermission === "denied"
                  ? "Browser alerts blocked"
                  : browserNotificationPermission === "unsupported"
                    ? "Browser alerts unavailable"
                    : "Enable browser alerts"}
            </button>
          </div>
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

      {frontOfHouseNotifications.length ? (
        <section aria-live="polite" className="foh-notification-panel">
          <div className="foh-notification-header">
            <BellRing aria-hidden="true" />
            <div>
              <p className="eyebrow">Front of house</p>
              <h3>
                {frontOfHouseNotifications.length} service alert
                {frontOfHouseNotifications.length === 1 ? "" : "s"}
              </h3>
            </div>
          </div>
          <div className="foh-notification-list">
            {frontOfHouseNotifications.map((notification) => (
              <article className="foh-notification-row" key={notification.id}>
                <div>
                  <strong>{notification.tableName}</strong>
                  <span>{notification.message}</span>
                  <small>
                    {notification.type === "course_ready"
                      ? "Course ready"
                      : "Kitchen alert"}{" "}
                    - {new Date(notification.receivedAt).toLocaleTimeString()}
                  </small>
                </div>
                <button
                  aria-label={`Dismiss alert for ${notification.tableName}`}
                  onClick={() =>
                    setFrontOfHouseNotifications((current) =>
                      current.filter((candidate) => candidate.id !== notification.id),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data?.canManageRestaurant && offlineConflicts.length ? (
        <section className="offline-review-panel">
          <div className="offline-review-header">
            <AlertTriangle aria-hidden="true" />
            <div>
              <p className="eyebrow">Offline review</p>
              <h3>
                {offlineConflicts.length} action
                {offlineConflicts.length === 1 ? "" : "s"} need review
              </h3>
            </div>
          </div>
          <div className="offline-review-list">
            {offlineConflicts.map((action) => (
              <article className="offline-review-item" key={action.id}>
                <div>
                  <span>{formatLabel(action.actionType)}</span>
                  <strong>{summarizeOfflinePayload(action)}</strong>
                  <p>
                    {action.conflictReason ?? action.lastError ?? "Manual review required."}
                  </p>
                  <small>
                    {formatLabel(action.status)} - {action.retryCount} retries -{" "}
                    {new Date(action.occurredAt).toLocaleString()}
                  </small>
                </div>
                <button
                  disabled={reviewingConflictId === action.id}
                  onClick={() => void markOfflineConflictReviewed(action.id)}
                  type="button"
                >
                  <CheckCircle2 aria-hidden="true" />
                  {reviewingConflictId === action.id ? "Saving" : "Reviewed"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data?.canManageRestaurant && selectedRestaurant ? (
        <section className="restaurant-report-panel">
          <div>
            <BarChart3 aria-hidden="true" />
            <div>
              <p className="eyebrow">Reconciliation</p>
              <h3>{reportKind === "z-report" ? "End-of-day Z-report" : "Shift report"}</h3>
              <span>
                {selectedRestaurant.name} - {selectedRestaurant.property.name}
              </span>
            </div>
          </div>
          <div className="report-kind-toggle" aria-label="Choose report">
            <button
              data-selected={reportKind === "z-report"}
              onClick={() => setReportKind("z-report")}
              type="button"
            >
              Z-report
            </button>
            <button
              data-selected={reportKind === "shift-report"}
              onClick={() => setReportKind("shift-report")}
              type="button"
            >
              Shift
            </button>
          </div>
          <label>
            Business date
            <input
              onChange={(event) => setReportDate(event.target.value)}
              type="date"
              value={reportDate}
            />
          </label>
          <button
            onClick={() => void openAuthenticatedReport("json")}
            type="button"
          >
            View JSON
          </button>
          <button
            onClick={() => void openAuthenticatedReport("csv")}
            type="button"
          >
            Download CSV
          </button>
        </section>
      ) : null}

      {data?.canManageRestaurant && liveDashboard ? (
        <section className="live-dashboard-panel">
          <div className="live-dashboard-header">
            <BarChart3 aria-hidden="true" />
            <div>
              <p className="eyebrow">Live manager dashboard</p>
              <h3>Now in service</h3>
              <span>Updated {new Date(liveDashboard.generatedAt).toLocaleTimeString()}</span>
            </div>
            <button onClick={() => void loadLiveDashboard()} type="button">
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
          </div>
          <div className="live-dashboard-grid">
            <div>
              <span>Open orders</span>
              <strong>{liveDashboard.openOrders.count}</strong>
              <small>{liveDashboard.openOrders.totalValue} total value</small>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{liveDashboard.openOrders.outstandingValue}</strong>
              <small>{liveDashboard.openOrders.paidValue} paid</small>
            </div>
            <div>
              <span>Covers in-house</span>
              <strong>{liveDashboard.tables.coversInHouse}</strong>
              <small>{liveDashboard.tables.activeTableCount} active tables</small>
            </div>
            <div>
              <span>Room charges</span>
              <strong>
                {liveDashboard.roomCharges.confirmedPosted[0]?.amount ?? "0"}
              </strong>
              <small>
                {liveDashboard.roomCharges.confirmedPosted[0]?.currency ?? "posted"}
              </small>
            </div>
          </div>
          <div className="kds-depth-list">
            {liveDashboard.kds.stationQueueDepth.length ? (
              liveDashboard.kds.stationQueueDepth.map((station) => (
                <div key={station.station}>
                  <span>{formatLabel(station.station)}</span>
                  <strong>{station.total}</strong>
                  <small>
                    {station.sent} sent - {station.preparing} preparing - {station.ready} ready
                  </small>
                </div>
              ))
            ) : (
              <p>No active kitchen queue.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="status-grid property-stats">
        <div>
          <span>Restaurants</span>
          <strong>{data?.restaurants.length ?? 0}</strong>
        </div>
        <div>
          <span>Active tables</span>
          <strong>{seatedTablesCount}</strong>
        </div>
        <div>
          <span>Covers seated</span>
          <strong>{coverCount}</strong>
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
              <section className="notice-panel property-detail-card pos-floor-section">
                <div className="pos-floor-header">
                  <div>
                    <p className="eyebrow">Floor map</p>
                    <h2>{selectedRestaurant.name}</h2>
                    <p>
                      {selectedRestaurant.property.name} -{" "}
                      {selectedRestaurant.serviceStyle ?? "restaurant service"}
                    </p>
                  </div>
                  <div className="floor-status-legend" aria-label="Table status legend">
                    {["free", "reserved", "seated", "ordering", "served", "cleaning"].map(
                      (status) => (
                        <span key={status}>
                          <i data-status={status} />
                          {formatLabel(status)}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="restaurant-table-grid">
                  {selectedRestaurant.tables.map((table) => {
                    const tableOrders = ordersByTable.get(table.id) ?? [];
                    const activeOrder = tableOrders.find(
                      (order) => !isCompletedOrder(order.status),
                    );

                    return (
                      <button
                        className="restaurant-table-card"
                        data-selected={selectedTable?.id === table.id}
                        data-status={table.status}
                        key={table.id}
                        onClick={() => {
                          setSelectedTableId(table.id);
                          setOrderTableId(table.id);
                        }}
                        type="button"
                      >
                        <span className="table-card-topline">
                          <span className="table-status-label">
                            <i data-status={table.status} />
                            {formatLabel(table.status)}
                          </span>
                        </span>
                        <strong>{table.name}</strong>
                        <span className="table-card-meta">
                          <Users aria-hidden="true" />
                          {table.coverCount} covers
                        </span>
                        <span>
                          {table.assignedWaiterName
                            ? table.assignedWaiterName
                            : "No waiter assigned"}
                        </span>

                        {activeOrder ? (
                          <span className="table-order-chip">
                            <Clock3 aria-hidden="true" />
                            {formatElapsedTime(activeOrder.createdAt)}
                            <strong>
                              {activeOrder.currency} {activeOrder.totalAmount.toFixed(2)}
                            </strong>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {!selectedRestaurant.tables.length ? (
                  <div className="empty-state">No tables have been created yet.</div>
                ) : null}

                {selectedTable ? (
                  <div className="table-service-panel">
                    <div>
                      <p className="eyebrow">Order panel</p>
                      <h3>{selectedTable.name}</h3>
                      <p>
                        {activeTableOrder
                          ? `${activeTableOrder.currency} ${activeTableOrder.totalAmount.toFixed(2)} open order`
                          : "No open order on this table"}
                      </p>
                      {selectedTable.qrCode ? (
                        <a className="secondary-link" href={selectedTable.qrCode}>
                          Open QR menu
                        </a>
                      ) : null}
                    </div>
                    {activeTableOrder && isGuestQrOrder(activeTableOrder) ? (
                      <div className="guest-order-review">
                        <div>
                          <p className="eyebrow">Guest QR order</p>
                          <strong>Review before kitchen</strong>
                          <span>
                            {activeTableOrder.currency}{" "}
                            {activeTableOrder.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="guest-order-items">
                          {activeTableOrder.items.map((item) => (
                            <span key={item.id}>
                              {item.quantity}x {item.name}
                              {item.notes ? ` - ${item.notes}` : ""}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(activeTableOrder.id, "sent")}
                          type="button"
                        >
                          <CheckCircle2 aria-hidden="true" />
                          Confirm & send
                        </button>
                      </div>
                    ) : null}
                    <form className="table-service-form" onSubmit={updateTableDetails}>
                      <label>
                        Status
                        {data?.allowedTableStatuses.length ? (
                          <select
                            onChange={(event) => setTableStatus(event.target.value)}
                            value={tableStatus}
                          >
                            {data.allowedTableStatuses.includes(tableStatus)
                              ? null
                              : (
                                  <option value={tableStatus}>
                                    {formatLabel(tableStatus)}
                                  </option>
                                )}
                            {data.allowedTableStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input disabled value={formatLabel(tableStatus)} />
                        )}
                      </label>
                      <label>
                        Covers
                        <input
                          min="0"
                          onChange={(event) => setTableCoverCount(event.target.value)}
                          type="number"
                          value={tableCoverCount}
                        />
                      </label>
                      <label>
                        Waiter
                        <select
                          onChange={(event) =>
                            setTableWaiterUserId(event.target.value)
                          }
                          value={tableWaiterUserId}
                        >
                          <option value="">No waiter assigned</option>
                          {(data?.assignableWaiters ?? []).map((waiter) => (
                            <option key={waiter.clerkUserId} value={waiter.clerkUserId}>
                              {waiter.name} - {formatLabel(waiter.role)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit">Save table</button>
                    </form>
                  </div>
                ) : null}

                {data?.canManageRestaurant ? (
                  <div className="reservation-panel">
                    <div className="reservation-header">
                      <div>
                        <p className="eyebrow">Reservations</p>
                        <h3>Booking and waitlist</h3>
                      </div>
                      <strong>{upcomingReservations.length}</strong>
                      <button
                        onClick={() => setIsReservationModalOpen(true)}
                        type="button"
                      >
                        <Plus aria-hidden="true" />
                        New booking
                      </button>
                    </div>

                    <div className="reservation-list">
                      {upcomingReservations.map((reservation) => {
                        const tableName = reservation.tableId
                          ? selectedRestaurant.tables.find(
                              (table) => table.id === reservation.tableId,
                            )?.name ?? "Table"
                          : "No table";

                        return (
                          <article className="reservation-row" key={reservation.id}>
                            <div>
                              <strong>{reservation.guestName}</strong>
                              <span>
                                {reservation.partySize} guest
                                {reservation.partySize === 1 ? "" : "s"} -{" "}
                                {new Date(reservation.scheduledAt).toLocaleString()}
                              </span>
                              <small>
                                {formatLabel(reservation.status)} - {tableName}
                              </small>
                              {reservation.notes ? <small>{reservation.notes}</small> : null}
                              {reservation.items.length ? (
                                <div className="reservation-items">
                                  {reservation.items.map((item) => (
                                    <small key={item.id}>
                                      {item.quantity}x {item.name}
                                    </small>
                                  ))}
                                </div>
                              ) : null}
                              {!reservation.tableId &&
                              reservation.suggestedTables.length ? (
                                <div className="reservation-suggestions">
                                  {reservation.suggestedTables.map((table) => (
                                    <button
                                      key={table.id}
                                      onClick={() =>
                                        updateReservation(reservation.id, {
                                          status:
                                            reservation.status === "waitlisted"
                                              ? "confirmed"
                                              : reservation.status,
                                          tableId: table.id,
                                        })
                                      }
                                      type="button"
                                    >
                                      {table.name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="reservation-actions">
                              <button
                                disabled={reservation.status === "seated"}
                                onClick={() =>
                                  updateReservation(reservation.id, {
                                    status: "seated",
                                    tableId:
                                      reservation.tableId ||
                                      reservation.suggestedTables[0]?.id ||
                                      "",
                                  })
                                }
                                type="button"
                              >
                                Seat
                              </button>
                              <select
                                aria-label={`Status for ${reservation.guestName}`}
                                onChange={(event) =>
                                  updateReservation(reservation.id, {
                                    status: event.target.value,
                                  })
                                }
                                value={reservation.status}
                              >
                                {reservationStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {formatLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </article>
                        );
                      })}
                      {!upcomingReservations.length ? (
                        <div className="empty-state">
                          No reservations or waitlist entries.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>

              {isReservationModalOpen ? (
                <div className="modal-backdrop" role="presentation">
                  <section
                    aria-modal="true"
                    className="reservation-modal"
                    role="dialog"
                  >
                    <div className="reservation-header">
                      <div>
                        <p className="eyebrow">Booking</p>
                        <h3>New reservation</h3>
                      </div>
                      <button
                        onClick={() => setIsReservationModalOpen(false)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                    <form className="reservation-form modal-form" onSubmit={createReservation}>
                      <label>
                        Guest
                        <input
                          onChange={(event) => setReservationGuestName(event.target.value)}
                          placeholder="Guest name"
                          required
                          value={reservationGuestName}
                        />
                      </label>
                      <label>
                        Party
                        <input
                          min="1"
                          onChange={(event) => setReservationPartySize(event.target.value)}
                          required
                          type="number"
                          value={reservationPartySize}
                        />
                      </label>
                      <label>
                        Time
                        <input
                          onChange={(event) => setReservationScheduledAt(event.target.value)}
                          required
                          type="datetime-local"
                          value={reservationScheduledAt}
                        />
                      </label>
                      <label>
                        Table
                        <select
                          onChange={(event) => setReservationTableId(event.target.value)}
                          value={reservationTableId}
                        >
                          <option value="">Suggest later</option>
                          {selectedRestaurant.tables.map((table) => (
                            <option key={table.id} value={table.id}>
                              {table.name} - {formatLabel(table.status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Type
                        <select
                          onChange={(event) => setReservationStatus(event.target.value)}
                          value={reservationStatus}
                        >
                          <option value="confirmed">Reservation</option>
                          <option value="waitlisted">Waitlist</option>
                        </select>
                      </label>
                      <label className="reservation-notes">
                        Notes
                        <input
                          onChange={(event) => setReservationNotes(event.target.value)}
                          placeholder="Occasion, preferences..."
                          value={reservationNotes}
                        />
                      </label>

                      <div className="reservation-item-picker">
                        <div>
                          <strong>Requested items</strong>
                          <span>Optional pre-order for the booking.</span>
                        </div>
                        <select
                          onChange={(event) => {
                            if (event.target.value) {
                              addReservationItem(event.target.value);
                              event.target.value = "";
                            }
                          }}
                        >
                          <option value="">Add menu item</option>
                          {selectedRestaurant.menuItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} - {item.currency} {item.price.toFixed(2)}
                            </option>
                          ))}
                        </select>
                        <div className="reservation-items">
                          {reservationItems.map((item, index) => {
                            const menuItem = selectedRestaurant.menuItems.find(
                              (candidate) => candidate.id === item.menuItemId,
                            );

                            return (
                              <div key={`${item.menuItemId}-${index}`}>
                                <span>{menuItem?.name ?? "Menu item"}</span>
                                <input
                                  min="0"
                                  onChange={(event) =>
                                    updateReservationItemQuantity(
                                      index,
                                      Number(event.target.value),
                                    )
                                  }
                                  type="number"
                                  value={item.quantity}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button disabled={isSubmitting} type="submit">
                        <Plus aria-hidden="true" />
                        Save booking
                      </button>
                    </form>
                  </section>
                </div>
              ) : null}

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
                    <label>
                      Image URL
                      <input
                        onChange={(event) =>
                          setNewMenuItemImageUrl(event.target.value)
                        }
                        placeholder="https://example.com/dish.jpg"
                        type="url"
                        value={newMenuItemImageUrl}
                      />
                    </label>
                    <label className="menu-toggle-label">
                      <input
                        checked={newMenuItemStockEnabled}
                        onChange={(event) =>
                          setNewMenuItemStockEnabled(event.target.checked)
                        }
                        type="checkbox"
                      />
                      Track stock
                    </label>
                    <label>
                      Stock
                      <input
                        disabled={!newMenuItemStockEnabled}
                        min="0"
                        onChange={(event) => setNewMenuItemStock(event.target.value)}
                        placeholder="Optional"
                        type="number"
                        value={newMenuItemStock}
                      />
                    </label>
                    <label className="menu-toggle-label">
                      <input
                        checked={newMenuItemIsAvailable}
                        onChange={(event) =>
                          setNewMenuItemIsAvailable(event.target.checked)
                        }
                        type="checkbox"
                      />
                      Available
                    </label>
                    <fieldset className="menu-flag-fieldset">
                      <legend>Allergens</legend>
                      <div className="menu-flag-options">
                        {allergenOptions.map((option) => (
                          <label key={option}>
                            <input
                              checked={newMenuItemAllergens.includes(option)}
                              onChange={() => toggleNewMenuFlag("allergens", option)}
                              type="checkbox"
                            />
                            {formatLabel(option)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="menu-flag-fieldset">
                      <legend>Dietary</legend>
                      <div className="menu-flag-options">
                        {dietaryOptions.map((option) => (
                          <label key={option}>
                            <input
                              checked={newMenuItemDietary.includes(option)}
                              onChange={() => toggleNewMenuFlag("dietary", option)}
                              type="checkbox"
                            />
                            {formatLabel(option)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button disabled={isSubmitting} type="submit">
                      <Plus aria-hidden="true" />
                      Add item
                    </button>
                  </form>

                  <div className="menu-grid">
                    {selectedRestaurant.menuItems.map((item) => (
                      <div
                        className="menu-item-card"
                        data-unavailable={!item.isAvailable}
                        key={item.id}
                      >
                        {item.imageUrl ? (
                          <img
                            alt={item.name}
                            className="menu-item-image"
                            loading="lazy"
                            src={item.imageUrl}
                          />
                        ) : (
                          <div aria-hidden="true" className="menu-item-image-placeholder">
                            <Utensils />
                          </div>
                        )}
                        <div className="menu-item-card-heading">
                          <strong>{item.name}</strong>
                          {!item.isAvailable ? (
                            <small className="stock-badge unavailable">86</small>
                          ) : item.stockEnabled ? (
                            <small className="stock-badge">
                              {item.currentStock ?? 0} left
                            </small>
                          ) : null}
                        </div>
                        <span>
                          {item.currency} {item.price.toFixed(2)}
                        </span>
                        {item.allergens.length ? (
                          <div className="menu-item-flags">
                            {item.allergens.map((flag) => (
                              <small className="allergen-flag" key={flag}>
                                {formatLabel(flag)}
                              </small>
                            ))}
                          </div>
                        ) : null}
                        {item.dietary.length ? (
                          <div className="menu-item-flags">
                            {item.dietary.map((flag) => (
                              <small className="dietary-flag" key={flag}>
                                {formatLabel(flag)}
                              </small>
                            ))}
                          </div>
                        ) : null}
                        {item.description ? <small>{item.description}</small> : null}
                        <div className="menu-stock-actions">
                          <button
                            onClick={() =>
                              updateMenuItemStock(item.id, {
                                isAvailable: !item.isAvailable,
                              })
                            }
                            type="button"
                          >
                            {item.isAvailable ? "Mark 86" : "Restore"}
                          </button>
                          {item.stockEnabled ? (
                            <input
                              aria-label={`Stock for ${item.name}`}
                              min="0"
                              onBlur={(event) =>
                                updateMenuItemStock(item.id, {
                                  currentStock: Number(event.target.value) || 0,
                                  isAvailable: Number(event.target.value) > 0,
                                  stockEnabled: true,
                                })
                              }
                              type="number"
                              defaultValue={item.currentStock ?? 0}
                            />
                          ) : (
                            <button
                              onClick={() =>
                                updateMenuItemStock(item.id, {
                                  currentStock: 0,
                                  isAvailable: false,
                                  stockEnabled: true,
                                })
                              }
                              type="button"
                            >
                              Enable count
                            </button>
                          )}
                        </div>
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
                  <form className="restaurant-order-builder pos-order-builder" onSubmit={createOrder}>
                    <section className="pos-menu-panel">
                      <div className="pos-builder-toolbar">
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
                        <label className="pos-search-field">
                          Search
                          <span>
                            <Search aria-hidden="true" />
                            <input
                              onChange={(event) => setOrderMenuSearch(event.target.value)}
                              placeholder="Find menu item"
                              value={orderMenuSearch}
                            />
                          </span>
                        </label>
                      </div>

                      <div className="pos-category-tabs" role="tablist" aria-label="Menu categories">
                        <button
                          aria-selected={selectedMenuCategoryId === "all"}
                          data-selected={selectedMenuCategoryId === "all"}
                          onClick={() => setSelectedMenuCategoryId("all")}
                          role="tab"
                          type="button"
                        >
                          All
                        </button>
                        {selectedRestaurant.menuCategories.map((category) => (
                          <button
                            aria-selected={selectedMenuCategoryId === category.id}
                            data-selected={selectedMenuCategoryId === category.id}
                            key={category.id}
                            onClick={() => setSelectedMenuCategoryId(category.id)}
                            role="tab"
                            type="button"
                          >
                            {category.name}
                          </button>
                        ))}
                        {selectedRestaurant.menuItems.some((item) => !item.categoryId) ? (
                          <button
                            aria-selected={selectedMenuCategoryId === "uncategorized"}
                            data-selected={selectedMenuCategoryId === "uncategorized"}
                            onClick={() => setSelectedMenuCategoryId("uncategorized")}
                            role="tab"
                            type="button"
                          >
                            Other
                          </button>
                        ) : null}
                      </div>

                      <div className="pos-menu-grid">
                        {filteredMenuItems.map((item) => (
                          <button
                            className="pos-menu-tile"
                            data-unavailable={!item.isAvailable}
                            disabled={!item.isAvailable}
                            key={item.id}
                            onClick={() => addMenuItemToDraft(item.id)}
                            type="button"
                          >
                            {item.imageUrl ? (
                              <img alt="" loading="lazy" src={item.imageUrl} />
                            ) : (
                              <span aria-hidden="true">
                                <Utensils />
                              </span>
                            )}
                            <strong>{item.name}</strong>
                            <small>
                              {item.currency} {item.price.toFixed(2)}
                            </small>
                            {!item.isAvailable ? (
                              <small className="stock-badge unavailable">Unavailable</small>
                            ) : item.stockEnabled ? (
                              <small className="stock-badge">
                                {item.currentStock ?? 0} left
                              </small>
                            ) : null}
                            {item.allergens.length || item.dietary.length ? (
                              <div className="pos-menu-flags">
                                {[...item.allergens, ...item.dietary].slice(0, 3).map((flag) => (
                                  <small key={flag}>{formatLabel(flag)}</small>
                                ))}
                              </div>
                            ) : null}
                          </button>
                        ))}
                        {!filteredMenuItems.length ? (
                          <div className="empty-state">No matching menu items.</div>
                        ) : null}
                      </div>
                    </section>

                    <aside className="pos-ticket-panel">
                      <div className="pos-ticket-header">
                        <div>
                          <p className="eyebrow">Current order</p>
                          <h3>
                            {orderTableId
                              ? selectedRestaurant.tables.find(
                                  (table) => table.id === orderTableId,
                                )?.name ?? "Table"
                              : "Counter / takeaway"}
                          </h3>
                        </div>
                        <strong>{orderItems.length}</strong>
                      </div>

                      <div className="order-draft-list pos-ticket-list">
                        {orderItems.map((item, index) => {
                          const menuItem = selectedRestaurant.menuItems.find(
                            (candidate) => candidate.id === item.menuItemId,
                          );

                          return (
                            <div className="order-draft-row pos-ticket-row" key={`${item.menuItemId}-${index}`}>
                              <div>
                                <strong>{menuItem?.name ?? "Menu item"}</strong>
                                <span>
                                  {menuItem?.currency ?? selectedRestaurant.orders[0]?.currency ?? "USD"}{" "}
                                  {((menuItem?.price ?? 0) * item.quantity).toFixed(2)}
                                </span>
                              </div>
                              <div className="quantity-stepper">
                                <button
                                  aria-label={`Decrease ${menuItem?.name ?? "item"} quantity`}
                                  onClick={() =>
                                    updateDraftItemQuantity(index, item.quantity - 1)
                                  }
                                  type="button"
                                >
                                  -
                                </button>
                                <input
                                  aria-label={`Quantity for ${menuItem?.name ?? "item"}`}
                                  min="1"
                                  onChange={(event) =>
                                    updateDraftItemQuantity(
                                      index,
                                      Number(event.target.value) || 1,
                                    )
                                  }
                                  type="number"
                                  value={item.quantity}
                                />
                                <button
                                  aria-label={`Increase ${menuItem?.name ?? "item"} quantity`}
                                  onClick={() =>
                                    updateDraftItemQuantity(index, item.quantity + 1)
                                  }
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                aria-label={`Remove ${menuItem?.name ?? "item"}`}
                                className="danger-button"
                                onClick={() =>
                                  setOrderItems((current) =>
                                    current.filter((_, itemIndex) => itemIndex !== index),
                                  )
                                }
                                type="button"
                              >
                                <Trash2 aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}

                        {!orderItems.length ? (
                          <div className="empty-state">Tap menu items to build an order.</div>
                        ) : null}
                      </div>

                      <label className="pos-ticket-notes">
                        Notes for next manual add
                        <input
                          onChange={(event) => setOrderItemNotes(event.target.value)}
                          placeholder="No onions"
                          value={orderItemNotes}
                        />
                      </label>

                      <div className="pos-manual-add">
                        <select
                          aria-label="Manual menu item"
                          onChange={(event) => setOrderMenuItemId(event.target.value)}
                          value={orderMenuItemId}
                        >
                          <option value="">Choose item</option>
                          {selectedRestaurant.menuItems.map((item) => (
                            <option
                              disabled={!item.isAvailable}
                              key={item.id}
                              value={item.id}
                            >
                              {item.name} - {item.currency} {item.price.toFixed(2)}
                              {!item.isAvailable ? " - unavailable" : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="Manual item quantity"
                          min="1"
                          onChange={(event) => setOrderItemQuantity(event.target.value)}
                          type="number"
                          value={orderItemQuantity}
                        />
                        <button onClick={addOrderItem} type="button">
                          <Plus aria-hidden="true" />
                        </button>
                      </div>

                      <div className="pos-ticket-total">
                        <span>Total</span>
                        <strong>{orderTotal.toFixed(2)}</strong>
                      </div>
                      <button disabled={isSubmitting || !orderItems.length} type="submit">
                        <Plus aria-hidden="true" />
                        Send order
                      </button>
                    </aside>
                  </form>
                ) : null}

                <div className="restaurant-order-list">
                  <div className="order-panel-toolbar">
                    <div>
                      <p className="eyebrow">Orders</p>
                      <h3>
                        {orderListMode === "active"
                          ? "Active service"
                          : "Order history"}
                      </h3>
                    </div>
                    <div
                      aria-label="Choose which orders to show"
                      className="segmented-control"
                      role="group"
                    >
                      <button
                        aria-pressed={orderListMode === "active"}
                        data-selected={orderListMode === "active"}
                        onClick={() => setOrderListMode("active")}
                        type="button"
                      >
                        Active
                        <span>{activeOrders.length}</span>
                      </button>
                      <button
                        aria-pressed={orderListMode === "history"}
                        data-selected={orderListMode === "history"}
                        onClick={() => setOrderListMode("history")}
                        type="button"
                      >
                        History
                        <span>{completedOrders.length}</span>
                      </button>
                    </div>
                  </div>

                  {paymentError ? (
                    <div aria-live="polite" className="form-error" role="status">
                      {paymentError}
                    </div>
                  ) : null}

                  {paymentDrawerOrder ? (
                    <aside
                      aria-label="Bill and payment drawer"
                      className="payment-drawer"
                    >
                      <div className="payment-drawer-header">
                        <div>
                          <p className="eyebrow">Payment drawer</p>
                          <h3>{paymentDrawerTableName}</h3>
                          <span>
                            {paymentDrawerOrder.items.length} item
                            {paymentDrawerOrder.items.length === 1 ? "" : "s"} -{" "}
                            {formatLabel(paymentDrawerOrder.paymentStatus)}
                          </span>
                        </div>
                        <button
                          onClick={() => setPaymentDrawerOrderId(null)}
                          type="button"
                        >
                          Close
                        </button>
                      </div>

                      <div className="payment-drawer-note">
                        Choose how this bill will be settled. Paystack opens the
                        hosted checkout; cash, card, voucher, and comp are
                        recorded by staff.
                      </div>

                      <div className="payment-summary-grid">
                        <div>
                          <span>Total</span>
                          <strong>
                            {paymentDrawerOrder.currency}{" "}
                            {paymentDrawerOrder.totalAmount.toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span>Paid</span>
                          <strong>
                            {paymentDrawerOrder.currency}{" "}
                            {(paymentDrawerOrder.paidAmount ?? 0).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span>Outstanding</span>
                          <strong>
                            {paymentDrawerOrder.currency}{" "}
                            {paymentOutstanding.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <div className="payment-split-panel">
                        <div
                          aria-label="Choose split mode"
                          className="payment-split-tabs"
                          role="group"
                        >
                          <button
                            aria-pressed={paymentSplitMode === "equal"}
                            data-selected={paymentSplitMode === "equal"}
                            onClick={() => setPaymentSplitMode("equal")}
                            type="button"
                          >
                            Equal
                          </button>
                          <button
                            aria-pressed={paymentSplitMode === "items"}
                            data-selected={paymentSplitMode === "items"}
                            onClick={() => setPaymentSplitMode("items")}
                            type="button"
                          >
                            Items
                          </button>
                        </div>

                        {paymentSplitMode === "equal" ? (
                          <div className="payment-split-row">
                            <div>
                              <span>Equal split</span>
                              <strong>
                                {paymentDrawerOrder.currency} {splitAmount.toFixed(2)}
                              </strong>
                            </div>
                            <label>
                              Guests
                              <input
                                min="2"
                                onChange={(event) =>
                                  setPaymentSplitCount(event.target.value)
                                }
                                type="number"
                                value={paymentSplitCount}
                              />
                            </label>
                            <button
                              disabled={isPreviewingSplit}
                              onClick={applyEqualSplit}
                              type="button"
                            >
                              {isPreviewingSplit ? "Checking..." : "Use split"}
                            </button>
                          </div>
                        ) : (
                          <div className="payment-item-split">
                            <div>
                              <span>Selected items</span>
                              <strong>
                                {paymentDrawerOrder.currency}{" "}
                                {itemSplitAmount.toFixed(2)}
                              </strong>
                            </div>
                            <div className="payment-item-split-list">
                              {paymentDrawerOrder.items.map((item) => (
                                <label key={item.id}>
                                  <input
                                    checked={paymentSplitItemIds.includes(item.id)}
                                    onChange={() => toggleSplitItem(item.id)}
                                    type="checkbox"
                                  />
                                  <span>
                                    {item.quantity}x {item.name}
                                  </span>
                                  <strong>
                                    {paymentDrawerOrder.currency}{" "}
                                    {item.totalPrice.toFixed(2)}
                                  </strong>
                                </label>
                              ))}
                            </div>
                            <button
                              disabled={isPreviewingSplit}
                              onClick={applyItemSplit}
                              type="button"
                            >
                              {isPreviewingSplit ? "Checking..." : "Use items"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div
                        aria-label="Choose payment method"
                        className="payment-method-grid"
                        role="group"
                      >
                        {paymentMethods.map((method) => (
                          <button
                            aria-pressed={paymentMethod === method.id}
                            data-selected={paymentMethod === method.id}
                            key={method.id}
                            onClick={() => {
                              setPaymentMethod(method.id);
                              setPaymentError(null);
                            }}
                            type="button"
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>

                      {paymentMethod === "paystack" ? (
                        <div className="payment-action-panel">
                          <p>
                            Start a hosted checkout for the outstanding bill
                            using the existing Paystack payment flow.
                          </p>
                          <button
                            disabled={
                              payingOrderId === paymentDrawerOrder.id ||
                              paymentOutstanding <= 0
                            }
                            onClick={() => void payOrderWithPaystack(paymentDrawerOrder)}
                            type="button"
                          >
                            <CreditCard aria-hidden="true" />
                            {payingOrderId === paymentDrawerOrder.id
                              ? "Starting"
                              : "Open Paystack"}
                          </button>
                        </div>
                      ) : null}

                      {paymentMethod === "room_charge" ? (
                        <div className="payment-action-panel">
                          <div className="room-charge-search">
                            <label>
                              Guest or room
                              <input
                                onChange={(event) => setStaySearch(event.target.value)}
                                placeholder="Search active stays"
                                value={staySearch}
                              />
                            </label>
                            <button
                              onClick={() => void searchActiveStays()}
                              type="button"
                            >
                              <Search aria-hidden="true" />
                              Search
                            </button>
                          </div>
                          <div className="stay-option-list">
                            {stayOptions.map((stay) => (
                              <button
                                className="stay-option-card"
                                data-selected={selectedFolioId === stay.folioId}
                                key={stay.folioId}
                                onClick={() => setSelectedFolioId(stay.folioId)}
                                type="button"
                              >
                                <strong>{stay.guestName}</strong>
                                <span>Room {stay.roomNumber}</span>
                                <small>
                                  Balance {stay.outstandingBalance}
                                  {stay.checkoutDate
                                    ? ` - Due ${new Date(stay.checkoutDate).toLocaleDateString()}`
                                    : ""}
                                </small>
                              </button>
                            ))}
                            {!stayOptions.length ? (
                              <div className="empty-state compact">
                                Search for an active stay to charge this bill to a room.
                              </div>
                            ) : null}
                          </div>
                          <button
                            disabled={
                              payingOrderId === paymentDrawerOrder.id ||
                              !selectedFolioId ||
                              paymentOutstanding <= 0
                            }
                            onClick={() => void chargeOrderToRoom()}
                            type="button"
                          >
                            <ReceiptText aria-hidden="true" />
                            Charge to room
                          </button>
                        </div>
                      ) : null}

                      {!["paystack", "room_charge"].includes(paymentMethod) ? (
                        <form
                          className="payment-action-panel"
                          onSubmit={recordManualPayment}
                        >
                          <p>
                            Record an in-person or approved manual settlement.
                          </p>
                          <div className="payment-form-grid">
                            <label>
                              Amount
                              <input
                                min="0"
                                onChange={(event) => setPaymentAmount(event.target.value)}
                                step="0.01"
                                type="number"
                                value={paymentAmount}
                              />
                            </label>
                            <label>
                              Reference
                              <input
                                onChange={(event) =>
                                  setPaymentReference(event.target.value)
                                }
                                placeholder="Optional"
                                value={paymentReference}
                              />
                            </label>
                            {paymentMethod === "cash" ? (
                              <label>
                                Cash tendered
                                <input
                                  min="0"
                                  onChange={(event) =>
                                    setCashTendered(event.target.value)
                                  }
                                  step="0.01"
                                  type="number"
                                  value={cashTendered}
                                />
                              </label>
                            ) : null}
                          </div>
                          {paymentMethod === "cash" ? (
                            <div className="payment-change-due">
                              <span>Change due</span>
                              <strong>
                                {paymentDrawerOrder.currency} {cashChange.toFixed(2)}
                              </strong>
                            </div>
                          ) : null}
                          <button
                            disabled={
                              payingOrderId === paymentDrawerOrder.id ||
                              paymentOutstanding <= 0
                            }
                            type="submit"
                          >
                            <CreditCard aria-hidden="true" />
                            {payingOrderId === paymentDrawerOrder.id
                              ? "Recording"
                              : "Record payment"}
                          </button>
                        </form>
                      ) : null}
                    </aside>
                  ) : null}

                  {data?.canManageRestaurant && managerPanelOrder ? (
                    <aside
                      aria-label="Manager action panel"
                      className="manager-action-panel"
                    >
                      <div className="manager-action-header">
                        <div>
                          <p className="eyebrow">Manager actions</p>
                          <h3>
                            {managerPanelOrder.tableId
                              ? selectedRestaurant.tables.find(
                                  (table) => table.id === managerPanelOrder.tableId,
                                )?.name ?? "Table"
                              : "Counter / takeaway"}
                          </h3>
                          <span>
                            Role checked by workspace permissions. Every server
                            action writes an audit log.
                          </span>
                        </div>
                        <button onClick={closeManagerPanel} type="button">
                          Close
                        </button>
                      </div>

                      {managerActionError ? (
                        <div aria-live="polite" className="form-error" role="status">
                          {managerActionError}
                        </div>
                      ) : null}

                      <form onSubmit={submitManagerAction}>
                        <div
                          aria-label="Choose manager action"
                          className="manager-action-tabs"
                          role="group"
                        >
                          {managerActions
                            .filter(
                              (action) =>
                                action.id === "reprint" ||
                                !isCompletedOrder(managerPanelOrder.status),
                            )
                            .map((action) => (
                              <button
                                aria-pressed={managerAction === action.id}
                                data-selected={managerAction === action.id}
                                key={action.id}
                                onClick={() => {
                                  setManagerAction(action.id);
                                  setManagerActionError(null);
                                  setManagerConfirmation("");
                                }}
                                type="button"
                              >
                                {action.label}
                              </button>
                            ))}
                        </div>

                        {managerAction === "discount" ? (
                          <div className="manager-action-grid">
                            <label>
                              Type
                              <select
                                onChange={(event) =>
                                  setDiscountType(event.target.value)
                                }
                                value={discountType}
                              >
                                <option value="fixed">Fixed amount</option>
                                <option value="percent">Percent</option>
                                <option value="item">Item amount</option>
                              </select>
                            </label>
                            <label>
                              Amount
                              <input
                                min="0.01"
                                onChange={(event) =>
                                  setDiscountAmount(event.target.value)
                                }
                                step="0.01"
                                type="number"
                                value={discountAmount}
                              />
                            </label>
                            <label>
                              Label
                              <input
                                onChange={(event) =>
                                  setDiscountLabel(event.target.value)
                                }
                                placeholder="Manager comp"
                                value={discountLabel}
                              />
                            </label>
                            {discountType === "item" ? (
                              <label>
                                Item
                                <select
                                  onChange={(event) =>
                                    setDiscountItemId(event.target.value)
                                  }
                                  value={discountItemId}
                                >
                                  {managerPanelOrder.items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.quantity}x {item.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}
                          </div>
                        ) : null}

                        {managerAction === "void_item" ? (
                          <div className="manager-action-grid">
                            <label>
                              Item
                              <select
                                onChange={(event) =>
                                  setVoidItemId(event.target.value)
                                }
                                value={voidItemId}
                              >
                                {managerPanelOrder.items.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.quantity}x {item.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="manager-action-wide">
                              Reason
                              <input
                                onChange={(event) =>
                                  setVoidReason(event.target.value)
                                }
                                placeholder="Wrong item, guest changed order..."
                                value={voidReason}
                              />
                            </label>
                          </div>
                        ) : null}

                        {managerAction === "transfer" ? (
                          <div className="manager-action-grid">
                            <label>
                              Target table
                              <select
                                onChange={(event) =>
                                  setTransferTableId(event.target.value)
                                }
                                value={transferTableId}
                              >
                                <option value="">Choose available table</option>
                                {transferTableOptions.map((table) => (
                                  <option key={table.id} value={table.id}>
                                    {table.name} - {formatLabel(table.status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}

                        {managerAction === "cancel" ? (
                          <div className="manager-action-grid">
                            <label className="manager-action-wide">
                              Cancellation reason
                              <input
                                onChange={(event) =>
                                  setCancelReason(event.target.value)
                                }
                                placeholder="Guest left, duplicate order..."
                                value={cancelReason}
                              />
                            </label>
                          </div>
                        ) : null}

                        {managerAction === "reprint" ? (
                          <div className="manager-action-note">
                            Reprint the current receipt in the browser print dialog.
                          </div>
                        ) : null}

                        {managerAction !== "reprint" ? (
                          <div className="manager-action-grid">
                            <label className="manager-action-wide">
                              Manager confirmation
                              <input
                                autoComplete="off"
                                onChange={(event) =>
                                  setManagerConfirmation(event.target.value)
                                }
                                placeholder="Type APPROVE"
                                value={managerConfirmation}
                              />
                            </label>
                          </div>
                        ) : null}

                        <button disabled={isSubmitting} type="submit">
                          {managerAction === "discount" ? <Percent aria-hidden="true" /> : null}
                          {managerAction === "void_item" ? <Ban aria-hidden="true" /> : null}
                          {managerAction === "transfer" ? <ArrowRightLeft aria-hidden="true" /> : null}
                          {managerAction === "cancel" ? <Trash2 aria-hidden="true" /> : null}
                          {managerAction === "reprint" ? <Printer aria-hidden="true" /> : null}
                          {managerAction === "reprint" ? "Reprint receipt" : "Apply action"}
                        </button>
                      </form>
                    </aside>
                  ) : null}

                  {orderListMode === "active" ? (
                    <div className="order-compact-list">
                      {activeOrders.map((order) => {
                        const tableName = order.tableId
                          ? selectedRestaurant.tables.find(
                              (table) => table.id === order.tableId,
                            )?.name ?? "Table"
                          : "Counter / takeaway";

                        return (
                          <article
                            className={`order-compact-row${isGuestQrOrder(order) ? " guest-order-row" : ""}`}
                            key={order.id}
                          >
                            <div className="order-compact-main">
                              {isGuestQrOrder(order) ? (
                                <span className="role-pill">Guest QR review</span>
                              ) : null}
                              <strong>
                                {order.currency} {order.totalAmount.toFixed(2)}
                              </strong>
                              <span>{tableName}</span>
                              <small>
                                {order.items.length} item
                                {order.items.length === 1 ? "" : "s"} -{" "}
                                {new Date(order.createdAt).toLocaleTimeString()}
                              </small>
                            </div>
                            <div className="order-compact-items">
                              {order.items.slice(0, isGuestQrOrder(order) ? 8 : 2).map((item) => (
                                <span key={item.id}>
                                  {item.quantity}x {item.name}
                                  {item.status ? ` (${formatLabel(item.status)})` : ""}
                                  {item.notes ? ` - ${item.notes}` : ""}
                                </span>
                              ))}
                              {order.items.length > (isGuestQrOrder(order) ? 8 : 2) ? (
                                <span>
                                  +{order.items.length - (isGuestQrOrder(order) ? 8 : 2)} more
                                </span>
                              ) : null}
                            </div>
                            <div className="order-compact-actions">
                              {isGuestQrOrder(order) ? (
                                <button
                                  aria-label={`Confirm guest QR order for ${tableName}`}
                                  onClick={() => updateOrderStatus(order.id, "sent")}
                                  type="button"
                                >
                                  <CheckCircle2 aria-hidden="true" />
                                  Confirm & send
                                </button>
                              ) : null}
                              <button
                                aria-label={`Pay order for ${tableName}`}
                                disabled={payingOrderId === order.id || isGuestQrOrder(order)}
                                onClick={() => openPaymentDrawer(order)}
                                type="button"
                              >
                                <CreditCard aria-hidden="true" />
                                {paymentDrawerOrderId === order.id
                                  ? "Open bill"
                                  : "Settle"}
                              </button>
                              {data?.canManageRestaurant ? (
                                <button
                                  aria-label={`Open manager actions for ${tableName}`}
                                  onClick={() => openManagerPanel(order)}
                                  type="button"
                                >
                                  <ShieldCheck aria-hidden="true" />
                                  Manager
                                </button>
                              ) : null}
                              {data?.allowedOrderStatuses.length ? (
                                <label>
                                  <span className="sr-only">
                                    Status for order {order.id}
                                  </span>
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
                                </label>
                              ) : (
                                <span className="role-pill">
                                  {formatLabel(order.status)}
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })}

                      {!activeOrders.length ? (
                        <div className="empty-state">No active orders.</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="order-history-list">
                      {completedOrders.map((order) => {
                        const tableName = order.tableId
                          ? selectedRestaurant.tables.find(
                              (table) => table.id === order.tableId,
                            )?.name ?? "Table"
                          : "Counter / takeaway";

                        return (
                          <article
                            className="order-history-row"
                            key={order.id}
                          >
                            <ReceiptText aria-hidden="true" />
                            <div>
                              <strong>
                                {order.currency} {order.totalAmount.toFixed(2)}
                              </strong>
                              <span>
                                {tableName} -{" "}
                                {new Date(order.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <span className="role-pill">
                              {formatLabel(order.status)}
                            </span>
                            {data?.canManageRestaurant ? (
                              <button
                                aria-label={`Reprint receipt for ${tableName}`}
                                onClick={() => openManagerPanel(order)}
                                type="button"
                              >
                                <Printer aria-hidden="true" />
                                Reprint
                              </button>
                            ) : null}
                          </article>
                        );
                      })}

                      {!completedOrders.length ? (
                        <div className="empty-state">No completed orders yet.</div>
                      ) : null}
                    </div>
                  )}
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
