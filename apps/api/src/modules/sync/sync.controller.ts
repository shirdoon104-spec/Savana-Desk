import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { OfflineAction } from "@rayaan/offline-sync";
import { Prisma } from "@rayaan/database";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import { RestaurantOrderTotalsService } from "../restaurants/order-totals.service";
import type { TenantContext } from "../tenancy/tenant-context.service";

const terminalOfflineStatuses = ["synced", "conflicted", "rejected"] as const;
const offlinePaymentMethods = [
  "cash",
  "card_manual",
  "room_charge",
  "complimentary",
  "voucher",
] as const;

@Controller("sync")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class SyncController {
  constructor(
    private readonly orderTotals: RestaurantOrderTotalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("conflicts")
  @RequirePermission("restaurant.manage")
  async listConflicts(@CurrentTenant() context: TenantContext) {
    const actions = await this.prisma.offlineAction.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      where: {
        status: { in: ["conflicted", "rejected"] },
        tenantId: context.tenant.id,
      },
    });

    return {
      actions: actions.map((action) => ({
        actionType: action.actionType,
        actorUserId: action.actorUserId,
        conflictReason: action.conflictReason,
        createdAt: action.createdAt,
        deviceId: action.deviceId,
        entityId: action.entityId,
        entityType: action.entityType,
        id: action.id,
        lastError: action.lastError,
        occurredAt: action.occurredAt,
        payload: action.payload,
        propertyId: action.propertyId,
        restaurantId: action.restaurantId,
        retryCount: action.retryCount,
        status: action.status,
        updatedAt: action.updatedAt,
      })),
    };
  }

  @Post("conflicts/:actionId/resolve")
  @RequirePermission("restaurant.manage")
  async resolveConflict(
    @CurrentTenant() context: TenantContext,
    @Param("actionId") actionId: string,
  ) {
    const action = await this.prisma.offlineAction.findFirst({
      where: {
        id: actionId,
        status: { in: ["conflicted", "rejected"] },
        tenantId: context.tenant.id,
      },
    });

    if (!action) {
      throw new BadRequestException("Offline conflict was not found.");
    }

    await this.prisma.offlineAction.update({
      where: { id: action.id },
      data: {
        resolvedAt: new Date(),
        status: "reviewed",
      },
    });

    return { id: action.id, status: "reviewed" };
  }

  @Post("actions")
  @RequirePermission("tenant.read")
  async enqueue(
    @CurrentTenant() context: TenantContext,
    @Body() actions: OfflineAction[],
  ) {
    if (!Array.isArray(actions)) {
      throw new BadRequestException("Offline actions must be an array.");
    }

    if (actions.length > 100) {
      throw new BadRequestException("Submit 100 offline actions or fewer at a time.");
    }

    for (const action of actions) {
      if (
        !action?.id ||
        !action.idempotencyKey ||
        !action.occurredAt ||
        Number.isNaN(new Date(action.occurredAt).getTime()) ||
        !action.propertyId ||
        action.tenantId !== context.tenant.id ||
        action.actorUserId !== context.tenantUser.clerkUserId
      ) {
        throw new BadRequestException("Offline action scope is invalid.");
      }
    }

    const accepted = [];
    const maxRetries = readIntegerEnv("OFFLINE_QUEUE_MAX_RETRIES", 3);

    for (const action of actions) {
      const existing = await this.prisma.offlineAction.findUnique({
        where: { idempotencyKey: action.idempotencyKey },
      });

      if (existing) {
        if (
          existing.tenantId !== context.tenant.id ||
          existing.actorUserId !== context.tenantUser.clerkUserId ||
          existing.actionType !== action.actionType
        ) {
          throw new BadRequestException("Offline action idempotency key was reused for a different action.");
        }

        accepted.push(await this.replayPersistedAction(existing.id, context, maxRetries));
        continue;
      }

      const created = await this.prisma.offlineAction.create({
        data: {
          actionType: action.actionType,
          actorUserId: context.tenantUser.clerkUserId,
          deviceId: action.deviceId,
          entityId: action.entityId ?? null,
          entityType: action.entityType,
          id: action.id,
          idempotencyKey: action.idempotencyKey,
          occurredAt: new Date(action.occurredAt),
          payload: action.payload as object,
          propertyId: action.propertyId,
          restaurantId: action.restaurantId ?? null,
          retryCount: action.retryCount,
          status: "queued",
          tenantId: context.tenant.id,
        },
      });

      accepted.push(await this.replayPersistedAction(created.id, context, maxRetries));
    }

    return {
      accepted,
      note: "Offline actions were persisted and replayed in order. Terminal conflicts are retained for manager review.",
    };
  }

  private async replayPersistedAction(
    actionId: string,
    context: TenantContext,
    maxRetries: number,
  ) {
    const action = await this.prisma.offlineAction.findUniqueOrThrow({
      where: { id: actionId },
    });

    if (terminalOfflineStatuses.includes(action.status as typeof terminalOfflineStatuses[number])) {
      return {
        conflictReason: action.conflictReason,
        entityId: action.entityId,
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        message: action.lastError,
        status: action.status,
      };
    }

    if (action.retryCount >= maxRetries) {
      const message = `Retry limit reached after ${maxRetries} attempts.`;
      await this.prisma.offlineAction.update({
        where: { id: action.id },
        data: {
          lastError: message,
          resolvedAt: new Date(),
          status: "rejected",
        },
      });

      return {
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        message,
        status: "rejected",
      };
    }

    try {
      const replayed = await this.replaySupportedAction(action, context);

      await this.prisma.offlineAction.update({
        where: { id: action.id },
        data: {
          entityId: replayed.entityId ?? action.entityId,
          lastError: null,
          resolvedAt: new Date(),
          status: "synced",
        },
      });

      return {
        entityId: replayed.entityId ?? action.entityId,
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        status: "synced",
      };
    } catch (error) {
      if (error instanceof OfflineConflictError) {
        await this.prisma.offlineAction.update({
          where: { id: action.id },
          data: {
            conflictReason: error.message,
            lastError: error.message,
            resolvedAt: new Date(),
            status: "conflicted",
          },
        });

        return {
          conflictReason: error.message,
          id: action.id,
          idempotencyKey: action.idempotencyKey,
          message: error.message,
          status: "conflicted",
        };
      }

      await this.prisma.offlineAction.update({
        where: { id: action.id },
        data: {
          lastError:
            error instanceof Error ? error.message : "Could not replay offline action.",
          retryCount: { increment: 1 },
          status: "failed",
        },
      });

      return {
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        message:
          error instanceof Error ? error.message : "Could not replay offline action.",
        status: "failed",
      };
    }
  }

  private async replaySupportedAction(
    action: {
      actionType: string;
      idempotencyKey: string;
      payload: Prisma.JsonValue;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    },
    context: TenantContext,
  ) {
    if (action.actionType === "order.create") {
      return { entityId: await this.replayCreateOrder(action, context) };
    }

    if (action.actionType === "order.payment.record") {
      return { entityId: await this.replayRecordPayment(action, context) };
    }

    if (action.actionType === "order.item.void") {
      return { entityId: await this.replayVoidItem(action, context) };
    }

    if (action.actionType === "order.table.transfer") {
      return { entityId: await this.replayTransferTable(action, context) };
    }

    throw new OfflineConflictError(`Unsupported offline action type: ${action.actionType}.`);
  }

  private async replayCreateOrder(
    action: {
      idempotencyKey: string;
      payload: Prisma.JsonValue;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    },
    context: TenantContext,
  ) {
    if (!["owner", "admin", "restaurant_manager", "waiter"].includes(context.role)) {
      throw new BadRequestException("Your role cannot create restaurant orders.");
    }

    const payload = parseCreateOrderPayload(action.payload);

    if (!action.restaurantId) {
      throw new BadRequestException("Offline order is missing a restaurant.");
    }

    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id: action.restaurantId,
        propertyId: action.propertyId,
        tenantId: context.tenant.id,
      },
      include: { property: true },
    });

    if (!restaurant) {
      throw new BadRequestException("Restaurant was not found for offline order.");
    }

    if (payload.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: {
          id: payload.tableId,
          restaurantId: restaurant.id,
          tenantId: context.tenant.id,
        },
      });

      if (!table) {
        throw new BadRequestException("Table was not found for offline order.");
      }

      if (["seated", "ordering", "served"].includes(table.status)) {
        throw new OfflineConflictError("Table is now occupied. Review the queued order before applying it.");
      }
    }

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        idempotencyKey: action.idempotencyKey,
        tenantId: context.tenant.id,
      },
    });

    if (existingOrder) {
      return existingOrder.id;
    }

    const menuItems = await this.prisma.menuItem.findMany({
      include: { category: true },
      where: {
        id: { in: payload.items.map((item) => item.menuItemId) },
        isActive: true,
        isAvailable: true,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    if (menuItems.length !== uniqueMenuItemIdCount(payload.items)) {
      throw new OfflineConflictError("One or more offline menu items are no longer available.");
    }

    assertMenuItemsHaveStock(menuItems, payload.items);

    const itemRows = payload.items.map((item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem) {
        throw new BadRequestException("One or more offline menu items were not found.");
      }

      const unitPrice = new Prisma.Decimal(menuItem.price);
      const totalPrice = unitPrice.mul(item.quantity);

      return {
        kitchenStation:
          menuItem.kitchenStation ?? menuItem.category?.defaultStation ?? "main_kitchen",
        menuItemId: menuItem.id,
        name: menuItem.name,
        notes: item.notes?.trim() || null,
        propertyId: restaurant.propertyId,
        quantity: item.quantity,
        sentAt: new Date(),
        status: "sent" as const,
        tenantId: context.tenant.id,
        totalPrice,
        unitPrice,
      };
    });
    const subtotal = itemRows.reduce(
      (total, item) => total.plus(item.totalPrice),
      new Prisma.Decimal(0),
    );
    const totals = await this.orderTotals.calculateForRestaurant(
      this.prisma,
      context.tenant.id,
      restaurant.id,
      subtotal,
    );

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          currency: restaurant.property.currency,
          discountAmount: totals.discountAmount,
          idempotencyKey: action.idempotencyKey,
          items: { create: itemRows },
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          serviceChargeAmount: totals.serviceChargeAmount,
          serviceChargeRate: totals.serviceChargeRate,
          status: "sent",
          subtotal: totals.subtotal,
          tableId: payload.tableId || null,
          taxAmount: totals.taxAmount,
          taxRate: totals.taxRate,
          tenantId: context.tenant.id,
          totalAmount: totals.totalAmount,
        },
      });

      await decrementMenuItemStock(
        tx,
        context.tenant.id,
        restaurant.id,
        itemRows,
      );

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "order_created",
          newState: toPrismaJson({
            id: order.id,
            offlineActionId: action.idempotencyKey,
            status: order.status,
            tableId: order.tableId,
            totalAmount: order.totalAmount.toString(),
          }),
          orderId: order.id,
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          tenantId: context.tenant.id,
        },
      });

      if (payload.tableId) {
        await tx.restaurantTable.update({
          where: { id: payload.tableId },
          data: { status: "ordering" },
        });
      }

      return order.id;
    });
  }

  private async replayRecordPayment(
    action: {
      idempotencyKey: string;
      payload: Prisma.JsonValue;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    },
    context: TenantContext,
  ) {
    if (!["owner", "admin", "restaurant_manager", "cashier", "waiter"].includes(context.role)) {
      throw new BadRequestException("Your role cannot record restaurant payments.");
    }

    const payload = parsePaymentPayload(action.payload);

    if (!action.restaurantId) {
      throw new BadRequestException("Offline payment is missing a restaurant.");
    }

    const existingPayment = await this.prisma.orderPayment.findFirst({
      where: {
        metadata: {
          path: ["offlineActionKey"],
          equals: action.idempotencyKey,
        },
        tenantId: context.tenant.id,
      },
    });

    if (existingPayment) {
      return existingPayment.orderId;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: payload.orderId,
        propertyId: action.propertyId,
        restaurantId: action.restaurantId,
        tenantId: context.tenant.id,
      },
    });

    if (!order) {
      throw new OfflineConflictError("Order no longer exists for this offline payment.");
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new OfflineConflictError("Order was already closed or cancelled before the offline payment synced.");
    }

    const amount = new Prisma.Decimal(payload.amount);
    const confirmedTotal = await this.confirmedPaymentTotal(context.tenant.id, order.id);
    const remaining = new Prisma.Decimal(order.totalAmount).minus(confirmedTotal);

    if (amount.greaterThan(remaining)) {
      throw new OfflineConflictError("Offline payment exceeds the current outstanding balance.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.create({
        data: {
          amount,
          currency: order.currency,
          method: payload.method,
          metadata: toPrismaJson({ offlineActionKey: action.idempotencyKey }),
          orderId: order.id,
          paidAt: new Date(),
          propertyId: order.propertyId,
          recordedById: context.tenantUser.id,
          reference: payload.reference ?? null,
          restaurantId: order.restaurantId,
          status: "confirmed",
          tenantId: context.tenant.id,
        },
      });

      const paymentStatus = confirmedTotal.plus(amount).greaterThanOrEqualTo(order.totalAmount)
        ? "paid"
        : "partial";
      const shouldClose = paymentStatus === "paid";

      await tx.order.update({
        where: { id: order.id },
        data: {
          closedAt: shouldClose ? new Date() : undefined,
          closedById: shouldClose ? context.tenantUser.id : undefined,
          paymentStatus,
          status: shouldClose ? "closed" : order.status,
        },
      });

      if (shouldClose && order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "cleaning" },
        });
      }

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "payment_confirmed",
          newState: toPrismaJson({
            amount: amount.toString(),
            method: payload.method,
            offlineActionKey: action.idempotencyKey,
            paymentStatus,
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });
    });

    return order.id;
  }

  private async replayVoidItem(
    action: {
      payload: Prisma.JsonValue;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    },
    context: TenantContext,
  ) {
    if (!["owner", "admin", "restaurant_manager"].includes(context.role)) {
      throw new BadRequestException("Your role cannot void restaurant items.");
    }

    const payload = parseVoidItemPayload(action.payload);

    if (!action.restaurantId) {
      throw new BadRequestException("Offline item void is missing a restaurant.");
    }

    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: payload.itemId,
        order: {
          id: payload.orderId,
          propertyId: action.propertyId,
          restaurantId: action.restaurantId,
          tenantId: context.tenant.id,
        },
        tenantId: context.tenant.id,
      },
      include: { order: true },
    });

    if (!item) {
      throw new OfflineConflictError("Order item no longer exists for this offline void.");
    }

    if (item.status === "voided") {
      return item.orderId;
    }

    if (["closed", "cancelled"].includes(item.order.status)) {
      throw new OfflineConflictError("Order was already final before the offline void synced.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          status: "voided",
          voidReason: payload.voidReason,
          voidedAt: new Date(),
          voidedById: context.tenantUser.id,
        },
      });

      const totals = await recalculateOrderTotals(
        tx,
        this.orderTotals,
        item.orderId,
        item.order.restaurantId,
        context.tenant.id,
      );

      await tx.order.update({
        where: { id: item.orderId },
        data: totals,
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "item_voided",
          newState: toPrismaJson({
            itemId: item.id,
            totalAmount: totals.totalAmount.toString(),
            voidReason: payload.voidReason,
          }),
          orderId: item.orderId,
          previousState: toPrismaJson({
            status: item.status,
            totalPrice: item.totalPrice.toString(),
          }),
          propertyId: item.order.propertyId,
          restaurantId: item.order.restaurantId,
          tenantId: context.tenant.id,
        },
      });
    });

    return item.orderId;
  }

  private async replayTransferTable(
    action: {
      payload: Prisma.JsonValue;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    },
    context: TenantContext,
  ) {
    if (!["owner", "admin", "restaurant_manager", "waiter"].includes(context.role)) {
      throw new BadRequestException("Your role cannot transfer restaurant tables.");
    }

    const payload = parseTransferTablePayload(action.payload);

    if (!action.restaurantId) {
      throw new BadRequestException("Offline table transfer is missing a restaurant.");
    }

    const [order, targetTable] = await Promise.all([
      this.prisma.order.findFirst({
        where: {
          id: payload.orderId,
          propertyId: action.propertyId,
          restaurantId: action.restaurantId,
          tenantId: context.tenant.id,
        },
      }),
      this.prisma.restaurantTable.findFirst({
        where: {
          id: payload.tableId,
          propertyId: action.propertyId,
          restaurantId: action.restaurantId,
          tenantId: context.tenant.id,
        },
      }),
    ]);

    if (!order) {
      throw new OfflineConflictError("Order no longer exists for this offline table transfer.");
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new OfflineConflictError("Order was already final before the table transfer synced.");
    }

    if (!targetTable) {
      throw new OfflineConflictError("Target table no longer exists.");
    }

    if (["seated", "ordering", "served"].includes(targetTable.status)) {
      throw new OfflineConflictError("Target table is occupied. Review the table transfer manually.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { tableId: targetTable.id },
      });

      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: {
            assignedWaiterName: null,
            assignedWaiterUserId: null,
            coverCount: 0,
            status: "free",
          },
        });
      }

      await tx.restaurantTable.update({
        where: { id: targetTable.id },
        data: { status: "ordering" },
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "table_transferred",
          newState: toPrismaJson({
            offline: true,
            tableId: targetTable.id,
          }),
          orderId: order.id,
          previousState: toPrismaJson({ tableId: order.tableId }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });
    });

    return order.id;
  }

  private async confirmedPaymentTotal(tenantId: string, orderId: string) {
    const payments = await this.prisma.orderPayment.findMany({
      where: {
        orderId,
        status: "confirmed",
        tenantId,
      },
      select: { amount: true },
    });

    return payments.reduce(
      (total, payment) => total.plus(payment.amount),
      new Prisma.Decimal(0),
    );
  }
}

