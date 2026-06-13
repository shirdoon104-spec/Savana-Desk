import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Prisma } from "@rayaan/database";
import type { TenantRole } from "@rayaan/shared";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "../tenancy/tenant-context.service";

class ActiveStaySearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

class RoomChargeReportQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  propertyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  restaurantId?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

class RestaurantReportQueryDto extends RoomChargeReportQueryDto {}

class PostFolioChargeDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsString()
  @MaxLength(128)
  orderId!: string;

  @IsString()
  @MaxLength(128)
  restaurantId!: string;
}

@Controller()
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class FoliosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("reports/restaurant-room-charges")
  @RequirePermission("billing.read")
  async roomChargeReport(
    @CurrentTenant() context: TenantContext,
    @Query() query: RoomChargeReportQueryDto,
  ) {
    return this.buildRoomChargeReport(context.tenant.id, query);
  }

  @Get("reports/restaurant-room-charges.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="restaurant-room-charges.csv"',
  )
  @RequirePermission("billing.read")
  async roomChargeReportCsv(
    @CurrentTenant() context: TenantContext,
    @Query() query: RoomChargeReportQueryDto,
  ) {
    const report = await this.buildRoomChargeReport(context.tenant.id, query);
    const header = [
      "createdAt",
      "restaurant",
      "room",
      "guest",
      "stayId",
      "orderId",
      "description",
      "currency",
      "amount",
    ];
    const rows = report.rows.map((row) =>
      [
        row.createdAt,
        row.restaurantName,
        row.roomNumber,
        row.guestName,
        row.stayId,
        row.orderId,
        row.description,
        row.currency,
        row.amount,
      ]
        .map(csvCell)
        .join(","),
    );

    return `${header.join(",")}\n${rows.join("\n")}`;
  }

  @Get("reports/restaurant-z-report")
  @RequirePermission("billing.read")
  async restaurantZReport(
    @CurrentTenant() context: TenantContext,
    @Query() query: RestaurantReportQueryDto,
  ) {
    return this.buildRestaurantZReport(context.tenant.id, query);
  }

  @Get("reports/restaurant-z-report.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="restaurant-z-report.csv"',
  )
  @RequirePermission("billing.read")
  async restaurantZReportCsv(
    @CurrentTenant() context: TenantContext,
    @Query() query: RestaurantReportQueryDto,
  ) {
    const report = await this.buildRestaurantZReport(context.tenant.id, query);
    const sections = [
      ["section", "Z-report summary"],
      ["from", report.from],
      ["to", report.to],
      ["orders", report.summary.orderCount.toString()],
      ["covers", report.summary.covers.toString()],
      ["itemSubtotal", report.summary.itemSubtotal],
      ["discounts", report.summary.discounts],
      ["serviceChargeCollected", report.summary.serviceChargeCollected],
      ["taxCollected", report.summary.taxCollected],
      ["netSales", report.summary.netSales],
      ["paymentsCollected", report.summary.paymentsCollected],
      ["paymentVariance", report.summary.paymentVariance],
      ["averageOrderValue", report.summary.averageOrderValue],
      ["averageCoversPerTable", report.summary.averageCoversPerTable],
      [],
      ["paymentMethod", "currency", "amount"],
      ...report.revenueByPaymentMethod.map((row) => [
        row.method,
        row.currency,
        row.amount,
      ]),
      [],
      ["topItem", "quantity", "revenue"],
      ...report.topItems.map((row) => [
        row.name,
        row.quantity.toString(),
        row.revenue,
      ]),
      [],
      ["voidReason", "item", "orderId", "createdAt"],
      ...(report.voids.length
        ? report.voids.map((row) => [
            row.reason,
            row.itemName,
            row.orderId,
            row.createdAt,
          ])
        : [["No voids", "", "", ""]]),
    ];

    return sections.map((row) => row.map(csvCell).join(",")).join("\n");
  }

  @Get("reports/restaurant-shift-report")
  @RequirePermission("billing.read")
  async restaurantShiftReport(
    @CurrentTenant() context: TenantContext,
    @Query() query: RestaurantReportQueryDto,
  ) {
    return this.buildRestaurantShiftReport(context.tenant.id, query);
  }

  @Get("reports/restaurant-shift-report.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="restaurant-shift-report.csv"',
  )
  @RequirePermission("billing.read")
  async restaurantShiftReportCsv(
    @CurrentTenant() context: TenantContext,
    @Query() query: RestaurantReportQueryDto,
  ) {
    const report = await this.buildRestaurantShiftReport(
      context.tenant.id,
      query,
    );
    const rows = [
      ["section", "Shift report"],
      ["from", report.from],
      ["to", report.to],
      [],
      [
        "actorId",
        "role",
        "orders",
        "covers",
        "netSales",
        "paymentsCollected",
        "paymentVariance",
        "averageOrderValue",
      ],
      ...report.rows.map((row) => [
        row.actorId,
        row.role,
        row.orderCount.toString(),
        row.covers.toString(),
        row.netSales,
        row.paymentsCollected,
        row.paymentVariance,
        row.averageOrderValue,
      ]),
    ];

    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }

  @Get("reports/restaurant-live-dashboard")
  @RequirePermission("billing.read")
  async restaurantLiveDashboard(
    @CurrentTenant() context: TenantContext,
    @Query() query: RestaurantReportQueryDto,
  ) {
    return this.buildRestaurantLiveDashboard(context.tenant.id, query);
  }

  @Get("stays/active")
  @RequirePermission("restaurant.read")
  async searchActiveStays(
    @CurrentTenant() context: TenantContext,
    @Query() query: ActiveStaySearchDto,
  ) {
    if (!canSearchActiveStays(context.role)) {
      throw new BadRequestException("Your role cannot search active stays.");
    }

    const search = query.search?.trim();
    const stays = await this.prisma.stay.findMany({
      where: {
        status: "active",
        tenantId: context.tenant.id,
        ...(search
          ? {
              OR: [
                { id: { contains: search, mode: "insensitive" } },
                { room: { number: { contains: search, mode: "insensitive" } } },
                {
                  guest: {
                    firstName: { contains: search, mode: "insensitive" },
                  },
                },
                {
                  guest: {
                    lastName: { contains: search, mode: "insensitive" },
                  },
                },
                { guest: { phone: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        folioCharges: true,
        guestFolio: true,
        guest: true,
        property: true,
        room: true,
      },
      orderBy: { checkInAt: "desc" },
      take: 20,
    });

    return stays.map((stay) => ({
      checkoutDate: stay.expectedCheckOutAt,
      folioId: stay.guestFolio?.id ?? stay.id,
      guestName: `${stay.guest.firstName} ${stay.guest.lastName}`.trim(),
      outstandingBalance: stay.folioCharges
        .reduce(
          (total, charge) => total.plus(charge.amount),
          new Prisma.Decimal(0),
        )
        .toString(),
      roomNumber: stay.room.number,
      stayId: stay.id,
    }));
  }

  @Post("folios/:folioId/charges")
  @RequirePermission("restaurant.read")
  async postCharge(
    @CurrentTenant() context: TenantContext,
    @Param("folioId") folioId: string,
    @Body() body: PostFolioChargeDto,
  ) {
    if (!canPostRoomCharge(context.role)) {
      throw new BadRequestException("Your role cannot post room charges.");
    }

    const guestFolio = await this.prisma.guestFolio.findFirst({
      where: {
        id: folioId,
        status: { in: ["open", "pending_checkout"] },
        tenantId: context.tenant.id,
      },
      include: {
        stay: {
          include: { room: true },
        },
      },
    });
    const legacyStay = guestFolio
      ? null
      : await this.prisma.stay.findFirst({
          where: {
            id: folioId,
            status: "active",
            tenantId: context.tenant.id,
          },
          include: {
            guestFolio: true,
            room: true,
          },
        });
    const stay = guestFolio?.stay ?? legacyStay;
    const activeFolio = guestFolio ?? legacyStay?.guestFolio ?? null;

    if (!stay || stay.checkOutAt) {
      throw new BadRequestException("Stay is not active.");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: body.orderId,
        propertyId: stay.propertyId,
        restaurantId: body.restaurantId,
        tenantId: context.tenant.id,
      },
    });

    if (!order) {
      throw new BadRequestException(
        "Order was not found for this folio charge.",
      );
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new BadRequestException("This order is already final.");
    }

    const confirmedTotal = await this.confirmedOrderPaymentTotal(
      context.tenant.id,
      order.id,
    );
    const remaining = new Prisma.Decimal(order.totalAmount).minus(
      confirmedTotal,
    );
    const amount = new Prisma.Decimal(body.amount);

    if (!amount.equals(remaining)) {
      throw new BadRequestException(
        "Room charge amount must match the remaining order balance.",
      );
    }

    const existingRoomCharge = await this.prisma.orderPayment.findFirst({
      where: {
        method: "room_charge",
        orderId: order.id,
        status: "confirmed",
        tenantId: context.tenant.id,
      },
    });

    if (existingRoomCharge) {
      throw new BadRequestException(
        "This order has already been charged to a room.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.folioCharge.create({
        data: {
          amount,
          currency: order.currency,
          description:
            body.description?.trim() ||
            `Restaurant charge for order ${order.id}`,
          folioId: activeFolio?.id ?? null,
          orderId: order.id,
          postedById: context.tenantUser.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          stayId: stay.id,
          tenantId: context.tenant.id,
        },
      });

      const lineItem = activeFolio
        ? await tx.folioLineItem.create({
            data: {
              amount,
              currency: order.currency,
              description: charge.description,
              folioId: activeFolio.id,
              postedById: context.tenantUser.id,
              propertyId: order.propertyId,
              sourceId: order.id,
              sourceType: "restaurant_order",
              tenantId: context.tenant.id,
              type: "restaurant_charge",
              unitAmount: amount,
            },
          })
        : null;

      if (activeFolio) {
        await tx.guestFolio.update({
          where: { id: activeFolio.id },
          data: { balance: { increment: amount } },
        });
      }

      await tx.orderPayment.create({
        data: {
          amount,
          currency: order.currency,
          method: "room_charge",
          orderId: order.id,
          paidAt: new Date(),
          propertyId: order.propertyId,
          recordedById: context.tenantUser.id,
          reference: charge.id,
          restaurantId: order.restaurantId,
          status: "confirmed",
          tenantId: context.tenant.id,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          closedAt: new Date(),
          closedById: context.tenantUser.id,
          paymentStatus: "paid",
          status: "closed",
        },
      });

      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "cleaning" },
        });
      }

      await tx.orderAuditLog.createMany({
        data: [
          {
            actorId: context.tenantUser.id,
            actorRole: context.role,
            event: "charge_to_room_posted",
            newState: toPrismaJson({
              amount: amount.toString(),
              folioLineItemId: lineItem?.id ?? null,
              folioChargeId: charge.id,
              folioId: activeFolio?.id ?? stay.id,
              legacyStayFolioId: stay.id,
              roomNumber: stay.room.number,
            }),
            orderId: order.id,
            propertyId: order.propertyId,
            restaurantId: order.restaurantId,
            tenantId: context.tenant.id,
          },
          {
            actorId: context.tenantUser.id,
            actorRole: context.role,
            event: "payment_confirmed",
            newState: toPrismaJson({
              amount: amount.toString(),
              method: "room_charge",
              reference: charge.id,
            }),
            orderId: order.id,
            propertyId: order.propertyId,
            restaurantId: order.restaurantId,
            tenantId: context.tenant.id,
          },
          {
            actorId: context.tenantUser.id,
            actorRole: context.role,
            event: "order_closed",
            newState: toPrismaJson({
              paymentStatus: updatedOrder.paymentStatus,
              status: updatedOrder.status,
            }),
            orderId: order.id,
            previousState: toPrismaJson({
              paymentStatus: order.paymentStatus,
              status: order.status,
            }),
            propertyId: order.propertyId,
            restaurantId: order.restaurantId,
            tenantId: context.tenant.id,
          },
        ],
      });

      return {
        chargeId: charge.id,
        folioId: activeFolio?.id ?? stay.id,
        orderId: order.id,
        status: "posted",
      };
    });
  }

  private async confirmedOrderPaymentTotal(tenantId: string, orderId: string) {
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

  private async buildRoomChargeReport(
    tenantId: string,
    query: RoomChargeReportQueryDto,
  ) {
    const { from, to } = resolveReportRange(query);
    const charges = await this.prisma.folioCharge.findMany({
      where: {
        createdAt: {
          gte: from,
          lt: to,
        },
        propertyId: query.propertyId,
        restaurantId: query.restaurantId ? query.restaurantId : { not: null },
        tenantId,
      },
      include: {
        stay: {
          include: {
            guest: true,
            room: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const restaurantIds = Array.from(
      new Set(charges.flatMap((charge) => charge.restaurantId ?? [])),
    );
    const restaurants = restaurantIds.length
      ? await this.prisma.restaurant.findMany({
          where: {
            id: { in: restaurantIds },
            tenantId,
          },
        })
      : [];
    const restaurantById = new Map(
      restaurants.map((restaurant) => [restaurant.id, restaurant]),
    );

    const rows = charges.map((charge) => {
      const restaurant = charge.restaurantId
        ? restaurantById.get(charge.restaurantId)
        : null;

      return {
        amount: charge.amount.toString(),
        chargeId: charge.id,
        createdAt: charge.createdAt.toISOString(),
        currency: charge.currency,
        description: charge.description,
        guestName:
          `${charge.stay.guest.firstName} ${charge.stay.guest.lastName}`.trim(),
        orderId: charge.orderId,
        propertyId: charge.propertyId,
        restaurantId: charge.restaurantId,
        restaurantName: restaurant?.name ?? "Unknown restaurant",
        roomNumber: charge.stay.room.number,
        stayId: charge.stayId,
      };
    });

    const totals = rows.reduce<Record<string, string>>((accumulator, row) => {
      const key = `${row.restaurantName} ${row.currency}`;
      const current = new Prisma.Decimal(accumulator[key] ?? 0);
      accumulator[key] = current.plus(row.amount).toString();
      return accumulator;
    }, {});

    return {
      from: from.toISOString(),
      rows,
      to: to.toISOString(),
      totals,
    };
  }

  private async buildRestaurantZReport(
    tenantId: string,
    query: RestaurantReportQueryDto,
  ) {
    const { from, to } = resolveReportRange(query);
    const where = {
      closedAt: {
        gte: from,
        lt: to,
      },
      propertyId: query.propertyId,
      restaurantId: query.restaurantId,
      status: "closed",
      tenantId,
    };
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        discounts: true,
        items: true,
        payments: {
          where: { status: "confirmed" },
        },
        restaurant: true,
      },
      orderBy: { closedAt: "asc" },
    });
    const orderIds = orders.map((order) => order.id);
    const voidedItems = orderIds.length
      ? await this.prisma.orderItem.findMany({
          where: {
            orderId: { in: orderIds },
            status: "voided",
            tenantId,
          },
          orderBy: { voidedAt: "asc" },
        })
      : [];

    const itemSubtotal = sumDecimals(orders.map((order) => order.subtotal));
    const netSales = sumDecimals(orders.map((order) => order.totalAmount));
    const paymentsCollected = sumDecimals(
      orders.flatMap((order) =>
        order.payments.map((payment) => payment.amount),
      ),
    );
    const paymentVariance = paymentsCollected.minus(netSales);
    const taxCollected = sumDecimals(orders.map((order) => order.taxAmount));
    const serviceChargeCollected = sumDecimals(
      orders.map((order) => order.serviceChargeAmount),
    );
    const discounts = sumDecimals(
      orders.flatMap((order) =>
        order.discounts.map((discount) => discount.amount),
      ),
    );
    const covers = orders.reduce((total, order) => total + order.covers, 0);
    const tablesUsed = new Set(
      orders.flatMap((order) => (order.tableId ? [order.tableId] : [])),
    ).size;
    const revenueByPaymentMethod = mapDecimalTotals(
      orders.flatMap((order) =>
        order.payments.map((payment) => ({
          amount: payment.amount,
          key: `${payment.method}|${payment.currency}`,
          method: payment.method,
          currency: payment.currency,
        })),
      ),
    ).map((row) => ({
      amount: row.amount,
      currency: row.currency,
      method: row.method,
    }));
    const topItems = mapItemTotals(
      orders.flatMap((order) =>
        order.items
          .filter((item) => item.status !== "voided")
          .map((item) => ({
            name: item.name,
            quantity: item.quantity,
            revenue: item.totalPrice,
          })),
      ),
    ).slice(0, 10);
    const voids = voidedItems.map((item) => ({
      createdAt: (item.voidedAt ?? item.updatedAt).toISOString(),
      itemName: item.name,
      orderId: item.orderId,
      reason: item.voidReason ?? "No reason recorded",
    }));

    return {
      filters: {
        propertyId: query.propertyId ?? null,
        restaurantId: query.restaurantId ?? null,
      },
      from: from.toISOString(),
      revenueByPaymentMethod,
      summary: {
        averageCoversPerTable: tablesUsed
          ? (covers / tablesUsed).toFixed(2)
          : "0.00",
        averageOrderValue: orders.length
          ? netSales.div(orders.length).toDecimalPlaces(2).toString()
          : "0.00",
        confirmedRevenue: paymentsCollected.toString(),
        covers,
        discounts: discounts.toString(),
        grossRevenue: netSales.toString(),
        itemSubtotal: itemSubtotal.toString(),
        netSales: netSales.toString(),
        orderCount: orders.length,
        paymentsCollected: paymentsCollected.toString(),
        paymentVariance: paymentVariance.toString(),
        serviceChargeCollected: serviceChargeCollected.toString(),
        taxCollected: taxCollected.toString(),
        voidCount: voids.length,
      },
      to: to.toISOString(),
      topItems,
      voids,
    };
  }

  private async buildRestaurantShiftReport(
    tenantId: string,
    query: RestaurantReportQueryDto,
  ) {
    const { from, to } = resolveReportRange(query);
    const orders = await this.prisma.order.findMany({
      where: {
        closedAt: {
          gte: from,
          lt: to,
        },
        propertyId: query.propertyId,
        restaurantId: query.restaurantId,
        status: "closed",
        tenantId,
      },
      include: {
        auditLogs: {
          where: {
            event: {
              in: ["order_created", "payment_confirmed", "order_closed"],
            },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          where: { status: "confirmed" },
        },
      },
      orderBy: { closedAt: "asc" },
    });
    const rows = new Map<
      string,
      {
        actorId: string;
        averageOrderValue: string;
        covers: number;
        netSales: Prisma.Decimal;
        orderCount: number;
        paymentsCollected: Prisma.Decimal;
        role: string;
      }
    >();

    for (const order of orders) {
      const auditActor =
        order.auditLogs.find((log) => log.event === "order_created") ??
        order.auditLogs.find((log) => log.event === "payment_confirmed") ??
        order.auditLogs.find((log) => log.event === "order_closed");
      const actorId =
        order.waiterId ??
        auditActor?.actorId ??
        order.closedById ??
        "unassigned";
      const role = auditActor?.actorRole ?? "unknown";
      const current = rows.get(actorId) ?? {
        actorId,
        averageOrderValue: "0.00",
        covers: 0,
        netSales: new Prisma.Decimal(0),
        orderCount: 0,
        paymentsCollected: new Prisma.Decimal(0),
        role,
      };

      current.covers += order.covers;
      current.netSales = current.netSales.plus(order.totalAmount);
      current.orderCount += 1;
      current.paymentsCollected = current.paymentsCollected.plus(
        sumDecimals(order.payments.map((payment) => payment.amount)),
      );
      current.role = current.role === "unknown" ? role : current.role;
      rows.set(actorId, current);
    }

    const reportRows = Array.from(rows.values())
      .map((row) => {
        const paymentVariance = row.paymentsCollected.minus(row.netSales);

        return {
          actorId: row.actorId,
          averageOrderValue: row.orderCount
            ? row.netSales.div(row.orderCount).toDecimalPlaces(2).toString()
            : "0.00",
          covers: row.covers,
          netSales: row.netSales.toString(),
          orderCount: row.orderCount,
          paymentsCollected: row.paymentsCollected.toString(),
          paymentVariance: paymentVariance.toString(),
          role: row.role,
        };
      })
      .sort((first, second) => second.orderCount - first.orderCount);

    return {
      filters: {
        propertyId: query.propertyId ?? null,
        restaurantId: query.restaurantId ?? null,
      },
      from: from.toISOString(),
      rows: reportRows,
      to: to.toISOString(),
    };
  }

  private async buildRestaurantLiveDashboard(
    tenantId: string,
    query: RestaurantReportQueryDto,
  ) {
    const [openOrders, activeTables, kitchenItems, roomChargePayments] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            propertyId: query.propertyId,
            restaurantId: query.restaurantId,
            status: { notIn: ["closed", "cancelled"] },
            tenantId,
          },
          include: {
            payments: {
              where: { status: "confirmed" },
            },
          },
        }),
        this.prisma.restaurantTable.findMany({
          where: {
            propertyId: query.propertyId,
            restaurantId: query.restaurantId,
            status: { in: ["reserved", "seated", "ordering", "served"] },
            tenantId,
          },
          select: { coverCount: true },
        }),
        this.prisma.orderItem.findMany({
          where: {
            order: {
              propertyId: query.propertyId,
              restaurantId: query.restaurantId,
              status: { notIn: ["closed", "cancelled"] },
              tenantId,
            },
            status: { in: ["sent", "preparing", "ready"] },
            tenantId,
          },
          select: {
            course: true,
            kitchenStation: true,
            preparedAt: true,
            sentAt: true,
            status: true,
          },
        }),
        this.prisma.orderPayment.findMany({
          where: {
            method: "room_charge",
            order: {
              propertyId: query.propertyId,
              restaurantId: query.restaurantId,
              tenantId,
            },
            status: "confirmed",
            tenantId,
          },
          select: { amount: true, currency: true },
        }),
      ]);
    const openOrderValue = sumDecimals(
      openOrders.map((order) => order.totalAmount),
    );
    const openPaidValue = sumDecimals(
      openOrders.flatMap((order) =>
        order.payments.map((payment) => payment.amount),
      ),
    );
    const coversInHouse = activeTables.reduce(
      (total, table) => total + table.coverCount,
      0,
    );
    const stationQueueDepth = mapStationQueueDepth(kitchenItems);
    const averagePrepMinutesByCourse =
      mapAveragePrepMinutesByCourse(kitchenItems);
    const outstandingRoomCharges = mapDecimalTotals(
      roomChargePayments.map((payment) => ({
        amount: payment.amount,
        currency: payment.currency,
        key: `room_charge|${payment.currency}`,
        method: "room_charge",
      })),
    );

    return {
      filters: {
        propertyId: query.propertyId ?? null,
        restaurantId: query.restaurantId ?? null,
      },
      generatedAt: new Date().toISOString(),
      kds: {
        averagePrepMinutesByCourse,
        stationQueueDepth,
      },
      openOrders: {
        count: openOrders.length,
        outstandingValue: openOrderValue.minus(openPaidValue).toString(),
        paidValue: openPaidValue.toString(),
        totalValue: openOrderValue.toString(),
      },
      roomCharges: {
        confirmedPosted: outstandingRoomCharges,
      },
      tables: {
        activeTableCount: activeTables.length,
        coversInHouse,
      },
    };
  }
}

