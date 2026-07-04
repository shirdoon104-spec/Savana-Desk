"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import {
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Tags,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";
type HotelWorkspaceTab =
  | "overview"
  | "rooms"
  | "reservations"
  | "housekeeping"
  | "maintenance"
  | "rates"
  | "setup";
type RateWorkspaceTab = "quote" | "create" | "lists";

const hotelWorkspaceTabs: Array<{
  id: HotelWorkspaceTab;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Dashboard",
  },
  {
    id: "rooms",
    label: "Rooms",
    description: "Front desk",
  },
  {
    id: "reservations",
    label: "Reservations",
    description: "Arrival book",
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    description: "Room turn",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Repairs",
  },
  {
    id: "rates",
    label: "Rates",
    description: "Pricing",
  },
  {
    id: "setup",
    label: "Setup",
    description: "Inventory",
  },
];

interface PropertyResponse {
  allowedRoomStatuses: string[];
  canManageBilling: boolean;
  canManageMaintenance: boolean;
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
    earlyCheckInBeforeTime: string | null;
    earlyCheckInFeeType: string;
    earlyCheckInFeeValue: string | number;
    id: string;
    lateCheckoutAfterTime: string | null;
    lateCheckoutFeeType: string;
    lateCheckoutFeeValue: string | number;
    name: string;
    serviceChargeRate: string | number | null;
    taxRate: string | number | null;
    restaurants: Array<{
      id: string;
      name: string;
      serviceStyle: string | null;
    }>;
    hotelReservations: Array<{
      adultCount: number;
      arrivalDate: string;
      assignedRoom: {
        id: string;
        number: string;
      } | null;
      assignedRoomId: string | null;
      childCount: number;
      complimentaryReason: string | null;
      confirmationCode: string;
      currency: string;
      departureDate: string;
      depositPaidAmount: string | number;
      depositRequiredAmount: string | number;
      guestEmail: string | null;
      guestName: string;
      guestPhone: string | null;
      id: string;
      isComplimentary: boolean;
      notes: string | null;
      rateOverride: string | number | null;
      ratePlanId: string | null;
      roomType: {
        id: string;
        name: string;
      };
      roomTypeId: string;
      source: string;
      specialRequests: string | null;
      status: string;
    }>;
    housekeepingTasks: Array<{
      assignedUserId: string | null;
      completedAt: string | null;
      completedByUserId: string | null;
      createdAt: string;
      createdByUserId: string | null;
      id: string;
      inspectedAt: string | null;
      inspectedByUserId: string | null;
      notes: string | null;
      priority: string;
      reason: string | null;
      room: {
        id: string;
        number: string;
        status: string;
        type: string;
      };
      roomId: string;
      status: string;
      stayId: string | null;
      type: string;
    }>;
    maintenanceRequests: Array<{
      assignedUserId: string | null;
      createdAt: string;
      id: string;
      notes: string | null;
      priority: string;
      reason: string;
      reportedByUserId: string | null;
      resolutionNotes: string | null;
      resolvedAt: string | null;
      resolvedByUserId: string | null;
      room: {
        id: string;
        number: string;
        status: string;
        type: string;
      };
      roomId: string;
      roomStatus: string;
      status: string;
      updatedAt: string;
    }>;
    roomCount: number | null;
    ratePlans: Array<{
      baseOccupancy: number;
      cancellationPolicy: {
        freeCancellationUntilHours: number | null;
        noShowPenaltyType: string;
        noShowPenaltyValue: string | number;
        penaltyType: string;
        penaltyValue: string | number;
      } | null;
      code: string;
      currency: string;
      defaultRate: string | number | null;
      description: string | null;
      extraGuestRate: string | number;
      id: string;
      minNights: number;
      name: string;
      roomRates: Array<{
        baseRate: string | number;
        currency: string;
        endDate: string;
        extraGuestRate: string | number;
        id: string;
        isActive: boolean;
        startDate: string;
      }>;
      roomType: {
        code: string;
        id: string;
        name: string;
      } | null;
      roomTypeId: string | null;
      status: string;
    }>;
    rooms: Array<{
      activeStay: {
        checkInAt: string;
        expectedCheckOutAt: string | null;
        folio: {
          balance: string | number;
          currency: string;
          id: string;
          status: string;
        } | null;
        folioId: string;
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
      isActive: boolean;
      number: string;
      roomType: {
        baseOccupancy: number;
        code: string;
        defaultCurrency: string;
        defaultRate: string | number | null;
        id: string;
        isActive: boolean;
        maxOccupancy: number | null;
        name: string;
      } | null;
      roomTypeId: string | null;
      status: string;
      type: string;
    }>;
    roomTypes: Array<{
      baseOccupancy: number;
      code: string;
      defaultCurrency: string;
      defaultRate: string | number | null;
      description: string | null;
      id: string;
      isActive: boolean;
      maxOccupancy: number | null;
      name: string;
    }>;
    timezone: string;
  }>;
}

interface RateLookupResponse {
  baseAmount: string | number;
  currency: string;
  extraGuestAmount: string | number;
  guestCount: number;
  minNights: number;
  nights: number;
  totalAmount: string | number;
}

interface FolioDetailResponse {
  adjustments: Array<{
    amount: string | number;
    createdAt: string;
    createdById: string;
    currency: string;
    id: string;
    lineItemId: string | null;
    reason: string;
    status: string;
  }>;
  balance: string | number;
  closedAt: string | null;
  currency: string;
  guest: {
    email: string | null;
    firstName: string;
    id: string;
    lastName: string;
    phone: string | null;
  };
  id: string;
  invoice: {
    balance: string | number;
    currency: string;
    id: string;
    invoiceNumber: string;
    issuedAt: string;
    lineItemTotal: string | number;
    lineItems: Array<{
      amount: string | number;
      currency: string;
      description: string;
      id: string;
      type: string;
    }>;
    paymentTotal: string | number;
    payments: Array<{
      amount: string | number;
      currency: string;
      id: string;
      method: string;
      paidAt: string | null;
      reference: string | null;
    }>;
    status: string;
  } | null;
  lineItemTotal: string | number;
  lineItems: Array<{
    amount: string | number;
    createdAt: string;
    currency: string;
    description: string;
    id: string;
    restaurantCharge: {
      chargedAt: string | null;
      orderId: string;
      orderStatus: string | null;
      paymentStatus: string | null;
      restaurantId: string | null;
      restaurantName: string | null;
      tableId: string | null;
      tableName: string | null;
      totalAmount: string | number;
      totalCurrency: string;
    } | null;
    sourceId: string | null;
    sourceType: string | null;
    type: string;
    voidedAt: string | null;
  }>;
  legacyCharges: Array<{
    amount: string | number;
    createdAt: string;
    currency: string;
    description: string;
    id: string;
    orderId: string | null;
    restaurantId: string | null;
    supersededByLineItem: boolean;
  }>;
  openedAt: string;
  paymentTotal: string | number;
  payments: Array<{
    amount: string | number;
    createdAt: string;
    currency: string;
    id: string;
    method: string;
    paidAt: string | null;
    reference: string | null;
    status: string;
  }>;
  property: {
    id: string;
    name: string;
  };
  room: {
    id: string;
    number: string;
    status: string;
  };
  status: string;
  stay: {
    checkInAt: string;
    checkOutAt: string | null;
    expectedCheckOutAt: string | null;
    id: string;
    reservationSource: string | null;
    status: string;
  };
}