class OfflineConflictError extends Error {}

function assertMenuItemsHaveStock(
  menuItems: Array<{
    currentStock: number | null;
    id: string;
    isAvailable: boolean;
    name: string;
    stockEnabled: boolean;
  }>,
  requestedItems: Array<{
    menuItemId: string;
    quantity: number;
  }>,
) {
  const requestedQuantities = aggregateMenuItemQuantities(requestedItems);

  for (const menuItem of menuItems) {
    const requestedQuantity = requestedQuantities.get(menuItem.id) ?? 0;

    if (!menuItem.isAvailable) {
      throw new OfflineConflictError(`${menuItem.name} is currently unavailable.`);
    }

    if (!menuItem.stockEnabled) {
      continue;
    }

    if (menuItem.currentStock === null) {
      throw new OfflineConflictError(`${menuItem.name} stock has not been configured.`);
    }

    if (menuItem.currentStock < requestedQuantity) {
      throw new OfflineConflictError(
        `${menuItem.name} only has ${menuItem.currentStock} left.`,
      );
    }
  }
}

async function decrementMenuItemStock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  restaurantId: string,
  items: Array<{
    menuItemId: string | null;
    quantity: number;
  }>,
) {
  const requestedQuantities = aggregateMenuItemQuantities(
    items.filter((item): item is { menuItemId: string; quantity: number } =>
      Boolean(item.menuItemId),
    ),
  );

  for (const [menuItemId, quantity] of requestedQuantities) {
    const updated = await tx.menuItem.updateMany({
      where: {
        currentStock: { gte: quantity },
        id: menuItemId,
        isActive: true,
        isAvailable: true,
        restaurantId,
        stockEnabled: true,
        tenantId,
      },
      data: {
        currentStock: { decrement: quantity },
      },
    });

    if (updated.count === 0) {
      const menuItem = await tx.menuItem.findFirst({
        where: {
          id: menuItemId,
          restaurantId,
          tenantId,
        },
        select: {
          currentStock: true,
          name: true,
          stockEnabled: true,
        },
      });

      if (menuItem?.stockEnabled) {
        throw new OfflineConflictError(
          `${menuItem.name} does not have enough stock left.`,
        );
      }
    }

    await tx.menuItem.updateMany({
      where: {
        currentStock: { lte: 0 },
        id: menuItemId,
        restaurantId,
        stockEnabled: true,
        tenantId,
      },
      data: { isAvailable: false },
    });
  }
}