function canSearchActiveStays(role: TenantRole) {
  return [
    "owner",
    "admin",
    "restaurant_manager",
    "waiter",
    "front_desk",
  ].includes(role);
}

function canPostRoomCharge(role: TenantRole) {
  return [
    "owner",
    "admin",
    "restaurant_manager",
    "waiter",
    "front_desk",
  ].includes(role);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function csvCell(value: string | null) {
  const cell = value ?? "";
  return `"${cell.replaceAll('"', '""')}"`;
}

function sumDecimals(values: Prisma.Decimal.Value[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(new Prisma.Decimal(value)),
    new Prisma.Decimal(0),
  );
}

function mapDecimalTotals(
  rows: Array<{
    amount: Prisma.Decimal;
    currency: string;
    key: string;
    method: string;
  }>,
) {
  const totals = new Map<
    string,
    { amount: Prisma.Decimal; currency: string; method: string }
  >();

  for (const row of rows) {
    const current = totals.get(row.key);
    totals.set(row.key, {
      amount: (current?.amount ?? new Prisma.Decimal(0)).plus(
        new Prisma.Decimal(row.amount),
      ),
      currency: row.currency,
      method: row.method,
    });
  }

  return Array.from(totals.values())
    .map((row) => ({
      amount: row.amount.toString(),
      currency: row.currency,
      method: row.method,
    }))
    .sort((first, second) => first.method.localeCompare(second.method));
}

function mapItemTotals(
  rows: Array<{
    name: string;
    quantity: number;
    revenue: Prisma.Decimal;
  }>,
) {
  const totals = new Map<
    string,
    { name: string; quantity: number; revenue: Prisma.Decimal }
  >();

  for (const row of rows) {
    const current = totals.get(row.name);
    totals.set(row.name, {
      name: row.name,
      quantity: (current?.quantity ?? 0) + row.quantity,
      revenue: (current?.revenue ?? new Prisma.Decimal(0)).plus(
        new Prisma.Decimal(row.revenue),
      ),
    });
  }

  return Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue.toString(),
    }))
    .sort((first, second) => second.quantity - first.quantity);
}