interface CheckoutPreviewResponse {
  adjustmentTotal: string | number;
  amountDue: string | number;
  currency: string;
  depositTotal: string | number;
  extraNightChargeTotal: string | number;
  extraNightCount: number;
  extraNightLines: Array<{
    amount: string | number;
    currency: string;
    description: string;
    type: string;
  }>;
  folioBalance: string | number;
  folioId: string | null;
  lineItemTotal: string | number;
  outstandingAmount: string | number;
  overpaidAmount: string | number;
  paymentTotal: string | number;
  projectedChargeTotal: string | number;
  restaurantChargeCount: number;
  restaurantChargeTotal: string | number;
  room: {
    id: string;
    number: string;
  };
  roomNightTotal: string | number;
  serviceChargeTotal: string | number;
  settlementCreditTotal: string | number;
  stay: {
    checkInAt: string;
    expectedCheckOutAt: string | null;
    guestName: string;
    id: string;
  };
  taxTotal: string | number;
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

function formatMoney(value: string | number | null | undefined, currency = "") {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  return `${currency ? `${currency} ` : ""}${amount.toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function formatFolioLineMeta(item: FolioDetailResponse["lineItems"][number]) {
  const parts = [
    formatLabel(item.type),
    item.sourceType ? formatLabel(item.sourceType) : null,
  ];

  if (item.restaurantCharge) {
    parts.push(item.restaurantCharge.restaurantName);
    parts.push(item.restaurantCharge.tableName);
    parts.push(`Order ${item.restaurantCharge.orderId.slice(-8)}`);
  } else if (item.sourceType === "stay") {
    parts.push("Stay");
  } else if (item.sourceId) {
    parts.push(`Source ${item.sourceId.slice(-8)}`);
  }

  if (item.voidedAt) {
    parts.push("Voided");
  }

  return parts.filter(Boolean).join(" - ");
}

function formatFolioLineTitle(item: FolioDetailResponse["lineItems"][number]) {
  if (item.restaurantCharge) {
    return "Restaurant order";
  }

  return item.description;
}

function formatRatePercent(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return "0";
  }

  return (rate * 100).toFixed(2).replace(/\.?0+$/, "");
}

function statusOptionsForRoom(
  currentStatus: string,
  allowedStatuses: string[],
) {
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

function createIdempotencyKey(scope: string) {
  const randomValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${scope}:${randomValue}`;
}

function dateInputDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
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
  const [propertyTaxRate, setPropertyTaxRate] = useState("0");
  const [propertyServiceChargeRate, setPropertyServiceChargeRate] =
    useState("0");
  const [earlyCheckInBeforeTime, setEarlyCheckInBeforeTime] = useState("");
  const [earlyCheckInFeeType, setEarlyCheckInFeeType] = useState("none");
  const [earlyCheckInFeeValue, setEarlyCheckInFeeValue] = useState("0");
  const [lateCheckoutAfterTime, setLateCheckoutAfterTime] = useState("");
  const [lateCheckoutFeeType, setLateCheckoutFeeType] = useState("none");
  const [lateCheckoutFeeValue, setLateCheckoutFeeValue] = useState("0");
  const [roomType, setRoomType] = useState("standard");
  const [editingRoomId, setEditingRoomId] = useState("");
  const [editingRoomNumber, setEditingRoomNumber] = useState("");
  const [editingRoomTypeId, setEditingRoomTypeId] = useState("");
  const [editingRoomTypeRecordId, setEditingRoomTypeRecordId] = useState("");
  const [editingRatePlanId, setEditingRatePlanId] = useState("");
  const [roomTypeName, setRoomTypeName] = useState("");
  const [roomTypeCode, setRoomTypeCode] = useState("");
  const [roomTypeDefaultRate, setRoomTypeDefaultRate] = useState("");
  const [roomTypeBaseOccupancy, setRoomTypeBaseOccupancy] = useState("1");
  const [roomTypeMaxOccupancy, setRoomTypeMaxOccupancy] = useState("");
  const [ratePlanName, setRatePlanName] = useState("");
  const [ratePlanRoomTypeId, setRatePlanRoomTypeId] = useState("");
  const [ratePlanDefaultRate, setRatePlanDefaultRate] = useState("");
  const [ratePlanExtraGuestRate, setRatePlanExtraGuestRate] = useState("0");
  const [ratePlanMinNights, setRatePlanMinNights] = useState("1");
  const [roomRatePlanId, setRoomRatePlanId] = useState("");
  const [roomRateRoomTypeId, setRoomRateRoomTypeId] = useState("");
  const [roomRateStartDate, setRoomRateStartDate] = useState("");
  const [roomRateEndDate, setRoomRateEndDate] = useState("");
  const [roomRateBaseRate, setRoomRateBaseRate] = useState("");
  const [roomRateExtraGuestRate, setRoomRateExtraGuestRate] = useState("0");
  const [lookupRoomTypeId, setLookupRoomTypeId] = useState("");
  const [lookupRatePlanId, setLookupRatePlanId] = useState("");
  const [lookupArrivalDate, setLookupArrivalDate] = useState("");
  const [lookupDepartureDate, setLookupDepartureDate] = useState("");
  const [lookupGuestCount, setLookupGuestCount] = useState("1");
  const [rateQuote, setRateQuote] = useState<RateLookupResponse | null>(null);
  const [reservationGuestName, setReservationGuestName] = useState("");
  const [reservationGuestPhone, setReservationGuestPhone] = useState("");
  const [reservationGuestEmail, setReservationGuestEmail] = useState("");
  const [reservationArrivalDate, setReservationArrivalDate] = useState("");
  const [reservationDepartureDate, setReservationDepartureDate] = useState("");
  const [reservationRoomTypeId, setReservationRoomTypeId] = useState("");
  const [reservationAssignedRoomId, setReservationAssignedRoomId] =
    useState("");
  const [reservationRatePlanId, setReservationRatePlanId] = useState("");
  const [reservationSource, setReservationSource] = useState("walk_in");
  const [reservationAdultCount, setReservationAdultCount] = useState("1");
  const [reservationChildCount, setReservationChildCount] = useState("0");
  const [reservationDepositRequired, setReservationDepositRequired] =
    useState("");
  const [reservationRateOverride, setReservationRateOverride] = useState("");
  const [reservationIsComplimentary, setReservationIsComplimentary] =
    useState(false);
  const [reservationComplimentaryReason, setReservationComplimentaryReason] =
    useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [roomPrefix, setRoomPrefix] = useState("");
  const [roomFrom, setRoomFrom] = useState("");
  const [roomTo, setRoomTo] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<HotelWorkspaceTab>("overview");
  const [activeRateTab, setActiveRateTab] = useState<RateWorkspaceTab>("quote");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [checkInRoomId, setCheckInRoomId] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [expectedCheckOutAt, setExpectedCheckOutAt] = useState("");
  const [checkoutReview, setCheckoutReview] = useState<{
    preview: CheckoutPreviewResponse;
    roomId: string;
  } | null>(null);
  const [selectedFolio, setSelectedFolio] =
    useState<FolioDetailResponse | null>(null);
  const [selectedFolioId, setSelectedFolioId] = useState("");
  const [folioLoadState, setFolioLoadState] = useState<LoadState>("idle");
  const [reverseLineItem, setReverseLineItem] = useState<
    FolioDetailResponse["lineItems"][number] | null
  >(null);
  const [folioPaymentAmount, setFolioPaymentAmount] = useState("");
  const [folioPaymentMethod, setFolioPaymentMethod] = useState("cash");
  const [folioPaymentReference, setFolioPaymentReference] = useState("");
  const [folioPaymentNote, setFolioPaymentNote] = useState("");
  const [folioPaymentError, setFolioPaymentError] = useState<string | null>(
    null,
  );
  const [reverseReason, setReverseReason] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [maintenanceRoomId, setMaintenanceRoomId] = useState("");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenancePriority, setMaintenancePriority] = useState("normal");
  const [maintenanceRoomStatus, setMaintenanceRoomStatus] =
    useState("maintenance");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [maintenanceResolutionNotes, setMaintenanceResolutionNotes] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const earliestExpectedCheckOutDate = useMemo(
    () => dateInputDaysFromNow(1),
    [],
  );

  const selectedProperty = useMemo(
    () =>
      data?.properties.find((property) => property.id === selectedPropertyId) ??
      data?.properties[0],
    [data?.properties, selectedPropertyId],
  );

  useEffect(() => {
    setPropertyTaxRate(formatRatePercent(selectedProperty?.taxRate));
    setPropertyServiceChargeRate(
      formatRatePercent(selectedProperty?.serviceChargeRate),
    );
    setEarlyCheckInBeforeTime(selectedProperty?.earlyCheckInBeforeTime ?? "");
    setEarlyCheckInFeeType(selectedProperty?.earlyCheckInFeeType ?? "none");
    setEarlyCheckInFeeValue(
      String(selectedProperty?.earlyCheckInFeeValue ?? 0),
    );
    setLateCheckoutAfterTime(selectedProperty?.lateCheckoutAfterTime ?? "");
    setLateCheckoutFeeType(selectedProperty?.lateCheckoutFeeType ?? "none");
    setLateCheckoutFeeValue(
      String(selectedProperty?.lateCheckoutFeeValue ?? 0),
    );
  }, [
    selectedProperty?.earlyCheckInBeforeTime,
    selectedProperty?.earlyCheckInFeeType,
    selectedProperty?.earlyCheckInFeeValue,
    selectedProperty?.id,
    selectedProperty?.lateCheckoutAfterTime,
    selectedProperty?.lateCheckoutFeeType,
    selectedProperty?.lateCheckoutFeeValue,
    selectedProperty?.serviceChargeRate,
    selectedProperty?.taxRate,
  ]);

  const roomTypes = useMemo(() => {
    const types = new Set(
      selectedProperty?.roomTypes.map((roomType) => roomType.name) ??
        selectedProperty?.rooms.map((room) => room.type) ??
        [],
    );
    return Array.from(types).sort((first, second) =>
      first.localeCompare(second),
    );
  }, [selectedProperty?.roomTypes, selectedProperty?.rooms]);

  const activeRoomTypes = useMemo(
    () =>
      selectedProperty?.roomTypes.filter((roomType) => roomType.isActive) ?? [],
    [selectedProperty?.roomTypes],
  );

  const lookupRatePlans = useMemo(() => {
    const activePlans =
      selectedProperty?.ratePlans.filter(
        (ratePlan) => ratePlan.status === "active",
      ) ?? [];
    const exactPlans = activePlans.filter(
      (ratePlan) => ratePlan.roomTypeId === lookupRoomTypeId,
    );

    if (exactPlans.length) {
      return exactPlans;
    }

    return activePlans.filter(
      (ratePlan) =>
        !ratePlan.roomTypeId || ratePlan.roomTypeId === lookupRoomTypeId,
    );
  }, [lookupRoomTypeId, selectedProperty?.ratePlans]);

  const roomRatePlans = useMemo(() => {
    const plans = selectedProperty?.ratePlans ?? [];
    const exactPlans = plans.filter(
      (ratePlan) => ratePlan.roomTypeId === roomRateRoomTypeId,
    );

    if (exactPlans.length) {
      return exactPlans;
    }

    return plans.filter(
      (ratePlan) =>
        !ratePlan.roomTypeId || ratePlan.roomTypeId === roomRateRoomTypeId,
    );
  }, [roomRateRoomTypeId, selectedProperty?.ratePlans]);

  const reservationRatePlans = useMemo(() => {
    const activePlans =
      selectedProperty?.ratePlans.filter(
        (ratePlan) => ratePlan.status === "active",
      ) ?? [];
    const exactPlans = activePlans.filter(
      (ratePlan) => ratePlan.roomTypeId === reservationRoomTypeId,
    );

    if (exactPlans.length) {
      return exactPlans;
    }

    return activePlans.filter(
      (ratePlan) =>
        !ratePlan.roomTypeId || ratePlan.roomTypeId === reservationRoomTypeId,
    );
  }, [reservationRoomTypeId, selectedProperty?.ratePlans]);

  const assignableRooms = useMemo(
    () =>
      selectedProperty?.rooms.filter(
        (room) =>
          room.isActive &&
          !["maintenance", "out_of_order"].includes(room.status) &&
          (!reservationRoomTypeId || room.roomTypeId === reservationRoomTypeId),
      ) ?? [],
    [reservationRoomTypeId, selectedProperty?.rooms],
  );

  const upcomingReservations = useMemo(
    () =>
      [...(selectedProperty?.hotelReservations ?? [])].sort(
        (first, second) =>
          new Date(first.arrivalDate).getTime() -
          new Date(second.arrivalDate).getTime(),
      ),
    [selectedProperty?.hotelReservations],
  );

  const filteredRooms = useMemo(() => {
    return (
      selectedProperty?.rooms.filter((room) => {
        if (!room.isActive) return false;
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
      if (!room.isActive) continue;
      counts.set(room.status, (counts.get(room.status) ?? 0) + 1);
    }

    return counts;
  }, [selectedProperty?.rooms]);

  const reservationCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const reservation of selectedProperty?.hotelReservations ?? []) {
      counts.set(reservation.status, (counts.get(reservation.status) ?? 0) + 1);
    }

    return counts;
  }, [selectedProperty?.hotelReservations]);

  const housekeepingCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const task of selectedProperty?.housekeepingTasks ?? []) {
      counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }

    return counts;
  }, [selectedProperty?.housekeepingTasks]);

  const maintenanceCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const request of selectedProperty?.maintenanceRequests ?? []) {
      counts.set(request.status, (counts.get(request.status) ?? 0) + 1);
    }

    return counts;
  }, [selectedProperty?.maintenanceRequests]);

  const maintenanceCandidateRooms = useMemo(
    () =>
      selectedProperty?.rooms.filter(
        (room) =>
          room.isActive &&
          !room.activeStay &&
          !selectedProperty.maintenanceRequests.some(
            (request) => request.roomId === room.id,
          ),
      ) ?? [],
    [selectedProperty?.maintenanceRequests, selectedProperty?.rooms],
  );
  const activeRoomCount =
    selectedProperty?.rooms.filter((room) => room.isActive).length ?? 0;
  const occupiedRoomCount = statusCounts.get("occupied") ?? 0;
  const availableRoomCount = statusCounts.get("available") ?? 0;
  const openHousekeepingTaskCount =
    (housekeepingCounts.get("open") ?? 0) +
    (housekeepingCounts.get("in_progress") ?? 0);
  const outOfServiceRoomCount =
    (statusCounts.get("maintenance") ?? 0) +
    (statusCounts.get("out_of_order") ?? 0);
  const occupancyRate = activeRoomCount
    ? Math.round((occupiedRoomCount / activeRoomCount) * 100)
    : 0;

  async function getOrganizationToken() {
    return getToken(
      organization ? { organizationId: organization.id } : undefined,
    );
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
      setError(
        "Select or create a workspace organization before managing properties.",
      );
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/properties`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        setLoadState("error");
        setError(await readApiMessage(response, "Could not load properties."));
        return;
      }

      const payload = (await response.json()) as PropertyResponse;
      setData(payload);
      setSelectedPropertyId(
        (current) => current || payload.properties[0]?.id || "",
      );
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError(
        "Could not reach the Rayaan API. Check that the API and database are running.",
      );
    }
  }

  useEffect(() => {
    void loadProperties();
  }, [getToken, isLoaded, isSignedIn, organization]);

  useEffect(() => {
    const firstRoomTypeId = activeRoomTypes[0]?.id ?? "";
    const activePlans =
      selectedProperty?.ratePlans.filter(
        (ratePlan) => ratePlan.status === "active",
      ) ?? [];
    const firstRatePlanId =
      activePlans.find((ratePlan) => ratePlan.roomTypeId === firstRoomTypeId)
        ?.id ??
      activePlans.find((ratePlan) => !ratePlan.roomTypeId)?.id ??
      "";

    setRatePlanRoomTypeId(firstRoomTypeId);
    setRoomRateRoomTypeId(firstRoomTypeId);
    setLookupRoomTypeId(firstRoomTypeId);
    setRoomRatePlanId(firstRatePlanId);
    setLookupRatePlanId(firstRatePlanId);
    setReservationRoomTypeId(firstRoomTypeId);
    setReservationRatePlanId(firstRatePlanId);
    setReservationAssignedRoomId("");
    setRateQuote(null);
  }, [activeRoomTypes, selectedProperty?.id, selectedProperty?.ratePlans]);

  useEffect(() => {
    setLookupRatePlanId((current) =>
      current && lookupRatePlans.some((ratePlan) => ratePlan.id === current)
        ? current
        : (lookupRatePlans[0]?.id ?? ""),
    );
  }, [lookupRatePlans]);

  useEffect(() => {
    setRoomRatePlanId((current) =>
      current && roomRatePlans.some((ratePlan) => ratePlan.id === current)
        ? current
        : (roomRatePlans[0]?.id ?? ""),
    );
  }, [roomRatePlans]);

  useEffect(() => {
    setReservationRatePlanId((current) =>
      current &&
      reservationRatePlans.some((ratePlan) => ratePlan.id === current)
        ? current
        : (reservationRatePlans[0]?.id ?? ""),
    );
  }, [reservationRatePlans]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setError(
        "Select or create a workspace organization before creating a property.",
      );
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties`,
      {
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
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create property."));
      return;
    }

    setPropertyName("");
    await loadProperties();
  }

  async function updatePropertySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const propertyId = selectedProperty?.id;

    if (!propertyId) {
      setError("Select a property before updating property settings.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setError(
        "Select or create a workspace organization before updating settings.",
      );
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/settings`,
      {
        body: JSON.stringify({
          earlyCheckInBeforeTime: earlyCheckInBeforeTime || undefined,
          earlyCheckInFeeType,
          earlyCheckInFeeValue,
          lateCheckoutAfterTime: lateCheckoutAfterTime || undefined,
          lateCheckoutFeeType,
          lateCheckoutFeeValue,
          serviceChargeRate: propertyServiceChargeRate,
          taxRate: propertyTaxRate,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(
        await readApiMessage(response, "Could not update property settings."),
      );
      return;
    }

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

  async function saveRoomInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId || !editingRoomId) {
      setError("Choose a room before saving inventory changes.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${editingRoomId}/inventory`,
      {
        body: JSON.stringify({
          number: editingRoomNumber,
          roomTypeId: editingRoomTypeId || undefined,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );
    setIsSubmitting(false);

    if (!response.ok) {
      setError(
        await readApiMessage(response, "Could not update room inventory."),
      );
      return;
    }

    await loadProperties();
  }

  async function setRoomActive(roomId: string, isActive: boolean) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;
    if (!token || !propertyId) return;

    setIsSubmitting(true);
    setError(null);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/inventory`,
      {
        body: JSON.stringify({ isActive }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );
    setIsSubmitting(false);

    if (!response.ok) {
      setError(
        await readApiMessage(
          response,
          isActive ? "Could not reactivate room." : "Could not archive room.",
        ),
      );
      return;
    }

    await loadProperties();
  }

  async function setRoomTypeActive(
    roomType: PropertyResponse["properties"][number]["roomTypes"][number],
    isActive: boolean,
  ) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;
    if (!token || !propertyId) return;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/room-types/${roomType.id}`,
      {
        body: JSON.stringify({
          baseOccupancy: roomType.baseOccupancy,
          code: roomType.code,
          defaultRate: roomType.defaultRate ?? undefined,
          isActive,
          maxOccupancy: roomType.maxOccupancy ?? undefined,
          name: roomType.name,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update room type."));
      return;
    }

    await loadProperties();
  }

  async function setRatePlanActive(
    ratePlan: PropertyResponse["properties"][number]["ratePlans"][number],
    status: "active" | "inactive",
  ) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;
    if (!token || !propertyId) return;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rate-plans/${ratePlan.id}`,
      {
        body: JSON.stringify({
          baseOccupancy: ratePlan.baseOccupancy,
          code: ratePlan.code,
          defaultRate: ratePlan.defaultRate ?? undefined,
          extraGuestRate: ratePlan.extraGuestRate,
          minNights: ratePlan.minNights,
          name: ratePlan.name,
          roomTypeId: ratePlan.roomTypeId ?? undefined,
          status,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not update rate plan."));
      return;
    }

    await loadProperties();
  }
  async function saveRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before saving a room type.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/room-types${editingRoomTypeRecordId ? `/${editingRoomTypeRecordId}` : ""}`,
      {
        body: JSON.stringify({
          baseOccupancy: Number(roomTypeBaseOccupancy),
          code: roomTypeCode || undefined,
          defaultRate: roomTypeDefaultRate || undefined,
          maxOccupancy: roomTypeMaxOccupancy
            ? Number(roomTypeMaxOccupancy)
            : undefined,
          name: roomTypeName,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: editingRoomTypeRecordId ? "PATCH" : "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not save room type."));
      return;
    }

    setRoomTypeName("");
    setRoomTypeCode("");
    setRoomTypeDefaultRate("");
    setRoomTypeBaseOccupancy("1");
    setRoomTypeMaxOccupancy("");
    setEditingRoomTypeRecordId("");
    await loadProperties();
  }

  async function createRatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before creating a rate plan.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rate-plans${editingRatePlanId ? `/${editingRatePlanId}` : ""}`,
      {
        body: JSON.stringify({
          defaultRate: ratePlanDefaultRate || undefined,
          extraGuestRate: ratePlanExtraGuestRate || "0",
          minNights: Number(ratePlanMinNights),
          name: ratePlanName,
          roomTypeId: ratePlanRoomTypeId || undefined,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: editingRatePlanId ? "PATCH" : "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not create rate plan."));
      return;
    }

    setRatePlanName("");
    setRatePlanRoomTypeId("");
    setRatePlanDefaultRate("");
    setRatePlanExtraGuestRate("0");
    setRatePlanMinNights("1");
    setEditingRatePlanId("");
    await loadProperties();
  }

  async function createRoomRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before creating a room rate.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/room-rates`,
      {
        body: JSON.stringify({
          baseRate: roomRateBaseRate,
          endDate: roomRateEndDate,
          extraGuestRate: roomRateExtraGuestRate || "0",
          ratePlanId: roomRatePlanId,
          roomTypeId: roomRateRoomTypeId,
          startDate: roomRateStartDate,
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
      setError(await readApiMessage(response, "Could not create room rate."));
      return;
    }

    setRoomRateBaseRate("");
    setRoomRateExtraGuestRate("0");
    setRoomRateEndDate("");
    setRoomRateStartDate("");
    await loadProperties();
  }

  async function lookupRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setRateQuote(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before looking up a rate.");
      setIsSubmitting(false);
      return;
    }

    const params = new URLSearchParams({
      arrivalDate: lookupArrivalDate,
      departureDate: lookupDepartureDate,
      guestCount: lookupGuestCount || "1",
      roomTypeId: lookupRoomTypeId,
    });

    if (lookupRatePlanId) {
      params.set("ratePlanId", lookupRatePlanId);
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rates/lookup?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not look up rate."));
      return;
    }

    setRateQuote((await response.json()) as RateLookupResponse);
  }

  async function createHotelReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before creating a reservation.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/hotel-reservations`,
      {
        body: JSON.stringify({
          adultCount: Number(reservationAdultCount),
          arrivalDate: reservationArrivalDate,
          assignedRoomId: reservationAssignedRoomId || undefined,
          childCount: Number(reservationChildCount),
          complimentaryReason:
            data?.canManageProperties && reservationIsComplimentary
              ? reservationComplimentaryReason || undefined
              : undefined,
          departureDate: reservationDepartureDate,
          depositRequiredAmount: reservationDepositRequired || undefined,
          guestEmail: reservationGuestEmail || undefined,
          guestName: reservationGuestName,
          guestPhone: reservationGuestPhone || undefined,
          isComplimentary:
            data?.canManageProperties && reservationIsComplimentary
              ? true
              : undefined,
          notes: reservationNotes || undefined,
          rateOverride:
            data?.canManageProperties &&
            !reservationIsComplimentary &&
            reservationRateOverride
              ? reservationRateOverride
              : undefined,
          ratePlanId: reservationRatePlanId || undefined,
          roomTypeId: reservationRoomTypeId,
          source: reservationSource,
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
    setReservationGuestPhone("");
    setReservationGuestEmail("");
    setReservationArrivalDate("");
    setReservationDepartureDate("");
    setReservationAssignedRoomId("");
    setReservationDepositRequired("");
    setReservationRateOverride("");
    setReservationIsComplimentary(false);
    setReservationComplimentaryReason("");
    setReservationNotes("");
    await loadProperties();
  }

  async function updateHotelReservationStatus(
    reservationId: string,
    status: string,
  ) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before updating a reservation.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/hotel-reservations/${reservationId}/status`,
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
      setError(await readApiMessage(response, "Could not update reservation."));
      return;
    }

    await loadProperties();
  }

  async function checkInReservation(reservationId: string, roomId: string) {
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before checking in a reservation.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/check-in`,
      {
        body: JSON.stringify({ reservationId }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": createIdempotencyKey(
            `hotel-check-in:${propertyId}:${roomId}:${reservationId}`,
          ),
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(
        await readApiMessage(response, "Could not check in reservation."),
      );
      return;
    }

    await loadProperties();
    setActiveWorkspaceTab("rooms");
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

  async function updateHousekeepingTask(taskId: string, status: string) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before updating housekeeping.");
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/housekeeping-tasks/${taskId}`,
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
      setError(
        await readApiMessage(response, "Could not update housekeeping task."),
      );
      return;
    }

    await loadProperties();
  }

  async function createMaintenanceRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId || !maintenanceRoomId) {
      setError("Choose a room before creating a maintenance request.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/maintenance-requests`,
        {
          body: JSON.stringify({
            notes: maintenanceNotes || undefined,
            priority: maintenancePriority,
            reason: maintenanceReason,
            roomId: maintenanceRoomId,
            roomStatus: maintenanceRoomStatus,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        setError(
          await readApiMessage(
            response,
            "Could not create maintenance request.",
          ),
        );
        return;
      }

      setMaintenanceRoomId("");
      setMaintenanceReason("");
      setMaintenancePriority("normal");
      setMaintenanceRoomStatus("maintenance");
      setMaintenanceNotes("");
      await loadProperties();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateMaintenanceRequest(requestId: string, status: string) {
    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before updating maintenance.");
      return;
    }

    const resolutionNotes = maintenanceResolutionNotes[requestId]?.trim();

    if (status === "resolved" && !resolutionNotes) {
      setError("Add resolution notes before releasing the room.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/maintenance-requests/${requestId}`,
        {
          body: JSON.stringify({
            resolutionNotes: resolutionNotes || undefined,
            status,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        setError(
          await readApiMessage(
            response,
            "Could not update maintenance request.",
          ),
        );
        return;
      }

      setMaintenanceResolutionNotes((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });
      await loadProperties();
    } finally {
      setIsSubmitting(false);
    }
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
          reservationId: undefined,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": createIdempotencyKey(
            `hotel-walk-in:${propertyId}:${checkInRoomId}`,
          ),
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

  async function checkOutGuest(
    roomId: string,
    acknowledgeRestaurantCharges = false,
    excessDepositAction?: "refund" | "carry_forward",
  ) {
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before checking out a guest.");
      setIsSubmitting(false);
      return;
    }

    const checkoutKey = createIdempotencyKey(
      `hotel-check-out:${propertyId}:${roomId}`,
    );
    const acknowledgedCheckoutKey = createIdempotencyKey(
      `hotel-check-out-confirmed:${propertyId}:${roomId}`,
    );

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/check-out`,
      {
        body: acknowledgeRestaurantCharges
          ? JSON.stringify({
              acknowledgeExtraNightCharges: true,
              acknowledgeRestaurantCharges: true,
              ...(excessDepositAction ? { excessDepositAction } : {}),
            })
          : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": acknowledgeRestaurantCharges
            ? acknowledgedCheckoutKey
            : checkoutKey,
          ...(acknowledgeRestaurantCharges
            ? { "Content-Type": "application/json" }
            : {}),
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const message = await readApiMessage(
        response,
        "Could not check out guest.",
      );

      setError(message);
      setIsSubmitting(false);
      return;
    }

    setCheckoutReview(null);
    setIsSubmitting(false);
    await loadProperties();
    if (selectedFolioId) {
      await loadFolio(selectedFolioId);
    }
  }

  async function previewCheckout(roomId: string) {
    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();
    const propertyId = selectedProperty?.id;

    if (!token || !propertyId) {
      setError("Choose a property before previewing checkout.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties/${propertyId}/rooms/${roomId}/checkout-preview`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not preview checkout."));
      return;
    }

    setCheckoutReview({
      preview: (await response.json()) as CheckoutPreviewResponse,
      roomId,
    });
  }

  async function loadFolio(folioId: string) {
    const token = await getOrganizationToken();

    if (!token) {
      setError("Choose a workspace before viewing a folio.");
      return;
    }

    setSelectedFolioId(folioId);
    setFolioLoadState("loading");
    setError(null);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/folios/${folioId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      setFolioLoadState("error");
      setError(await readApiMessage(response, "Could not load folio."));
      return;
    }

    setSelectedFolio((await response.json()) as FolioDetailResponse);
    setFolioLoadState("ready");
  }

  async function recalculateRoomCharges() {
    if (!selectedFolioId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setError("Choose a workspace before recalculating room charges.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/folios/${selectedFolioId}/recalculate-room-charges`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setError(
        await readApiMessage(response, "Could not recalculate room charges."),
      );
      return;
    }

    await loadFolio(selectedFolioId);
    await loadProperties();
  }

  async function recordFolioPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFolioId) {
      return;
    }

    const amount = Number(folioPaymentAmount);
    const currentFolioRoomId = selectedFolio?.room.id ?? null;
    const previewRoomId =
      checkoutReview?.roomId === currentFolioRoomId ? currentFolioRoomId : null;
    const isCompanyAccountSettlement = folioPaymentMethod === "company_account";

    if (!Number.isFinite(amount) || amount <= 0) {
      setFolioPaymentError("Enter a payment amount greater than zero.");
      return;
    }

    if (
      isCompanyAccountSettlement &&
      !folioPaymentReference.trim() &&
      !folioPaymentNote.trim()
    ) {
      setFolioPaymentError(
        "Company account settlement requires an approval note or reference.",
      );
      return;
    }

    setIsSubmitting(true);
    setFolioPaymentError(null);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setFolioPaymentError("Choose a workspace before recording a payment.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/folios/${selectedFolioId}/payments`,
      {
        body: JSON.stringify({
          amount,
          method: folioPaymentMethod,
          note: folioPaymentNote || undefined,
          reference: folioPaymentReference || undefined,
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
      setFolioPaymentError(
        await readApiMessage(response, "Could not record folio payment."),
      );
      return;
    }

    setFolioPaymentAmount("");
    setFolioPaymentReference("");
    setFolioPaymentNote("");
    await loadFolio(selectedFolioId);
    await loadProperties();
    if (previewRoomId) {
      await previewCheckout(previewRoomId);
    }
  }

  function printCheckoutReceipt(folio: FolioDetailResponse) {
    if (!folio.invoice) {
      setError("Checkout receipt is available after invoice generation.");
      return;
    }

    const printedAt = new Date().toLocaleString();
    const issuedAt = new Date(folio.invoice.issuedAt).toLocaleString();
    const lineRows = folio.invoice.lineItems
      .map(
        (item) => `
          <tr>
            <td>
              <strong>${escapeHtml(item.description)}</strong>
              <span>${escapeHtml(formatLabel(item.type))}</span>
            </td>
            <td>${escapeHtml(formatMoney(item.amount, item.currency))}</td>
          </tr>
        `,
      )
      .join("");
    const paymentRows = folio.invoice.payments
      .map(
        (payment) => `
          <tr>
            <td>
              <strong>${escapeHtml(formatLabel(payment.method))}</strong>
              <span>${escapeHtml(payment.reference ?? "")}</span>
            </td>
            <td>${escapeHtml(formatMoney(payment.amount, payment.currency))}</td>
          </tr>
        `,
      )
      .join("");
    const printWindow = window.open("", "_blank", "width=760,height=900");

    if (!printWindow) {
      setError("Allow popups to print checkout receipts.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(folio.invoice.invoiceNumber)}</title>
          <style>
            body { color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
            header { border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; }
            h1, h2, p { margin: 0; }
            h1 { font-size: 24px; }
            h2 { font-size: 16px; margin-top: 24px; }
            .muted, td span { color: #64748b; display: block; font-size: 12px; margin-top: 4px; }
            table { border-collapse: collapse; margin-top: 12px; width: 100%; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px 0; vertical-align: top; }
            td:last-child { text-align: right; white-space: nowrap; }
            .totals { margin-left: auto; margin-top: 20px; width: 320px; }
            .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
            .total { border-top: 1px solid #cbd5e1; font-size: 18px; font-weight: 700; margin-top: 6px; padding-top: 10px; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>${escapeHtml(folio.property.name)}</h1>
              <p class="muted">Room ${escapeHtml(folio.room.number)} - ${escapeHtml(
                `${folio.guest.firstName} ${folio.guest.lastName}`,
              )}</p>
            </div>
            <div>
              <p><strong>${escapeHtml(folio.invoice.invoiceNumber)}</strong></p>
              <p class="muted">Issued ${escapeHtml(issuedAt)}</p>
              <p class="muted">Printed ${escapeHtml(printedAt)}</p>
            </div>
          </header>
          <h2>Charges</h2>
          <table><tbody>${lineRows}</tbody></table>
          <h2>Payments and credits</h2>
          <table><tbody>${paymentRows || `<tr><td>No payments recorded.</td><td></td></tr>`}</tbody></table>
          <section class="totals">
            <div><span>Charges</span><strong>${escapeHtml(
              formatMoney(folio.invoice.lineItemTotal, folio.invoice.currency),
            )}</strong></div>
            <div><span>Payments</span><strong>${escapeHtml(
              formatMoney(folio.invoice.paymentTotal, folio.invoice.currency),
            )}</strong></div>
            <div class="total"><span>Balance</span><strong>${escapeHtml(
              formatMoney(folio.invoice.balance, folio.invoice.currency),
            )}</strong></div>
          </section>
          <script>
            window.addEventListener("load", () => window.print());
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function reverseFolioLineItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFolioId || !reverseLineItem) {
      return;
    }

    const reason = reverseReason.trim();

    if (reason.length < 3) {
      setReverseError("Enter a reversal reason.");
      return;
    }

    setIsSubmitting(true);
    setReverseError(null);
    setError(null);

    const token = await getOrganizationToken();

    if (!token) {
      setReverseError("Choose a workspace before reversing a folio line.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/folios/${selectedFolioId}/line-items/${reverseLineItem.id}/reverse`,
      {
        body: JSON.stringify({ reason }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setReverseError(
        await readApiMessage(response, "Could not reverse folio line item."),
      );
      return;
    }

    setReverseLineItem(null);
    setReverseReason("");
    await loadFolio(selectedFolioId);
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
        <button
          type="button"
          onClick={loadProperties}
          disabled={loadState === "loading"}
        >
          <RefreshCw aria-hidden="true" />
          {loadState === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <nav aria-label="Hotel workspace" className="workbench-jump-nav">
        {hotelWorkspaceTabs.map((tab) => (
          <button
            data-active={activeWorkspaceTab === tab.id}
            key={tab.id}
            onClick={() => setActiveWorkspaceTab(tab.id)}
            type="button"
          >
            <strong>{tab.label}</strong>
            <span>{tab.description}</span>
          </button>
        ))}
      </nav>

      <section className="status-grid property-stats" id="property-summary">
        <div>
          <span>Properties</span>
          <strong>{data?.properties.length ?? 0}</strong>
        </div>
        <div>
          <span>Rooms</span>
          <strong>
            {data?.properties.reduce(
              (total, property) =>
                total + property.rooms.filter((room) => room.isActive).length,
              0,
            ) ?? 0}
          </strong>
        </div>
        <div>
          <span>Current role</span>
          <strong>
            {data?.currentUser.role.replaceAll("_", " ") ?? "Loading"}
          </strong>
        </div>
        <div>
          <span>Selected property</span>
          <strong>{selectedProperty?.name ?? "None"}</strong>
        </div>
        <div>
          <span>Reservations</span>
          <strong>{selectedProperty?.hotelReservations.length ?? 0}</strong>
        </div>
        <div>
          <span>Housekeeping</span>
          <strong>{openHousekeepingTaskCount}</strong>
        </div>
      </section>

      <section className="property-layout">
        <div className="property-list" id="property-selector">
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
                {property.rooms.filter((room) => room.isActive).length} rooms -{" "}
                {property.roomTypes.length} types - {property.ratePlans.length}{" "}
                plans - {property.currency}
              </small>
            </button>
          ))}

          {!data?.properties.length && loadState !== "loading" ? (
            <div className="empty-state">
              No properties have been created yet.
            </div>
          ) : null}
        </div>

        <div className="property-detail">
          {selectedProperty ? (
            <>
              {activeWorkspaceTab === "overview" ? (
                <section className="notice-panel hotel-dashboard-panel">
                  <div className="rate-management-header">
                    <div>
                      <p className="eyebrow">Hotel dashboard</p>
                      <h2>{selectedProperty.name}</h2>
                    </div>
                    <span>{selectedProperty.currency}</span>
                  </div>

                  <div className="hotel-dashboard-grid">
                    <div className="hotel-kpi-card">
                      <span>Occupancy</span>
                      <strong>{occupancyRate}%</strong>
                      <small>
                        {occupiedRoomCount} occupied of {activeRoomCount} rooms
                      </small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Available</span>
                      <strong>{availableRoomCount}</strong>
                      <small>Ready rooms for walk-ins and assignments</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Reservations</span>
                      <strong>{upcomingReservations.length}</strong>
                      <small>
                        {reservationCounts.get("confirmed") ?? 0} confirmed,{" "}
                        {reservationCounts.get("guaranteed") ?? 0} guaranteed
                      </small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Out of service</span>
                      <strong>{outOfServiceRoomCount}</strong>
                      <small>Maintenance and out-of-order rooms</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Housekeeping</span>
                      <strong>{openHousekeepingTaskCount}</strong>
                      <small>Open room turns after checkout</small>
                    </div>
                  </div>

                  <div className="hotel-overview-workbench">
                    <div className="hotel-overview-column">
                      <div className="rate-form-title">
                        <DoorOpen aria-hidden="true" />
                        <strong>Room status</strong>
                      </div>
                      <div className="room-status-counts">
                        {roomStatuses.map((status) => (
                          <button
                            className="status-filter-button"
                            data-selected={statusFilter === status}
                            key={status}
                            onClick={() => {
                              setStatusFilter(status);
                              setActiveWorkspaceTab("rooms");
                            }}
                            type="button"
                          >
                            <span>{formatLabel(status)}</span>
                            <strong>{statusCounts.get(status) ?? 0}</strong>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="hotel-overview-column">
                      <div className="rate-form-title">
                        <ClipboardList aria-hidden="true" />
                        <strong>Next arrivals</strong>
                      </div>
                      <div className="hotel-arrival-preview">
                        {upcomingReservations.slice(0, 5).map((reservation) => (
                          <button
                            key={reservation.id}
                            onClick={() =>
                              setActiveWorkspaceTab("reservations")
                            }
                            type="button"
                          >
                            <strong>{reservation.guestName}</strong>
                            <span>
                              {new Date(
                                reservation.arrivalDate,
                              ).toLocaleDateString()}{" "}
                              - {reservation.roomType.name}
                            </span>
                          </button>
                        ))}
                        {!upcomingReservations.length ? (
                          <div className="empty-state">
                            No hotel reservations created yet.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeWorkspaceTab === "rooms" ? (
                <section
                  className="notice-panel property-detail-card"
                  id="room-inventory"
                >
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
                          onChange={(event) =>
                            setStatusFilter(event.target.value)
                          }
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
                          onChange={(event) =>
                            setTypeFilter(event.target.value)
                          }
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
                      <div
                        className="room-card"
                        data-status={room.status}
                        key={room.id}
                      >
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
                              {new Date(
                                room.activeStay.checkInAt,
                              ).toLocaleDateString()}
                            </span>
                            {room.activeStay.folio ? (
                              <span>
                                Folio{" "}
                                {formatLabel(room.activeStay.folio.status)}:{" "}
                                {formatMoney(
                                  room.activeStay.folio.balance,
                                  room.activeStay.folio.currency,
                                )}
                              </span>
                            ) : null}
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
                          <div className="room-action-row">
                            <button
                              className="secondary-button"
                              disabled={folioLoadState === "loading"}
                              onClick={() =>
                                loadFolio(room.activeStay?.folioId ?? "")
                              }
                              type="button"
                            >
                              View folio
                            </button>
                            <button
                              className="secondary-button"
                              disabled={isSubmitting}
                              onClick={() => previewCheckout(room.id)}
                              type="button"
                            >
                              Check out
                            </button>
                          </div>
                        ) : null}
                        {checkoutReview?.roomId === room.id ? (
                          <div className="checkout-review">
                            <strong>Checkout preview</strong>
                            <div className="checkout-preview-grid">
                              <span>
                                Balance
                                <strong>
                                  {formatMoney(
                                    checkoutReview.preview.folioBalance,
                                    checkoutReview.preview.currency,
                                  )}
                                </strong>
                              </span>
                              <span>
                                Payments
                                <strong>
                                  {formatMoney(
                                    checkoutReview.preview.paymentTotal,
                                    checkoutReview.preview.currency,
                                  )}
                                </strong>
                              </span>
                              <span>
                                Deposits
                                <strong>
                                  {formatMoney(
                                    checkoutReview.preview.depositTotal,
                                    checkoutReview.preview.currency,
                                  )}
                                </strong>
                              </span>
                              <span>
                                Credit applied
                                <strong>
                                  {formatMoney(
                                    checkoutReview.preview
                                      .settlementCreditTotal,
                                    checkoutReview.preview.currency,
                                  )}
                                </strong>
                              </span>
                              <span>
                                Amount due
                                <strong>
                                  {formatMoney(
                                    checkoutReview.preview.amountDue,
                                    checkoutReview.preview.currency,
                                  )}
                                </strong>
                              </span>
                            </div>
                            <p>
                              Room nights{" "}
                              {formatMoney(
                                checkoutReview.preview.roomNightTotal,
                                checkoutReview.preview.currency,
                              )}
                              , service charges{" "}
                              {formatMoney(
                                checkoutReview.preview.serviceChargeTotal,
                                checkoutReview.preview.currency,
                              )}
                              , taxes{" "}
                              {formatMoney(
                                checkoutReview.preview.taxTotal,
                                checkoutReview.preview.currency,
                              )}
                              , restaurant room charges{" "}
                              {formatMoney(
                                checkoutReview.preview.restaurantChargeTotal,
                                checkoutReview.preview.currency,
                              )}
                              .
                            </p>
                            {Number(checkoutReview.preview.overpaidAmount) >
                            0 ? (
                              <p>
                                Overpaid amount{" "}
                                {formatMoney(
                                  checkoutReview.preview.overpaidAmount,
                                  checkoutReview.preview.currency,
                                )}{" "}
                                must be refunded or carried forward before
                                checkout closes.
                              </p>
                            ) : null}
                            {Number(checkoutReview.preview.amountDue) > 0 ? (
                              <p>
                                Settle{" "}
                                {formatMoney(
                                  checkoutReview.preview.amountDue,
                                  checkoutReview.preview.currency,
                                )}{" "}
                                before final checkout.
                              </p>
                            ) : null}
                            {checkoutReview.preview.extraNightCount > 0 ? (
                              <p>
                                Includes{" "}
                                {checkoutReview.preview.extraNightCount} extra
                                room night
                                {checkoutReview.preview.extraNightCount === 1
                                  ? ""
                                  : "s"}{" "}
                                totaling{" "}
                                {formatMoney(
                                  checkoutReview.preview.extraNightChargeTotal,
                                  checkoutReview.preview.currency,
                                )}
                                .
                              </p>
                            ) : null}
                            <div className="checkout-review-actions">
                              <button
                                className="secondary-button"
                                disabled={isSubmitting}
                                onClick={() => setCheckoutReview(null)}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={
                                  isSubmitting ||
                                  Number(checkoutReview.preview.amountDue) > 0
                                }
                                onClick={() => {
                                  const overpaidAmount = Number(
                                    checkoutReview.preview.overpaidAmount,
                                  );

                                  checkOutGuest(
                                    room.id,
                                    true,
                                    overpaidAmount > 0
                                      ? "carry_forward"
                                      : undefined,
                                  );
                                }}
                                type="button"
                              >
                                {Number(checkoutReview.preview.overpaidAmount) >
                                0
                                  ? "Carry forward and checkout"
                                  : "Confirm checkout"}
                              </button>
                              {Number(checkoutReview.preview.overpaidAmount) >
                              0 ? (
                                <button
                                  disabled={
                                    isSubmitting ||
                                    Number(checkoutReview.preview.amountDue) > 0
                                  }
                                  onClick={() =>
                                    checkOutGuest(room.id, true, "refund")
                                  }
                                  type="button"
                                >
                                  Refund and checkout
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {data?.canManageStays && !room.activeStay ? (
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setCheckInRoomId((current) => {
                                if (current === room.id) {
                                  return "";
                                }

                                setExpectedCheckOutAt(
                                  (currentDate) =>
                                    currentDate || earliestExpectedCheckOutDate,
                                );

                                return room.id;
                              });
                            }}
                            type="button"
                          >
                            {checkInRoomId === room.id ? "Cancel" : "Check in"}
                          </button>
                        ) : null}
                        {checkInRoomId === room.id ? (
                          <form
                            className="check-in-form"
                            onSubmit={checkInGuest}
                          >
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
                                onChange={(event) =>
                                  setGuestPhone(event.target.value)
                                }
                                value={guestPhone}
                              />
                            </label>
                            <label>
                              Email
                              <input
                                onChange={(event) =>
                                  setGuestEmail(event.target.value)
                                }
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
                                min={earliestExpectedCheckOutDate}
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

                  {selectedFolio ? (
                    <section className="folio-detail-panel">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">Folio</p>
                          <h3>
                            Room {selectedFolio.room.number} -{" "}
                            {selectedFolio.guest.firstName}{" "}
                            {selectedFolio.guest.lastName}
                          </h3>
                        </div>
                        <div className="room-action-row">
                          {selectedFolio.invoice ? (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                printCheckoutReceipt(selectedFolio)
                              }
                              type="button"
                            >
                              <Printer aria-hidden="true" />
                              Print receipt
                            </button>
                          ) : null}
                          {data?.canManageProperties &&
                          selectedFolio.status === "open" ? (
                            <button
                              className="secondary-button"
                              disabled={isSubmitting}
                              onClick={recalculateRoomCharges}
                              type="button"
                            >
                              Recalculate room charges
                            </button>
                          ) : null}
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setSelectedFolio(null);
                              setSelectedFolioId("");
                              setFolioLoadState("idle");
                            }}
                            type="button"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="folio-summary-grid">
                        <div>
                          <span>Status</span>
                          <strong>{formatLabel(selectedFolio.status)}</strong>
                        </div>
                        <div>
                          <span>Balance</span>
                          <strong>
                            {formatMoney(
                              selectedFolio.balance,
                              selectedFolio.currency,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Line items</span>
                          <strong>
                            {formatMoney(
                              selectedFolio.lineItemTotal,
                              selectedFolio.currency,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Payments</span>
                          <strong>
                            {formatMoney(
                              selectedFolio.paymentTotal,
                              selectedFolio.currency,
                            )}
                          </strong>
                        </div>
                      </div>

                      {data?.canManageBilling &&
                      ["open", "pending_checkout"].includes(
                        selectedFolio.status,
                      ) ? (
                        <form
                          className="check-in-form"
                          onSubmit={recordFolioPayment}
                        >
                          <label>
                            Payment amount
                            <input
                              min="0.01"
                              onChange={(event) =>
                                setFolioPaymentAmount(event.target.value)
                              }
                              placeholder={`0.00 ${selectedFolio.currency}`}
                              required
                              step="0.01"
                              type="number"
                              value={folioPaymentAmount}
                            />
                          </label>
                          <label>
                            Method
                            <select
                              onChange={(event) =>
                                setFolioPaymentMethod(event.target.value)
                              }
                              value={folioPaymentMethod}
                            >
                              <option value="cash">Cash</option>
                              <option value="card">Card</option>
                              <option value="mobile_money">Mobile money</option>
                              <option value="bank_transfer">
                                Bank transfer
                              </option>
                              <option value="voucher">Voucher</option>
                              <option value="comp">Comp</option>
                              {["owner", "admin", "accountant"].includes(
                                data.currentUser.role,
                              ) &&
                              selectedFolio.stay.reservationSource ===
                                "corporate" ? (
                                <option value="company_account">
                                  Company account
                                </option>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            Reference
                            <input
                              onChange={(event) =>
                                setFolioPaymentReference(event.target.value)
                              }
                              placeholder="Receipt, transaction, or approval"
                              value={folioPaymentReference}
                            />
                          </label>
                          <label>
                            Note
                            <input
                              onChange={(event) =>
                                setFolioPaymentNote(event.target.value)
                              }
                              placeholder="Optional note"
                              value={folioPaymentNote}
                            />
                          </label>
                          {folioPaymentError ? (
                            <p className="error-text">{folioPaymentError}</p>
                          ) : null}
                          <button disabled={isSubmitting} type="submit">
                            Record payment
                          </button>
                        </form>
                      ) : null}

                      <div className="folio-detail-grid">
                        <div>
                          <h4>Line items</h4>
                          <div className="folio-row-list">
                            {selectedFolio.lineItems
                              .filter((item) => !item.voidedAt)
                              .map((item) => (
                                <div className="folio-row" key={item.id}>
                                  <div>
                                    <strong>
                                      {formatFolioLineTitle(item)}
                                    </strong>
                                    <span className="folio-row-meta">
                                      {formatFolioLineMeta(item)}
                                    </span>
                                    {item.restaurantCharge ? (
                                      <span className="folio-row-submeta">
                                        {formatMoney(
                                          item.restaurantCharge.totalAmount,
                                          item.restaurantCharge.totalCurrency,
                                        )}{" "}
                                        restaurant order
                                        {item.restaurantCharge.paymentStatus
                                          ? ` - ${formatLabel(
                                              item.restaurantCharge
                                                .paymentStatus,
                                            )}`
                                          : ""}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="folio-row-actions">
                                    <strong>
                                      {formatMoney(item.amount, item.currency)}
                                    </strong>
                                    {data?.canManageBilling &&
                                    ["open", "pending_checkout"].includes(
                                      selectedFolio.status,
                                    ) ? (
                                      <button
                                        className="folio-reverse-button"
                                        disabled={isSubmitting}
                                        onClick={() => {
                                          setReverseLineItem(item);
                                          setReverseReason("");
                                          setReverseError(null);
                                        }}
                                        type="button"
                                      >
                                        <RotateCcw aria-hidden="true" />
                                        Reverse
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            {!selectedFolio.lineItems.some(
                              (item) => !item.voidedAt,
                            ) ? (
                              <div className="empty-state">
                                No folio line items yet.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <h4>Payments, adjustments, and legacy charges</h4>
                          <div className="folio-row-list">
                            {selectedFolio.payments.map((payment) => (
                              <div className="folio-row" key={payment.id}>
                                <div>
                                  <strong>{formatLabel(payment.method)}</strong>
                                  <span>{formatLabel(payment.status)}</span>
                                </div>
                                <strong>
                                  {formatMoney(
                                    payment.amount,
                                    payment.currency,
                                  )}
                                </strong>
                              </div>
                            ))}
                            {selectedFolio.adjustments.map((adjustment) => (
                              <div className="folio-row" key={adjustment.id}>
                                <div>
                                  <strong>Folio adjustment</strong>
                                  <span>{adjustment.reason}</span>
                                  <span className="folio-row-submeta">
                                    {formatLabel(adjustment.status)}
                                  </span>
                                </div>
                                <strong>
                                  {formatMoney(
                                    adjustment.amount,
                                    adjustment.currency,
                                  )}
                                </strong>
                              </div>
                            ))}
                            {selectedFolio.legacyCharges
                              .filter((charge) => !charge.supersededByLineItem)
                              .map((charge) => (
                                <div className="folio-row" key={charge.id}>
                                  <div>
                                    <strong>{charge.description}</strong>
                                    <span>Legacy room charge</span>
                                  </div>
                                  <strong>
                                    {formatMoney(
                                      charge.amount,
                                      charge.currency,
                                    )}
                                  </strong>
                                </div>
                              ))}
                            {!selectedFolio.payments.length &&
                            !selectedFolio.adjustments.length &&
                            !selectedFolio.legacyCharges.some(
                              (charge) => !charge.supersededByLineItem,
                            ) ? (
                              <div className="empty-state">
                                No payments, adjustments, or legacy charges yet.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : folioLoadState === "loading" ? (
                    <div className="empty-state">Loading folio...</div>
                  ) : null}

                  {reverseLineItem ? (
                    <div className="modal-backdrop">
                      <section className="reservation-modal folio-reversal-modal">
                        <div className="reservation-modal-header">
                          <p className="eyebrow">Folio reversal</p>
                          <h3>{formatFolioLineTitle(reverseLineItem)}</h3>
                          <p>
                            {formatMoney(
                              reverseLineItem.amount,
                              reverseLineItem.currency,
                            )}{" "}
                            will be reversed with an audit adjustment.
                          </p>
                        </div>
                        <form
                          className="reservation-modal-body"
                          onSubmit={reverseFolioLineItem}
                        >
                          <label className="folio-reversal-reason">
                            Reversal reason
                            <textarea
                              maxLength={240}
                              onChange={(event) =>
                                setReverseReason(event.target.value)
                              }
                              placeholder="Guest disputed the restaurant charge"
                              required
                              value={reverseReason}
                            />
                          </label>
                          {reverseError ? (
                            <div className="form-error">{reverseError}</div>
                          ) : null}
                          <div className="checkout-review-actions">
                            <button
                              className="danger-button"
                              disabled={isSubmitting}
                              type="submit"
                            >
                              <RotateCcw aria-hidden="true" />
                              Reverse line
                            </button>
                            <button
                              className="secondary-button"
                              disabled={isSubmitting}
                              onClick={() => {
                                setReverseLineItem(null);
                                setReverseReason("");
                                setReverseError(null);
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </section>
                    </div>
                  ) : null}

                  {!activeRoomCount ? (
                    <div className="empty-state">No rooms added yet.</div>
                  ) : null}

                  {activeRoomCount && !filteredRooms.length ? (
                    <div className="empty-state">
                      No rooms match these filters.
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activeWorkspaceTab === "housekeeping" ? (
                <section
                  className="notice-panel property-detail-card"
                  id="housekeeping-board"
                >
                  <p className="eyebrow">Housekeeping</p>
                  <h2>{selectedProperty.name}</h2>
                  <p>
                    Track checkout cleaning, mark rooms done, and release rooms
                    after inspection.
                  </p>

                  <div className="hotel-dashboard-grid">
                    <div className="hotel-kpi-card">
                      <span>Open</span>
                      <strong>{housekeepingCounts.get("open") ?? 0}</strong>
                      <small>Waiting for assignment or pickup</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>In progress</span>
                      <strong>
                        {housekeepingCounts.get("in_progress") ?? 0}
                      </strong>
                      <small>Rooms currently being cleaned</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Ready to inspect</span>
                      <strong>{housekeepingCounts.get("done") ?? 0}</strong>
                      <small>Supervisor release needed</small>
                    </div>
                  </div>

                  <div className="rate-list">
                    {selectedProperty.housekeepingTasks.map((task) => (
                      <article className="rate-list-item" key={task.id}>
                        <div>
                          <strong>Room {task.room.number}</strong>
                          <span>
                            {formatLabel(task.type)} -{" "}
                            {formatLabel(task.status)} -{" "}
                            {formatLabel(task.priority)}
                          </span>
                          <small>
                            {task.reason ?? "Housekeeping task"} -{" "}
                            {task.room.type} - Room is{" "}
                            {formatLabel(task.room.status)}
                          </small>
                          {task.completedAt ? (
                            <small>
                              Done {new Date(task.completedAt).toLocaleString()}
                            </small>
                          ) : null}
                          {task.inspectedAt ? (
                            <small>
                              Inspected{" "}
                              {new Date(task.inspectedAt).toLocaleString()}
                            </small>
                          ) : null}
                        </div>
                        <div className="room-action-row">
                          {task.status === "open" ? (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                updateHousekeepingTask(task.id, "in_progress")
                              }
                              type="button"
                            >
                              Start
                            </button>
                          ) : null}
                          {["open", "in_progress"].includes(task.status) ? (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                updateHousekeepingTask(task.id, "done")
                              }
                              type="button"
                            >
                              Mark done
                            </button>
                          ) : null}
                          {task.status === "done" ? (
                            <button
                              className="primary-button"
                              onClick={() =>
                                updateHousekeepingTask(task.id, "inspected")
                              }
                              type="button"
                            >
                              Inspect and release
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                    {!selectedProperty.housekeepingTasks.length ? (
                      <div className="empty-state">
                        No active housekeeping tasks yet.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {activeWorkspaceTab === "maintenance" ? (
                <section
                  className="notice-panel property-detail-card"
                  id="maintenance-board"
                >
                  <div className="rate-management-header">
                    <div>
                      <p className="eyebrow">Maintenance</p>
                      <h2>{selectedProperty.name}</h2>
                      <p>
                        Block damaged rooms, prioritize repairs, and release
                        inventory after the work is verified.
                      </p>
                    </div>
                    <span>
                      {(maintenanceCounts.get("open") ?? 0) +
                        (maintenanceCounts.get("in_progress") ?? 0)}{" "}
                      active
                    </span>
                  </div>

                  <div className="hotel-dashboard-grid">
                    <div className="hotel-kpi-card">
                      <span>Open</span>
                      <strong>{maintenanceCounts.get("open") ?? 0}</strong>
                      <small>Waiting for pickup</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>In progress</span>
                      <strong>
                        {maintenanceCounts.get("in_progress") ?? 0}
                      </strong>
                      <small>Repairs underway</small>
                    </div>
                    <div className="hotel-kpi-card">
                      <span>Rooms blocked</span>
                      <strong>{outOfServiceRoomCount}</strong>
                      <small>Maintenance or out of order</small>
                    </div>
                  </div>

                  {data?.canManageMaintenance ? (
                    <form
                      className="setup-form"
                      onSubmit={createMaintenanceRequest}
                    >
                      <div className="rate-form-title">
                        <strong>New maintenance request</strong>
                      </div>
                      <div className="field-grid">
                        <label>
                          Room
                          <select
                            onChange={(event) =>
                              setMaintenanceRoomId(event.target.value)
                            }
                            required
                            value={maintenanceRoomId}
                          >
                            <option value="">Select room</option>
                            {maintenanceCandidateRooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.number} - {room.type} -{" "}
                                {formatLabel(room.status)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Priority
                          <select
                            onChange={(event) =>
                              setMaintenancePriority(event.target.value)
                            }
                            value={maintenancePriority}
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </label>
                        <label>
                          Room status
                          <select
                            onChange={(event) =>
                              setMaintenanceRoomStatus(event.target.value)
                            }
                            value={maintenanceRoomStatus}
                          >
                            <option value="maintenance">Maintenance</option>
                            <option value="out_of_order">Out of order</option>
                          </select>
                        </label>
                        <label>
                          Reason
                          <input
                            maxLength={240}
                            onChange={(event) =>
                              setMaintenanceReason(event.target.value)
                            }
                            placeholder="Air conditioner is not cooling"
                            required
                            value={maintenanceReason}
                          />
                        </label>
                      </div>
                      <label>
                        Notes
                        <textarea
                          maxLength={500}
                          onChange={(event) =>
                            setMaintenanceNotes(event.target.value)
                          }
                          placeholder="Access instructions, parts required, or safety notes"
                          rows={3}
                          value={maintenanceNotes}
                        />
                      </label>
                      <button
                        className="primary-button"
                        disabled={
                          isSubmitting || !maintenanceCandidateRooms.length
                        }
                        type="submit"
                      >
                        <Plus aria-hidden="true" />
                        Create request
                      </button>
                      {!maintenanceCandidateRooms.length ? (
                        <small>
                          No vacant rooms are currently eligible for a new
                          maintenance request.
                        </small>
                      ) : null}
                    </form>
                  ) : (
                    <div className="empty-state">
                      Maintenance staff or property managers can update this
                      board.
                    </div>
                  )}

                  <div className="rate-list">
                    {selectedProperty.maintenanceRequests.map((request) => (
                      <article className="rate-list-item" key={request.id}>
                        <div>
                          <strong>Room {request.room.number}</strong>
                          <span>
                            {formatLabel(request.status)} -{" "}
                            {formatLabel(request.priority)} -{" "}
                            {formatLabel(request.roomStatus)}
                          </span>
                          <small>{request.reason}</small>
                          {request.notes ? (
                            <small>{request.notes}</small>
                          ) : null}
                          <small>
                            Reported{" "}
                            {new Date(request.createdAt).toLocaleString()}
                          </small>
                        </div>
                        {data?.canManageMaintenance ? (
                          <div className="room-action-row">
                            {request.status === "open" ? (
                              <button
                                className="secondary-button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  updateMaintenanceRequest(
                                    request.id,
                                    "in_progress",
                                  )
                                }
                                type="button"
                              >
                                Start repair
                              </button>
                            ) : null}
                            <label>
                              Resolution notes
                              <input
                                maxLength={500}
                                onChange={(event) =>
                                  setMaintenanceResolutionNotes((current) => ({
                                    ...current,
                                    [request.id]: event.target.value,
                                  }))
                                }
                                placeholder="Repair completed and tested"
                                value={
                                  maintenanceResolutionNotes[request.id] ?? ""
                                }
                              />
                            </label>
                            <button
                              className="secondary-button"
                              disabled={isSubmitting}
                              onClick={() =>
                                updateMaintenanceRequest(
                                  request.id,
                                  "cancelled",
                                )
                              }
                              type="button"
                            >
                              Cancel request
                            </button>{" "}
                            <button
                              className="primary-button"
                              disabled={isSubmitting}
                              onClick={() =>
                                updateMaintenanceRequest(request.id, "resolved")
                              }
                              type="button"
                            >
                              Resolve and release
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                    {!selectedProperty.maintenanceRequests.length ? (
                      <div className="empty-state">
                        No active maintenance requests.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {activeWorkspaceTab === "reservations" && data?.canManageStays ? (
                <section
                  className="notice-panel reservation-management"
                  id="hotel-reservations"
                >
                  <div className="rate-management-header">
                    <div>
                      <p className="eyebrow">Hotel reservations</p>
                      <h2>Arrival book</h2>
                    </div>
                    <span>{upcomingReservations.length} active</span>
                  </div>

                  <div className="reservation-workbench">
                    <form
                      className="reservation-booking-form"
                      onSubmit={createHotelReservation}
                    >
                      <div className="rate-form-title">
                        <ClipboardList aria-hidden="true" />
                        <strong>New reservation</strong>
                      </div>
                      <label>
                        Guest
                        <input
                          onChange={(event) =>
                            setReservationGuestName(event.target.value)
                          }
                          placeholder="Ayaan Mohamed"
                          required
                          value={reservationGuestName}
                        />
                      </label>
                      <div className="rate-field-row">
                        <label>
                          Phone
                          <input
                            onChange={(event) =>
                              setReservationGuestPhone(event.target.value)
                            }
                            value={reservationGuestPhone}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            onChange={(event) =>
                              setReservationGuestEmail(event.target.value)
                            }
                            type="email"
                            value={reservationGuestEmail}
                          />
                        </label>
                      </div>
                      <div className="rate-field-row">
                        <label>
                          Arrival
                          <input
                            onChange={(event) =>
                              setReservationArrivalDate(event.target.value)
                            }
                            required
                            type="date"
                            value={reservationArrivalDate}
                          />
                        </label>
                        <label>
                          Departure
                          <input
                            onChange={(event) =>
                              setReservationDepartureDate(event.target.value)
                            }
                            required
                            type="date"
                            value={reservationDepartureDate}
                          />
                        </label>
                      </div>
                      <div className="rate-field-row">
                        <label>
                          Adults
                          <input
                            inputMode="numeric"
                            onChange={(event) =>
                              setReservationAdultCount(event.target.value)
                            }
                            required
                            value={reservationAdultCount}
                          />
                        </label>
                        <label>
                          Children
                          <input
                            inputMode="numeric"
                            onChange={(event) =>
                              setReservationChildCount(event.target.value)
                            }
                            required
                            value={reservationChildCount}
                          />
                        </label>
                      </div>
                      <label>
                        Room type
                        <select
                          onChange={(event) => {
                            setReservationRoomTypeId(event.target.value);
                            setReservationAssignedRoomId("");
                          }}
                          required
                          value={reservationRoomTypeId}
                        >
                          <option value="">Choose type</option>
                          {activeRoomTypes.map((roomType) => (
                            <option key={roomType.id} value={roomType.id}>
                              {roomType.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rate-field-row">
                        <label>
                          Room
                          <select
                            onChange={(event) =>
                              setReservationAssignedRoomId(event.target.value)
                            }
                            value={reservationAssignedRoomId}
                          >
                            <option value="">Assign later</option>
                            {assignableRooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.number}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Plan
                          <select
                            onChange={(event) =>
                              setReservationRatePlanId(event.target.value)
                            }
                            value={reservationRatePlanId}
                          >
                            <option value="">Automatic</option>
                            {reservationRatePlans.map((ratePlan) => (
                              <option key={ratePlan.id} value={ratePlan.id}>
                                {ratePlan.name}
                                {ratePlan.roomType ? "" : " (all types)"}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="rate-field-row">
                        <label>
                          Source
                          <select
                            onChange={(event) =>
                              setReservationSource(event.target.value)
                            }
                            value={reservationSource}
                          >
                            <option value="walk_in">Walk-in</option>
                            <option value="phone">Phone</option>
                            <option value="direct">Direct</option>
                            <option value="ota">OTA</option>
                            <option value="corporate">Corporate</option>
                          </select>
                        </label>
                        <label>
                          Deposit due
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setReservationDepositRequired(event.target.value)
                            }
                            value={reservationDepositRequired}
                          />
                        </label>
                      </div>
                      {data?.canManageProperties ? (
                        <>
                          <label className="checkbox-label">
                            <input
                              checked={reservationIsComplimentary}
                              onChange={(event) => {
                                setReservationIsComplimentary(
                                  event.target.checked,
                                );
                                if (event.target.checked) {
                                  setReservationRateOverride("");
                                }
                              }}
                              type="checkbox"
                            />
                            Complimentary stay
                          </label>
                          {reservationIsComplimentary ? (
                            <label>
                              Complimentary reason
                              <input
                                onChange={(event) =>
                                  setReservationComplimentaryReason(
                                    event.target.value,
                                  )
                                }
                                value={reservationComplimentaryReason}
                              />
                            </label>
                          ) : (
                            <label>
                              Rate override
                              <input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setReservationRateOverride(event.target.value)
                                }
                                placeholder={selectedProperty.currency}
                                value={reservationRateOverride}
                              />
                            </label>
                          )}
                        </>
                      ) : null}
                      <label>
                        Notes
                        <input
                          onChange={(event) =>
                            setReservationNotes(event.target.value)
                          }
                          value={reservationNotes}
                        />
                      </label>
                      <button disabled={isSubmitting} type="submit">
                        <Plus aria-hidden="true" />
                        Create reservation
                      </button>
                    </form>

                    <div className="reservation-arrival-list">
                      {upcomingReservations.map((reservation) => (
                        <div className="reservation-row" key={reservation.id}>
                          <div>
                            <strong>{reservation.guestName}</strong>
                            <span>{reservation.confirmationCode}</span>
                          </div>
                          <div>
                            <span>
                              {new Date(
                                reservation.arrivalDate,
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(
                                reservation.departureDate,
                              ).toLocaleDateString()}
                            </span>
                            <small>
                              {reservation.roomType.name}
                              {reservation.assignedRoom
                                ? ` - room ${reservation.assignedRoom.number}`
                                : " - unassigned"}
                            </small>
                          </div>
                          <div>
                            <span>{formatLabel(reservation.source)}</span>
                            <small>
                              {reservation.isComplimentary
                                ? `Complimentary${
                                    reservation.complimentaryReason
                                      ? ` - ${reservation.complimentaryReason}`
                                      : ""
                                  }`
                                : reservation.rateOverride
                                  ? `Override ${formatMoney(
                                      reservation.rateOverride,
                                      reservation.currency,
                                    )}`
                                  : `Deposit ${formatMoney(
                                      reservation.depositRequiredAmount,
                                      reservation.currency,
                                    )}`}
                            </small>
                          </div>
                          <select
                            aria-label={`Status for ${reservation.guestName}`}
                            onChange={(event) =>
                              updateHotelReservationStatus(
                                reservation.id,
                                event.target.value,
                              )
                            }
                            value={reservation.status}
                          >
                            {[
                              "draft",
                              "confirmed",
                              "guaranteed",
                              "checked_in",
                              "checked_out",
                              "cancelled",
                              "no_show",
                            ].map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                          {["confirmed", "guaranteed"].includes(
                            reservation.status,
                          ) && reservation.assignedRoom ? (
                            <button
                              className="secondary-button"
                              disabled={isSubmitting}
                              onClick={() =>
                                checkInReservation(
                                  reservation.id,
                                  reservation.assignedRoom?.id ?? "",
                                )
                              }
                              type="button"
                            >
                              Check in
                            </button>
                          ) : (
                            <small>
                              {reservation.status === "checked_in"
                                ? "In house"
                                : reservation.assignedRoom
                                  ? "Not ready"
                                  : "Assign room"}
                            </small>
                          )}
                        </div>
                      ))}
                      {!upcomingReservations.length ? (
                        <div className="empty-state">
                          No hotel reservations created yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              {activeWorkspaceTab === "setup" && data?.canManageProperties ? (
                <>
                  <section
                    className="notice-panel compact-panel"
                    id="property-charges"
                  >
                    <p className="eyebrow">Property charges</p>
                    <form
                      className="inventory-form"
                      onSubmit={updatePropertySettings}
                    >
                      <label>
                        Service charge %
                        <input
                          inputMode="decimal"
                          min="0"
                          onChange={(event) =>
                            setPropertyServiceChargeRate(event.target.value)
                          }
                          placeholder="10"
                          step="0.01"
                          type="number"
                          value={propertyServiceChargeRate}
                        />
                      </label>
                      <label>
                        Tax %
                        <input
                          inputMode="decimal"
                          min="0"
                          onChange={(event) =>
                            setPropertyTaxRate(event.target.value)
                          }
                          placeholder="16"
                          step="0.01"
                          type="number"
                          value={propertyTaxRate}
                        />
                      </label>
                      <label>
                        Early check-in before
                        <input
                          onChange={(event) =>
                            setEarlyCheckInBeforeTime(event.target.value)
                          }
                          type="time"
                          value={earlyCheckInBeforeTime}
                        />
                      </label>
                      <label>
                        Early fee type
                        <select
                          onChange={(event) =>
                            setEarlyCheckInFeeType(event.target.value)
                          }
                          value={earlyCheckInFeeType}
                        >
                          <option value="none">None</option>
                          <option value="fixed">Fixed</option>
                          <option value="percent">Percent</option>
                        </select>
                      </label>
                      <label>
                        Early fee value
                        <input
                          inputMode="decimal"
                          min="0"
                          onChange={(event) =>
                            setEarlyCheckInFeeValue(event.target.value)
                          }
                          step="0.01"
                          type="number"
                          value={earlyCheckInFeeValue}
                        />
                      </label>
                      <label>
                        Late checkout after
                        <input
                          onChange={(event) =>
                            setLateCheckoutAfterTime(event.target.value)
                          }
                          type="time"
                          value={lateCheckoutAfterTime}
                        />
                      </label>
                      <label>
                        Late fee type
                        <select
                          onChange={(event) =>
                            setLateCheckoutFeeType(event.target.value)
                          }
                          value={lateCheckoutFeeType}
                        >
                          <option value="none">None</option>
                          <option value="fixed">Fixed</option>
                          <option value="percent">Percent</option>
                        </select>
                      </label>
                      <label>
                        Late fee value
                        <input
                          inputMode="decimal"
                          min="0"
                          onChange={(event) =>
                            setLateCheckoutFeeValue(event.target.value)
                          }
                          step="0.01"
                          type="number"
                          value={lateCheckoutFeeValue}
                        />
                      </label>
                      <button disabled={isSubmitting} type="submit">
                        <Tags aria-hidden="true" />
                        Save charges
                      </button>
                    </form>
                  </section>

                  <section
                    className="notice-panel compact-panel"
                    id="add-rooms"
                  >
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
                          onChange={(event) =>
                            setRoomPrefix(event.target.value)
                          }
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
                </>
              ) : null}

              {activeWorkspaceTab === "setup" && data?.canManageProperties ? (
                <section
                  className="notice-panel compact-panel"
                  id="room-inventory-editor"
                >
                  <div className="rate-management-header">
                    <div>
                      <p className="eyebrow">Room inventory</p>
                      <h2>Edit or archive rooms</h2>
                    </div>
                    <span>
                      {
                        selectedProperty.rooms.filter((room) => room.isActive)
                          .length
                      }{" "}
                      active
                    </span>
                  </div>
                  <form className="inventory-form" onSubmit={saveRoomInventory}>
                    <label>
                      Room
                      <select
                        onChange={(event) => {
                          const room = selectedProperty.rooms.find(
                            (candidate) => candidate.id === event.target.value,
                          );
                          setEditingRoomId(event.target.value);
                          setEditingRoomNumber(room?.number ?? "");
                          setEditingRoomTypeId(room?.roomTypeId ?? "");
                        }}
                        value={editingRoomId}
                      >
                        <option value="">Choose room</option>
                        {selectedProperty.rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.number} - {room.roomType?.name ?? room.type}
                            {room.isActive ? "" : " (archived)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Number
                      <input
                        disabled={!editingRoomId}
                        maxLength={24}
                        onChange={(event) =>
                          setEditingRoomNumber(event.target.value)
                        }
                        required
                        value={editingRoomNumber}
                      />
                    </label>
                    <label>
                      Room type
                      <select
                        disabled={!editingRoomId}
                        onChange={(event) =>
                          setEditingRoomTypeId(event.target.value)
                        }
                        required
                        value={editingRoomTypeId}
                      >
                        <option value="">Choose type</option>
                        {selectedProperty.roomTypes.map((roomType) => (
                          <option key={roomType.id} value={roomType.id}>
                            {roomType.name}
                            {roomType.isActive ? "" : " (inactive)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={isSubmitting || !editingRoomId}
                      type="submit"
                    >
                      Save room
                    </button>
                    {editingRoomId ? (
                      <button
                        className="secondary-button"
                        disabled={isSubmitting}
                        onClick={() => {
                          const room = selectedProperty.rooms.find(
                            (candidate) => candidate.id === editingRoomId,
                          );
                          if (room) void setRoomActive(room.id, !room.isActive);
                        }}
                        type="button"
                      >
                        {selectedProperty.rooms.find(
                          (room) => room.id === editingRoomId,
                        )?.isActive
                          ? "Archive room"
                          : "Reactivate room"}
                      </button>
                    ) : null}
                  </form>
                </section>
              ) : null}
              {activeWorkspaceTab === "rates" && data?.canManageProperties ? (
                <section
                  className="notice-panel rate-management"
                  id="rate-management"
                >
                  <div className="rate-management-header">
                    <div>
                      <p className="eyebrow">Room types and rates</p>
                      <h2>Rate workspace</h2>
                    </div>
                    <span>{selectedProperty.currency}</span>
                  </div>

                  <div className="rate-workspace-tabs" role="tablist">
                    <button
                      data-selected={activeRateTab === "quote"}
                      onClick={() => setActiveRateTab("quote")}
                      type="button"
                    >
                      Quote
                    </button>
                    <button
                      data-selected={activeRateTab === "create"}
                      onClick={() => setActiveRateTab("create")}
                      type="button"
                    >
                      Create
                    </button>
                    <button
                      data-selected={activeRateTab === "lists"}
                      onClick={() => setActiveRateTab("lists")}
                      type="button"
                    >
                      Lists
                    </button>
                  </div>

                  {activeRateTab === "create" ? (
                    <div className="rate-management-grid">
                      <form className="rate-form" onSubmit={saveRoomType}>
                        <div className="rate-form-title">
                          <BedDouble aria-hidden="true" />
                          <strong>Room type</strong>
                        </div>
                        <label>
                          Name
                          <input
                            onChange={(event) =>
                              setRoomTypeName(event.target.value)
                            }
                            placeholder="Deluxe king"
                            required
                            value={roomTypeName}
                          />
                        </label>
                        <label>
                          Code
                          <input
                            onChange={(event) =>
                              setRoomTypeCode(event.target.value)
                            }
                            placeholder="deluxe-king"
                            value={roomTypeCode}
                          />
                        </label>
                        <div className="rate-field-row">
                          <label>
                            Base occ.
                            <input
                              inputMode="numeric"
                              onChange={(event) =>
                                setRoomTypeBaseOccupancy(event.target.value)
                              }
                              required
                              value={roomTypeBaseOccupancy}
                            />
                          </label>
                          <label>
                            Max occ.
                            <input
                              inputMode="numeric"
                              onChange={(event) =>
                                setRoomTypeMaxOccupancy(event.target.value)
                              }
                              value={roomTypeMaxOccupancy}
                            />
                          </label>
                        </div>
                        <label>
                          Default rate
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setRoomTypeDefaultRate(event.target.value)
                            }
                            placeholder="120.00"
                            value={roomTypeDefaultRate}
                          />
                        </label>
                        <button disabled={isSubmitting} type="submit">
                          <Plus aria-hidden="true" />
                          Save room type
                        </button>
                      </form>

                      <form className="rate-form" onSubmit={createRatePlan}>
                        <div className="rate-form-title">
                          <Tags aria-hidden="true" />
                          <strong>Rate plan</strong>
                        </div>
                        <label>
                          Name
                          <input
                            onChange={(event) =>
                              setRatePlanName(event.target.value)
                            }
                            placeholder="Best available"
                            required
                            value={ratePlanName}
                          />
                        </label>
                        <label>
                          Room type
                          <select
                            onChange={(event) =>
                              setRatePlanRoomTypeId(event.target.value)
                            }
                            value={ratePlanRoomTypeId}
                          >
                            <option value="">All room types</option>
                            {activeRoomTypes.map((roomType) => (
                              <option key={roomType.id} value={roomType.id}>
                                {roomType.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="rate-field-row">
                          <label>
                            Default
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setRatePlanDefaultRate(event.target.value)
                              }
                              placeholder="120.00"
                              value={ratePlanDefaultRate}
                            />
                          </label>
                          <label>
                            Extra guest
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setRatePlanExtraGuestRate(event.target.value)
                              }
                              value={ratePlanExtraGuestRate}
                            />
                          </label>
                        </div>
                        <label>
                          Min nights
                          <input
                            inputMode="numeric"
                            onChange={(event) =>
                              setRatePlanMinNights(event.target.value)
                            }
                            required
                            value={ratePlanMinNights}
                          />
                        </label>
                        <button disabled={isSubmitting} type="submit">
                          <Plus aria-hidden="true" />
                          {editingRatePlanId ? "Save plan" : "Create plan"}
                        </button>
                      </form>

                      <form className="rate-form" onSubmit={createRoomRate}>
                        <div className="rate-form-title">
                          <CalendarDays aria-hidden="true" />
                          <strong>Date rate</strong>
                        </div>
                        <label>
                          Rate plan
                          <select
                            onChange={(event) =>
                              setRoomRatePlanId(event.target.value)
                            }
                            required
                            value={roomRatePlanId}
                          >
                            <option value="">Choose plan</option>
                            {roomRatePlans.map((ratePlan) => (
                              <option key={ratePlan.id} value={ratePlan.id}>
                                {ratePlan.name}
                                {ratePlan.roomType ? "" : " (all types)"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Room type
                          <select
                            onChange={(event) =>
                              setRoomRateRoomTypeId(event.target.value)
                            }
                            required
                            value={roomRateRoomTypeId}
                          >
                            <option value="">Choose type</option>
                            {activeRoomTypes.map((roomType) => (
                              <option key={roomType.id} value={roomType.id}>
                                {roomType.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="rate-field-row">
                          <label>
                            Start
                            <input
                              onChange={(event) =>
                                setRoomRateStartDate(event.target.value)
                              }
                              required
                              type="date"
                              value={roomRateStartDate}
                            />
                          </label>
                          <label>
                            End
                            <input
                              onChange={(event) =>
                                setRoomRateEndDate(event.target.value)
                              }
                              required
                              type="date"
                              value={roomRateEndDate}
                            />
                          </label>
                        </div>
                        <div className="rate-field-row">
                          <label>
                            Base
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setRoomRateBaseRate(event.target.value)
                              }
                              required
                              value={roomRateBaseRate}
                            />
                          </label>
                          <label>
                            Extra
                            <input
                              inputMode="decimal"
                              onChange={(event) =>
                                setRoomRateExtraGuestRate(event.target.value)
                              }
                              value={roomRateExtraGuestRate}
                            />
                          </label>
                        </div>
                        <button disabled={isSubmitting} type="submit">
                          <Plus aria-hidden="true" />
                          Add date rate
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {activeRateTab === "lists" ? (
                    <div className="rate-lists">
                      <div>
                        <h3>Room types</h3>
                        <div className="rate-table">
                          {selectedProperty.roomTypes.map((roomType) => (
                            <div className="rate-row" key={roomType.id}>
                              <strong>{roomType.name}</strong>
                              <span>{roomType.code}</span>
                              <span>
                                Occ. {roomType.baseOccupancy}
                                {roomType.maxOccupancy
                                  ? `-${roomType.maxOccupancy}`
                                  : ""}
                              </span>
                              <span>
                                {formatMoney(
                                  roomType.defaultRate,
                                  roomType.defaultCurrency,
                                )}{" "}
                                · {roomType.isActive ? "Active" : "Inactive"}
                              </span>
                              <div className="room-action-row">
                                <button
                                  className="secondary-button"
                                  onClick={() => {
                                    setEditingRoomTypeRecordId(roomType.id);
                                    setRoomTypeName(roomType.name);
                                    setRoomTypeCode(roomType.code);
                                    setRoomTypeDefaultRate(
                                      roomType.defaultRate === null
                                        ? ""
                                        : String(roomType.defaultRate),
                                    );
                                    setRoomTypeBaseOccupancy(
                                      String(roomType.baseOccupancy),
                                    );
                                    setRoomTypeMaxOccupancy(
                                      roomType.maxOccupancy === null
                                        ? ""
                                        : String(roomType.maxOccupancy),
                                    );
                                    setActiveRateTab("create");
                                  }}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    setRoomTypeActive(
                                      roomType,
                                      !roomType.isActive,
                                    )
                                  }
                                  type="button"
                                >
                                  {roomType.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                                </button>
                              </div>
                            </div>
                          ))}
                          {!selectedProperty.roomTypes.length ? (
                            <div className="empty-state">
                              No room types configured yet.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <h3>Rate plans</h3>
                        <div className="rate-table">
                          {selectedProperty.ratePlans.map((ratePlan) => (
                            <div className="rate-row" key={ratePlan.id}>
                              <strong>{ratePlan.name}</strong>
                              <span>
                                {ratePlan.roomType?.name ?? "All room types"}
                              </span>
                              <span>
                                {formatMoney(
                                  ratePlan.defaultRate,
                                  ratePlan.currency,
                                )}
                              </span>
                              <span>
                                {ratePlan.minNights} night min. ·{" "}
                                {formatLabel(ratePlan.status)}
                              </span>
                              <div className="room-action-row">
                                <button
                                  className="secondary-button"
                                  onClick={() => {
                                    setEditingRatePlanId(ratePlan.id);
                                    setRatePlanName(ratePlan.name);
                                    setRatePlanRoomTypeId(
                                      ratePlan.roomTypeId ?? "",
                                    );
                                    setRatePlanDefaultRate(
                                      ratePlan.defaultRate === null
                                        ? ""
                                        : String(ratePlan.defaultRate),
                                    );
                                    setRatePlanExtraGuestRate(
                                      String(ratePlan.extraGuestRate),
                                    );
                                    setRatePlanMinNights(
                                      String(ratePlan.minNights),
                                    );
                                    setActiveRateTab("create");
                                  }}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    setRatePlanActive(
                                      ratePlan,
                                      ratePlan.status === "active"
                                        ? "inactive"
                                        : "active",
                                    )
                                  }
                                  type="button"
                                >
                                  {ratePlan.status === "active"
                                    ? "Deactivate"
                                    : "Activate"}
                                </button>
                              </div>
                            </div>
                          ))}
                          {!selectedProperty.ratePlans.length ? (
                            <div className="empty-state">
                              No rate plans configured yet.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeRateTab === "quote" ? (
                    <form className="rate-lookup-form" onSubmit={lookupRate}>
                      <div className="rate-form-title">
                        <CalendarDays aria-hidden="true" />
                        <strong>Quote check</strong>
                      </div>
                      <label>
                        Room type
                        <select
                          onChange={(event) =>
                            setLookupRoomTypeId(event.target.value)
                          }
                          required
                          value={lookupRoomTypeId}
                        >
                          <option value="">Choose type</option>
                          {activeRoomTypes.map((roomType) => (
                            <option key={roomType.id} value={roomType.id}>
                              {roomType.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Plan
                        <select
                          onChange={(event) =>
                            setLookupRatePlanId(event.target.value)
                          }
                          value={lookupRatePlanId}
                        >
                          <option value="">Automatic</option>
                          {lookupRatePlans.map((ratePlan) => (
                            <option key={ratePlan.id} value={ratePlan.id}>
                              {ratePlan.name}
                              {ratePlan.roomType ? "" : " (all types)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Arrival
                        <input
                          onChange={(event) =>
                            setLookupArrivalDate(event.target.value)
                          }
                          required
                          type="date"
                          value={lookupArrivalDate}
                        />
                      </label>
                      <label>
                        Departure
                        <input
                          onChange={(event) =>
                            setLookupDepartureDate(event.target.value)
                          }
                          required
                          type="date"
                          value={lookupDepartureDate}
                        />
                      </label>
                      <label>
                        Guests
                        <input
                          inputMode="numeric"
                          onChange={(event) =>
                            setLookupGuestCount(event.target.value)
                          }
                          required
                          value={lookupGuestCount}
                        />
                      </label>
                      <button disabled={isSubmitting} type="submit">
                        Check rate
                      </button>
                      {rateQuote ? (
                        <output className="rate-quote">
                          <strong>
                            {formatMoney(
                              rateQuote.totalAmount,
                              rateQuote.currency,
                            )}
                          </strong>
                          <span>
                            {rateQuote.nights} nights, base{" "}
                            {formatMoney(
                              rateQuote.baseAmount,
                              rateQuote.currency,
                            )}
                            , extras{" "}
                            {formatMoney(
                              rateQuote.extraGuestAmount,
                              rateQuote.currency,
                            )}
                          </span>
                        </output>
                      ) : null}
                    </form>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {activeWorkspaceTab === "setup" && data?.canManageProperties ? (
        <section className="notice-panel compact-panel" id="new-property">
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
      ) : !data?.canManageProperties ? (
        <div className="empty-state">
          Ask an owner or admin to create properties and room inventory.
        </div>
      ) : null}
    </div>
  );
}