function aggregateMenuItemQuantities(
  items: Array<{
    menuItemId: string;
    quantity: number;
  }>,
) {
  return items.reduce((quantities, item) => {
    quantities.set(
      item.menuItemId,
      (quantities.get(item.menuItemId) ?? 0) + item.quantity,
    );

    return quantities;
  }, new Map<string, number>());
}

function uniqueMenuItemIdCount(items: Array<{ menuItemId: string }>) {
  return new Set(items.map((item) => item.menuItemId)).size;
}

function parseCreateOrderPayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Offline order payload is invalid.");
  }

  const candidate = payload as {
    items?: unknown;
    tableId?: unknown;
  };

  if (!Array.isArray(candidate.items) || !candidate.items.length) {
    throw new BadRequestException("Offline order must include items.");
  }

  return {
    items: candidate.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new BadRequestException("Offline order item is invalid.");
      }

      const orderItem = item as {
        menuItemId?: unknown;
        notes?: unknown;
        quantity?: unknown;
      };
      const quantity = Number(orderItem.quantity);

      if (
        typeof orderItem.menuItemId !== "string" ||
        !orderItem.menuItemId ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new BadRequestException("Offline order item is invalid.");
      }

      return {
        menuItemId: orderItem.menuItemId,
        notes: typeof orderItem.notes === "string" ? orderItem.notes : "",
        quantity,
      };
    }),
    tableId: typeof candidate.tableId === "string" ? candidate.tableId : undefined,
  };
}

function parsePaymentPayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Offline payment payload is invalid.");
  }

  const candidate = payload as {
    amount?: unknown;
    method?: unknown;
    orderId?: unknown;
    reference?: unknown;
  };
  const amount = Number(candidate.amount);

  if (
    typeof candidate.orderId !== "string" ||
    !candidate.orderId ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof candidate.method !== "string" ||
    !offlinePaymentMethods.includes(candidate.method as typeof offlinePaymentMethods[number])
  ) {
    throw new BadRequestException("Offline payment payload is invalid.");
  }

  return {
    amount,
    method: candidate.method as typeof offlinePaymentMethods[number],
    orderId: candidate.orderId,
    reference:
      typeof candidate.reference === "string" && candidate.reference.trim()
        ? candidate.reference.trim()
        : undefined,
  };
}

function parseVoidItemPayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Offline item void payload is invalid.");
  }

  const candidate = payload as {
    itemId?: unknown;
    orderId?: unknown;
    voidReason?: unknown;
  };

  if (
    typeof candidate.orderId !== "string" ||
    !candidate.orderId ||
    typeof candidate.itemId !== "string" ||
    !candidate.itemId ||
    typeof candidate.voidReason !== "string" ||
    candidate.voidReason.trim().length < 3
  ) {
    throw new BadRequestException("Offline item void payload is invalid.");
  }

  return {
    itemId: candidate.itemId,
    orderId: candidate.orderId,
    voidReason: candidate.voidReason.trim(),
  };
}

function parseTransferTablePayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Offline table transfer payload is invalid.");
  }

  const candidate = payload as {
    orderId?: unknown;
    tableId?: unknown;
  };

  if (
    typeof candidate.orderId !== "string" ||
    !candidate.orderId ||
    typeof candidate.tableId !== "string" ||
    !candidate.tableId
  ) {
    throw new BadRequestException("Offline table transfer payload is invalid.");
  }

  return {
    orderId: candidate.orderId,
    tableId: candidate.tableId,
  };
}

async function recalculateOrderTotals(
  tx: Prisma.TransactionClient,
  orderTotals: RestaurantOrderTotalsService,
  orderId: string,
  restaurantId: string,
  tenantId: string,
) {
  const [items, discounts] = await Promise.all([
    tx.orderItem.findMany({
      where: {
        orderId,
        status: { not: "voided" },
        tenantId,
      },
      select: { totalPrice: true },
    }),
    tx.orderDiscount.findMany({
      where: {
        orderId,
        tenantId,
      },
      select: { amount: true },
    }),
  ]);
  const subtotal = items.reduce(
    (total, item) => total.plus(item.totalPrice),
    new Prisma.Decimal(0),
  );
  const discountAmount = discounts.reduce(
    (total, discount) => total.plus(discount.amount),
    new Prisma.Decimal(0),
  );

  return orderTotals.calculateForRestaurant(
    tx,
    tenantId,
    restaurantId,
    subtotal,
    discountAmount,
  );
}

function readIntegerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