function mapStationQueueDepth(
  items: Array<{
    kitchenStation: string | null;
    status: string;
  }>,
) {
  const totals = new Map<
    string,
    {
      preparing: number;
      ready: number;
      sent: number;
      station: string;
      total: number;
    }
  >();

  for (const item of items) {
    const station = item.kitchenStation ?? "unassigned";
    const current = totals.get(station) ?? {
      preparing: 0,
      ready: 0,
      sent: 0,
      station,
      total: 0,
    };

    if (item.status === "sent") {
      current.sent += 1;
    }

    if (item.status === "preparing") {
      current.preparing += 1;
    }

    if (item.status === "ready") {
      current.ready += 1;
    }

    current.total += 1;
    totals.set(station, current);
  }

  return Array.from(totals.values()).sort((first, second) =>
    first.station.localeCompare(second.station),
  );
}

function mapAveragePrepMinutesByCourse(
  items: Array<{
    course: number;
    preparedAt: Date | null;
    sentAt: Date | null;
  }>,
) {
  const totals = new Map<
    number,
    { course: number; count: number; totalMinutes: number }
  >();

  for (const item of items) {
    if (!item.sentAt || !item.preparedAt) {
      continue;
    }

    const minutes = Math.max(
      0,
      Math.round((item.preparedAt.getTime() - item.sentAt.getTime()) / 60000),
    );
    const current = totals.get(item.course) ?? {
      course: item.course,
      count: 0,
      totalMinutes: 0,
    };

    current.count += 1;
    current.totalMinutes += minutes;
    totals.set(item.course, current);
  }

  return Array.from(totals.values())
    .map((row) => ({
      averageMinutes: row.count
        ? (row.totalMinutes / row.count).toFixed(1)
        : "0.0",
      course: row.course,
      sampleSize: row.count,
    }))
    .sort((first, second) => first.course - second.course);
}

function resolveReportRange(query: RoomChargeReportQueryDto) {
  const from = new Date(
    query.from ?? `${query.date ?? todayIsoDate()}T00:00:00.000Z`,
  );
  const to = query.to
    ? new Date(query.to)
    : new Date(from.getTime() + 24 * 60 * 60 * 1000);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to
  ) {
    throw new BadRequestException("Choose a valid report date range.");
  }

  return { from, to };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
