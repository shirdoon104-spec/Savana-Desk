import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Prisma } from "@rayaan/database";
import { PrismaService } from "../database/prisma.service";

class PublicOrderItemDto {
  @IsString()
  @MaxLength(128)
  menuItemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  notes?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

class CreatePublicOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  guestName?: string;

  @IsUUID()
  @IsOptional()
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];
}

@Controller("public/menu")
export class PublicMenuController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":restaurantId/:tableId")
  async getMenu(
    @Param("restaurantId") restaurantId: string,
    @Param("tableId") tableId: string,
  ) {
    const table = await this.findPublicTable(restaurantId, tableId);
    const restaurant = table.restaurant;

    return {
      property: {
        currency: restaurant.property.currency,
        id: restaurant.property.id,
        name: restaurant.property.name,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        serviceStyle: restaurant.serviceStyle,
      },
      table: {
        coverCount: table.coverCount,
        id: table.id,
        name: table.name,
        qrCode: table.qrCode ?? `/menu/${restaurant.id}/${table.id}`,
        status: table.status,
      },
      menuCategories: restaurant.menuCategories.map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => serializePublicMenuItem(item)),
      })),
      menuItems: restaurant.menuItems.map((item) => serializePublicMenuItem(item)),
    };
  }

  @Post(":restaurantId/:tableId/orders")
  async createOrder(
    @Param("restaurantId") restaurantId: string,
    @Param("tableId") tableId: string,
    @Body() body: CreatePublicOrderDto,
  ) {
    if (!body.items.length) {
      throw new BadRequestException("Choose at least one item.");
    }

    const table = await this.findPublicTable(restaurantId, tableId);
    const restaurant = table.restaurant;

    if (body.idempotencyKey) {
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          idempotencyKey: body.idempotencyKey,
          tenantId: restaurant.tenantId,
        },
        include: { items: true },
      });

      if (existingOrder) {
        return serializePublicOrder(existingOrder);
      }
    }

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        restaurantId: restaurant.id,
        status: { notIn: ["closed", "cancelled"] },
        tableId: table.id,
        tenantId: restaurant.tenantId,
      },
      select: { id: true },
    });

    if (activeOrder) {
      throw new BadRequestException(
        "This table already has an open order. Please ask staff to add items.",
      );
    }

    const menuItems = await this.prisma.menuItem.findMany({
      include: { category: true },
      where: {
        id: { in: body.items.map((item) => item.menuItemId) },
        isActive: true,
        restaurantId: restaurant.id,
        tenantId: restaurant.tenantId,
      },
    });

    if (menuItems.length !== body.items.length) {
      throw new BadRequestException("One or more menu items were not found.");
    }

    const itemRows = body.items.map((item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem) {
        throw new BadRequestException("One or more menu items were not found.");
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
        status: "pending" as const,
        tenantId: restaurant.tenantId,
        totalPrice,
        unitPrice,
      };
    });
    const subtotal = itemRows.reduce(
      (total, item) => total.plus(item.totalPrice),
      new Prisma.Decimal(0),
    );
    const totals = calculateOrderTotals(subtotal);

    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          currency: restaurant.property.currency,
          discountAmount: totals.discountAmount,
          idempotencyKey: body.idempotencyKey ?? null,
          items: { create: itemRows },
          notes: body.guestName?.trim()
            ? `QR guest: ${body.guestName.trim()}`
            : "QR guest order",
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          serviceChargeAmount: totals.serviceChargeAmount,
          serviceChargeRate: totals.serviceChargeRate,
          source: "dine_in",
          status: "draft",
          subtotal: totals.subtotal,
          tableId: table.id,
          tenantId: restaurant.tenantId,
          totalAmount: totals.totalAmount,
          taxAmount: totals.taxAmount,
          taxRate: totals.taxRate,
        },
        include: { items: true },
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: null,
          actorRole: "guest",
          event: "order_created",
          newState: toPrismaJson({
            source: "qr_table_ordering",
            status: order.status,
            tableId: order.tableId,
            totalAmount: order.totalAmount.toString(),
          }),
          orderId: order.id,
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          tenantId: restaurant.tenantId,
        },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: "ordering" },
      });

      return order;
    });

    return serializePublicOrder(order);
  }

  private async findPublicTable(restaurantId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: {
        id: tableId,
        restaurantId,
      },
      include: {
        restaurant: {
          include: {
            menuCategories: {
              include: {
                items: {
                  orderBy: { createdAt: "asc" },
                  where: { isActive: true },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              where: { isActive: true },
            },
            menuItems: {
              orderBy: { createdAt: "asc" },
              where: { isActive: true },
            },
            property: true,
          },
        },
      },
    });

    if (!table) {
      throw new BadRequestException("This table menu link is not available.");
    }

    return table;
  }
}

function serializePublicMenuItem(item: {
  allergens: string[];
  categoryId: string | null;
  currency: string;
  description: string | null;
  dietary: string[];
  id: string;
  imageUrl: string | null;
  name: string;
  price: Prisma.Decimal;
}) {
  return {
    allergens: item.allergens,
    categoryId: item.categoryId,
    currency: item.currency,
    description: item.description,
    dietary: item.dietary,
    id: item.id,
    imageUrl: item.imageUrl,
    name: item.name,
    price: Number(item.price),
  };
}

function serializePublicOrder(order: {
  currency: string;
  id: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    totalPrice: Prisma.Decimal;
  }>;
  status: string;
  totalAmount: Prisma.Decimal;
}) {
  return {
    currency: order.currency,
    id: order.id,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
    })),
    status: order.status,
    totalAmount: Number(order.totalAmount),
  };
}

function calculateOrderTotals(
  subtotal: Prisma.Decimal,
  requestedDiscountAmount = new Prisma.Decimal(0),
) {
  const taxRate = readDecimalEnv("RESTAURANT_TAX_RATE");
  const serviceChargeRate = readDecimalEnv("RESTAURANT_SERVICE_CHARGE_RATE");
  const discountAmount = Prisma.Decimal.min(requestedDiscountAmount, subtotal);
  const serviceChargeAmount = roundMoney(subtotal.minus(discountAmount).mul(serviceChargeRate));
  const taxableBase = subtotal.plus(serviceChargeAmount).minus(discountAmount);
  const taxAmount = roundMoney(taxableBase.mul(taxRate));

  return {
    discountAmount,
    serviceChargeAmount,
    serviceChargeRate,
    subtotal,
    taxAmount,
    taxRate,
    totalAmount: roundMoney(taxableBase.plus(taxAmount)),
  };
}

function readDecimalEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    return new Prisma.Decimal(0);
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    return new Prisma.Decimal(0);
  }
}

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
