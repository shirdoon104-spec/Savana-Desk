import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Prisma } from "@rayaan/database";
import type { TenantRole } from "@rayaan/shared";
import { ClerkClientService } from "../auth/clerk-client.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import { KitchenEventsService } from "../events/kitchen-events.service";
import type { TenantContext } from "../tenancy/tenant-context.service";

const tableStatuses = [
  "free",
  "reserved",
  "seated",
  "ordering",
  "served",
  "cleaning",
] as const;
const orderStatuses = [
  "draft",
  "sent",
  "preparing",
  "ready",
  "served",
  "closed",
  "cancelled",
] as const;
const discountTypes = ["percent", "fixed", "item"] as const;
const manualOrderPaymentMethods = [
  "cash",
  "card_manual",
  "room_charge",
  "complimentary",
  "voucher",
] as const;
const kitchenStationTypes = [
  "bar",
  "grill",
  "main_kitchen",
  "dessert",
  "cold_station",
] as const;
const allergenFlags = ["nuts", "gluten", "dairy", "eggs", "shellfish", "soy"] as const;
const dietaryFlags = [
  "vegan",
  "vegetarian",
  "halal",
  "kosher",
  "gluten_free",
] as const;
const reservationStatuses = [
  "confirmed",
  "waitlisted",
  "seated",
  "cancelled",
  "no_show",
] as const;
const waiterRoles = ["owner", "admin", "restaurant_manager", "waiter"] as const;

type TableStatus = (typeof tableStatuses)[number];
type OrderStatus = (typeof orderStatuses)[number];
type DiscountType = (typeof discountTypes)[number];
type ManualOrderPaymentMethod = (typeof manualOrderPaymentMethods)[number];
type KitchenStationType = (typeof kitchenStationTypes)[number];
type AllergenFlag = (typeof allergenFlags)[number];
type DietaryFlag = (typeof dietaryFlags)[number];
type ReservationStatus = (typeof reservationStatuses)[number];

interface SerializableOrder {
  createdAt: Date;
  currency: string;
  id: string;
  items: Array<{
    id: string;
    allergens: string[];
    course: number;
    dietary: string[];
    kitchenStation: string | null;
    menuItemId: string | null;
    modifiers: unknown;
    name: string;
    notes: string | null;
    preparedAt: Date | null;
    quantity: number;
    sentAt: Date | null;
    status: string;
    totalPrice: number;
    unitPrice: number;
  }>;
  paidAmount: number;
  paymentStatus: string;
  notes: string | null;
  status: string;
  tableId: string | null;
  totalAmount: number;
}

class CreateTableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  coverCount?: number;
}

class CreateMenuCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(kitchenStationTypes)
  @IsOptional()
  defaultStation?: KitchenStationType;
}

class CreateMenuItemDto {
  @IsArray()
  @IsIn(allergenFlags, { each: true })
  @IsOptional()
  allergens?: AllergenFlag[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  categoryId?: string;

  @IsArray()
  @IsIn(dietaryFlags, { each: true })
  @IsOptional()
  dietary?: DietaryFlag[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsIn(kitchenStationTypes)
  @IsOptional()
  kitchenStation?: KitchenStationType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;
}

class CreateKitchenStationDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(kitchenStationTypes)
  type!: KitchenStationType;
}

class CreateRestaurantDto {
  @IsString()
  @MaxLength(128)
  propertyId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceStyle?: string;
}

class UpdateTableStatusDto {
  @IsIn(tableStatuses)
  status!: TableStatus;
}

class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedWaiterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedWaiterUserId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  coverCount?: number;

  @IsIn(tableStatuses)
  @IsOptional()
  status?: TableStatus;
}

class CreateOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  tableId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  totalAmount?: number;
}

class CreateOrderItemDto {
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

class AddOrderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

class UpdateOrderItemDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  course?: number;

  @IsOptional()
  @IsArray()
  modifiers?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  notes?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantity?: number;
}

class UpdateOrderStatusDto {
  @IsIn(orderStatuses)
  status!: OrderStatus;
}

class UpdateOrderItemStatusDto {
  @IsIn(["preparing", "ready", "served"])
  status!: "preparing" | "ready" | "served";
}

class VoidOrderItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  voidReason!: string;
}

class FireCourseDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  course!: number;
}

class ApplyDiscountDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  orderItemId?: string;

  @IsIn(discountTypes)
  type!: DiscountType;
}

class RecordOrderPaymentDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsIn(manualOrderPaymentMethods)
  method!: ManualOrderPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;
}

class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

class TransferTableDto {
  @IsString()
  @MaxLength(128)
  tableId!: string;
}

class CreateReservationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guestName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  guestId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  partySize!: number;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsIn(reservationStatuses)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  tableId?: string;
}

class UpdateReservationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  partySize?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsIn(reservationStatuses)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  tableId?: string;
}

function canCreateOrder(role: TenantRole) {
  return ["owner", "admin", "restaurant_manager", "waiter"].includes(role);
}

function canManageRestaurant(role: TenantRole) {
  return ["owner", "admin", "restaurant_manager"].includes(role);
}

function canTakeRestaurantPayment(role: TenantRole) {
  return [
    "owner",
    "admin",
    "restaurant_manager",
    "waiter",
    "accountant",
    "front_desk",
  ].includes(role);
}

function allowedOrderStatusesForRole(role: TenantRole): OrderStatus[] {
  if (role === "owner" || role === "admin" || role === "restaurant_manager") {
    return [...orderStatuses];
  }

  if (role === "waiter") {
    return ["draft", "sent", "served", "cancelled"];
  }

  if (role === "kitchen") {
    return ["preparing", "ready"];
  }

  return [];
}

function allowedTableStatusesForRole(role: TenantRole): TableStatus[] {
  if (role === "owner" || role === "admin" || role === "restaurant_manager") {
    return [...tableStatuses];
  }

  if (role === "waiter") {
    return ["free", "reserved", "seated", "ordering", "served"];
  }

  return [];
}

function getPrimaryEmail(user: any) {
  const primaryEmail = user.emailAddresses?.find(
    (email: any) => email.id === user.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress;
}

function getDisplayName(user: any) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return fullName || getPrimaryEmail(user) || user.id;
}

function serializeOrder(order: {
  createdAt: Date;
  currency: string;
  id: string;
  items?: Array<{
    id: string;
    menuItem?: {
      allergens: string[];
      dietary: string[];
    } | null;
    course?: number;
    kitchenStation?: string | null;
    menuItemId: string | null;
    modifiers?: unknown;
    name: string;
    notes: string | null;
    preparedAt?: Date | null;
    quantity: number;
    sentAt?: Date | null;
    status?: string;
    totalPrice: { toString(): string };
    unitPrice: { toString(): string };
  }>;
  payments?: Array<{
    amount: { toString(): string };
    status: string;
  }>;
  paymentStatus?: string;
  notes?: string | null;
  status: string;
  tableId: string | null;
  totalAmount: { toString(): string };
}): SerializableOrder {
  return {
    createdAt: order.createdAt,
    currency: order.currency,
    id: order.id,
    items: (order.items ?? []).map((item) => ({
    id: item.id,
    allergens: item.menuItem?.allergens ?? [],
    course: item.course ?? 1,
    dietary: item.menuItem?.dietary ?? [],
    kitchenStation: item.kitchenStation ?? null,
    menuItemId: item.menuItemId,
    modifiers: item.modifiers ?? null,
    name: item.name,
    notes: item.notes,
    preparedAt: item.preparedAt ?? null,
    quantity: item.quantity,
    sentAt: item.sentAt ?? null,
    status: item.status ?? "sent",
    totalPrice: Number(item.totalPrice),
      unitPrice: Number(item.unitPrice),
    })),
    paidAmount: (order.payments ?? [])
      .filter((payment) => payment.status === "confirmed")
      .reduce((total, payment) => total + Number(payment.amount), 0),
    paymentStatus: order.paymentStatus ?? "unpaid",
    notes: order.notes ?? null,
    status: order.status,
    tableId: order.tableId,
    totalAmount: Number(order.totalAmount),
  };
}

@Controller("restaurants")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class RestaurantsController {
  constructor(
    private readonly clerkClients: ClerkClientService,
    private readonly kitchenEvents: KitchenEventsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission("restaurant.read")
  async list(@CurrentTenant() context: TenantContext): Promise<Record<string, unknown>> {
    const properties = await this.prisma.property.findMany({
      where: { tenantId: context.tenant.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
    const restaurants = await this.prisma.restaurant.findMany({
      where: { tenantId: context.tenant.id },
      include: {
        orders: {
          include: {
            items: {
              include: {
                menuItem: {
                  select: {
                    allergens: true,
                    dietary: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
            payments: {
              where: { status: "confirmed" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        menuCategories: {
          include: {
            items: {
              where: { isActive: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          where: { isActive: true },
        },
        kitchenStations: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          where: { isActive: true },
        },
        menuItems: {
          orderBy: { createdAt: "asc" },
          where: { isActive: true },
        },
        property: true,
        reservations: {
          include: { items: { orderBy: { createdAt: "asc" } } },
          orderBy: { scheduledAt: "asc" },
          where: {
            status: { in: ["confirmed", "waitlisted"] },
          },
          take: 50,
        },
        tables: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const assignableUsers = await this.listAssignableWaiters(context.tenant.id);

    return {
      allowedOrderStatuses: allowedOrderStatusesForRole(context.role),
      allowedTableStatuses: allowedTableStatusesForRole(context.role),
      canCreateOrder: canCreateOrder(context.role),
      canManageRestaurant: ["owner", "admin", "restaurant_manager"].includes(
        context.role,
      ),
      currentUser: {
        clerkUserId: context.tenantUser.clerkUserId,
        role: context.role,
      },
      assignableWaiters: assignableUsers,
      properties,
      tenant: context.tenant,
      restaurants: restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        property: {
          id: restaurant.property.id,
          name: restaurant.property.name,
        },
        serviceStyle: restaurant.serviceStyle,
        menuCategories: restaurant.menuCategories.map((category) => ({
          defaultStation: category.defaultStation,
          id: category.id,
          items: category.items.map((item) => ({
            allergens: item.allergens,
            categoryId: item.categoryId,
            currency: item.currency,
            description: item.description,
            dietary: item.dietary,
            id: item.id,
            imageUrl: item.imageUrl,
            kitchenStation: item.kitchenStation,
            name: item.name,
            price: Number(item.price),
          })),
          name: category.name,
        })),
        kitchenStations: restaurant.kitchenStations.map((station) => ({
          displayOrder: station.displayOrder,
          id: station.id,
          name: station.name,
          type: station.type,
        })),
        menuItems: restaurant.menuItems.map((item) => ({
          allergens: item.allergens,
          categoryId: item.categoryId,
          currency: item.currency,
          description: item.description,
          dietary: item.dietary,
          id: item.id,
          imageUrl: item.imageUrl,
          kitchenStation: item.kitchenStation,
          name: item.name,
          price: Number(item.price),
        })),
        reservations: restaurant.reservations.map((reservation) =>
          this.serializeReservation(reservation, restaurant.tables),
        ),
        tables: restaurant.tables.map((table) => ({
          assignedWaiterName: table.assignedWaiterName,
          assignedWaiterUserId: table.assignedWaiterUserId,
          coverCount: table.coverCount,
          id: table.id,
          name: table.name,
          qrCode: table.qrCode ?? `/menu/${restaurant.id}/${table.id}`,
          status: table.status,
        })),
        orders: restaurant.orders.map((order) => serializeOrder(order)),
      })),
    };
  }

  @Post(":restaurantId/menu-categories")
  @RequirePermission("restaurant.manage")
  async createMenuCategory(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Body() body: CreateMenuCategoryDto,
  ): Promise<Record<string, unknown>> {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    return this.prisma.menuCategory.create({
      data: {
        defaultStation: body.defaultStation,
        name: body.name.trim(),
        propertyId: restaurant.propertyId,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });
  }

  @Post(":restaurantId/menu-items")
  @RequirePermission("restaurant.manage")
  async createMenuItem(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Body() body: CreateMenuItemDto,
  ): Promise<{
    allergens: string[];
    categoryId: string | null;
    currency: string;
    description: string | null;
    dietary: string[];
    id: string;
    imageUrl: string | null;
    kitchenStation: string | null;
    name: string;
    price: number;
  }> {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    if (body.categoryId) {
      await this.findTenantMenuCategory(
        context.tenant.id,
        restaurant.id,
        body.categoryId,
      );
    }

    const menuItem = await this.prisma.menuItem.create({
      data: {
        allergens: body.allergens ?? [],
        categoryId: body.categoryId || null,
        currency: restaurant.property.currency,
        description: body.description?.trim() || null,
        dietary: body.dietary ?? [],
        imageUrl: body.imageUrl?.trim() || null,
        kitchenStation: body.kitchenStation,
        name: body.name.trim(),
        price: body.price,
        propertyId: restaurant.propertyId,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    return {
      allergens: menuItem.allergens,
      categoryId: menuItem.categoryId,
      currency: menuItem.currency,
      description: menuItem.description,
      dietary: menuItem.dietary,
      id: menuItem.id,
      imageUrl: menuItem.imageUrl,
      kitchenStation: menuItem.kitchenStation,
      name: menuItem.name,
      price: Number(menuItem.price),
    };
  }

  @Post(":restaurantId/kitchen-stations")
  @RequirePermission("restaurant.manage")
  async createKitchenStation(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Body() body: CreateKitchenStationDto,
  ): Promise<Record<string, unknown>> {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    return this.prisma.kitchenStation.upsert({
      where: {
        restaurantId_type: {
          restaurantId: restaurant.id,
          type: body.type,
        },
      },
      create: {
        displayOrder: body.displayOrder ?? 0,
        name: body.name.trim(),
        propertyId: restaurant.propertyId,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
        type: body.type,
      },
      update: {
        displayOrder: body.displayOrder ?? 0,
        isActive: true,
        name: body.name.trim(),
      },
    });
  }

  @Post()
  @RequirePermission("restaurant.manage")
  async create(
    @CurrentTenant() context: TenantContext,
    @Body() body: CreateRestaurantDto,
  ) {
    const property = await this.findTenantProperty(
      context.tenant.id,
      body.propertyId,
    );

    const restaurant = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: body.name.trim(),
          propertyId: property.id,
          serviceStyle: body.serviceStyle?.trim() || null,
          tenantId: context.tenant.id,
        },
      });

      await tx.tenant.update({
        where: { id: context.tenant.id },
        data: { operatingModel: "hotel_restaurant" },
      });

      return restaurant;
    });

    return restaurant;
  }

  @Post(":restaurantId/tables")
  @RequirePermission("restaurant.manage")
  async createTable(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Body() body: CreateTableDto,
  ) {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );
    const name = body.name.trim();
    const tableId = randomUUID();

    return this.prisma.restaurantTable.create({
      data: {
        id: tableId,
        name,
        coverCount: body.coverCount ?? 0,
        propertyId: restaurant.propertyId,
        qrCode: `/menu/${restaurant.id}/${tableId}`,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });
  }

  @Patch(":restaurantId/tables/:tableId")
  @RequirePermission("restaurant.read")
  async updateTable(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("tableId") tableId: string,
    @Body() body: UpdateTableDto,
  ) {
    await this.findTenantRestaurant(context.tenant.id, restaurantId);
    const table = await this.findTenantTable(
      context.tenant.id,
      restaurantId,
      tableId,
    );

    if (body.status && !allowedTableStatusesForRole(context.role).includes(body.status)) {
      throw new BadRequestException("Your role cannot set tables to that status.");
    }

    if (
      (body.coverCount !== undefined || body.assignedWaiterName !== undefined) &&
      !["owner", "admin", "restaurant_manager", "waiter"].includes(context.role)
    ) {
      throw new BadRequestException("Your role cannot update table service details.");
    }

    return this.prisma.restaurantTable.update({
      where: { id: table.id },
      data: {
        ...(body.status === "free"
          ? { assignedWaiterName: null, assignedWaiterUserId: null }
          : await this.resolveWaiterAssignment(context.tenant.id, body)),
        coverCount: body.status === "free" ? 0 : body.coverCount,
        status: body.status,
      },
    });
  }

  @Patch(":restaurantId/tables/:tableId/status")
  @RequirePermission("restaurant.read")
  async updateTableStatus(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("tableId") tableId: string,
    @Body() body: UpdateTableStatusDto,
  ) {
    await this.findTenantRestaurant(context.tenant.id, restaurantId);
    const table = await this.findTenantTable(
      context.tenant.id,
      restaurantId,
      tableId,
    );

    if (!allowedTableStatusesForRole(context.role).includes(body.status)) {
      throw new BadRequestException("Your role cannot set tables to that status.");
    }

    return this.prisma.restaurantTable.update({
      where: { id: table.id },
      data: {
        assignedWaiterName: body.status === "free" ? null : undefined,
        assignedWaiterUserId: body.status === "free" ? null : undefined,
        coverCount: body.status === "free" ? 0 : undefined,
        status: body.status,
      },
    });
  }

  @Post(":restaurantId/reservations")
  @RequirePermission("restaurant.manage")
  async createReservation(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Body() body: CreateReservationDto,
  ) {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    if (body.tableId) {
      await this.findTenantTable(context.tenant.id, restaurant.id, body.tableId);
    }

    const itemRows = await this.buildReservationItemRows(
      context.tenant.id,
      restaurant.propertyId,
      restaurant.id,
      body.items ?? [],
    );

    const reservation = await this.prisma.reservation.create({
      data: {
        guestId: body.guestId?.trim() || null,
        guestName: body.guestName.trim(),
        items: itemRows.length ? { create: itemRows } : undefined,
        notes: body.notes?.trim() || null,
        partySize: body.partySize,
        propertyId: restaurant.propertyId,
        restaurantId: restaurant.id,
        scheduledAt: new Date(body.scheduledAt),
        status: body.status ?? "confirmed",
        tableId: body.tableId || null,
        tenantId: context.tenant.id,
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    if (reservation.tableId && reservation.status === "confirmed") {
      await this.prisma.restaurantTable.update({
        where: { id: reservation.tableId },
        data: { status: "reserved" },
      });
    }

    const tables = await this.prisma.restaurantTable.findMany({
      orderBy: { createdAt: "asc" },
      where: {
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    return this.serializeReservation(reservation, tables);
  }

  @Patch(":restaurantId/reservations/:reservationId")
  @RequirePermission("restaurant.manage")
  async updateReservation(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("reservationId") reservationId: string,
    @Body() body: UpdateReservationDto,
  ) {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );
    const existing = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    if (!existing) {
      throw new BadRequestException("Reservation was not found for this restaurant.");
    }

    if (body.tableId) {
      await this.findTenantTable(context.tenant.id, restaurant.id, body.tableId);
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const itemRows = body.items
        ? await this.buildReservationItemRows(
            context.tenant.id,
            restaurant.propertyId,
            restaurant.id,
            body.items,
          )
        : null;

      if (itemRows) {
        await tx.reservationItem.deleteMany({
          where: { reservationId: existing.id, tenantId: context.tenant.id },
        });
      }

      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          items: itemRows ? { create: itemRows } : undefined,
          notes: body.notes !== undefined ? body.notes.trim() || null : undefined,
          partySize: body.partySize,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
          status: body.status,
          tableId: body.tableId !== undefined ? body.tableId || null : undefined,
        },
      });

      if (existing.tableId && existing.tableId !== reservation.tableId) {
        await tx.restaurantTable.update({
          where: { id: existing.tableId },
          data: { status: "free" },
        });
      }

      if (reservation.tableId) {
        const nextTableStatus =
          reservation.status === "seated"
            ? "seated"
            : reservation.status === "confirmed"
              ? "reserved"
              : ["cancelled", "no_show"].includes(reservation.status)
                ? "free"
                : undefined;

        if (nextTableStatus) {
          await tx.restaurantTable.update({
            where: { id: reservation.tableId },
            data: { status: nextTableStatus },
          });
        }
      }

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    const tables = await this.prisma.restaurantTable.findMany({
      orderBy: { createdAt: "asc" },
      where: {
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    return this.serializeReservation(reservation, tables);
  }

  @Post(":restaurantId/orders")
  @RequirePermission("restaurant.read")
  async createOrder(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
    @Body() body: CreateOrderDto,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot create restaurant orders.");
    }

    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    if (body.tableId) {
      await this.findTenantTable(context.tenant.id, restaurant.id, body.tableId);
    }

    if (!body.items?.length && body.totalAmount === undefined) {
      throw new BadRequestException("Add menu items or enter an order total.");
    }

    const idempotencyKey = resolveOrderIdempotencyKey(
      idempotencyKeyHeader,
      body.idempotencyKey,
    );
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        idempotencyKey,
        tenantId: context.tenant.id,
      },
      include: { items: true },
    });

    if (existingOrder) {
      return serializeOrder(existingOrder);
    }

    const orderItems = body.items?.length
      ? await this.prisma.menuItem.findMany({
          include: {
            category: true,
          },
          where: {
            id: { in: body.items.map((item) => item.menuItemId) },
            isActive: true,
            restaurantId: restaurant.id,
            tenantId: context.tenant.id,
          },
        })
      : [];

    if (body.items?.length && orderItems.length !== body.items.length) {
      throw new BadRequestException("One or more menu items were not found.");
    }

    const itemRows = (body.items ?? []).map((item) => {
      const menuItem = orderItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem) {
        throw new BadRequestException("One or more menu items were not found.");
      }

      const unitPrice = Number(menuItem.price);
      const totalPrice = unitPrice * item.quantity;

      return {
        menuItemId: menuItem.id,
        kitchenStation:
          menuItem.kitchenStation ?? menuItem.category?.defaultStation ?? "main_kitchen",
        name: menuItem.name,
        notes: item.notes?.trim() || null,
        propertyId: restaurant.propertyId,
        quantity: item.quantity,
        sentAt: new Date(),
        status: "sent" as const,
        tenantId: context.tenant.id,
        totalPrice: new Prisma.Decimal(totalPrice),
        unitPrice: new Prisma.Decimal(unitPrice),
      };
    });
    const subtotal =
      itemRows.length > 0
        ? itemRows.reduce(
            (total, item) => total.plus(item.totalPrice),
            new Prisma.Decimal(0),
          )
        : new Prisma.Decimal(body.totalAmount ?? 0);
    const totals = calculateOrderTotals(subtotal);

    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          currency: restaurant.property.currency,
          items: itemRows.length
            ? {
                create: itemRows,
              }
            : undefined,
          discountAmount: totals.discountAmount,
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          serviceChargeAmount: totals.serviceChargeAmount,
          serviceChargeRate: totals.serviceChargeRate,
          status: "sent",
          subtotal: totals.subtotal,
          tableId: body.tableId || null,
          tenantId: context.tenant.id,
          totalAmount: totals.totalAmount,
          taxAmount: totals.taxAmount,
          taxRate: totals.taxRate,
          idempotencyKey,
        },
        include: { items: true },
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "order_created",
          newState: toPrismaJson({
            id: order.id,
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

      if (body.tableId) {
        await tx.restaurantTable.update({
          where: { id: body.tableId },
          data: { status: "ordering" },
        });
      }

      return order;
    });

    for (const item of order.items) {
      this.publishKitchenEvent(context.tenant.id, "item_fired", {
        itemId: item.id,
        orderId: order.id,
        restaurantId: order.restaurantId,
        status: item.status,
        tableId: order.tableId,
      });
    }

    return serializeOrder(order);
  }

  @Post(":restaurantId/orders/:orderId/items")
  @RequirePermission("restaurant.read")
  async addOrderItems(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: AddOrderItemsDto,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot add restaurant order items.");
    }

    if (!body.items.length) {
      throw new BadRequestException("Add at least one menu item.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const itemRows = await this.buildOrderItemRows(
      context.tenant.id,
      order.propertyId,
      restaurantId,
      order.id,
      body.items,
      "pending",
    );

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: itemRows,
      });
      const updatedOrder = await this.recalculateOrderTotals(tx, order);

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "item_added",
          newState: toPrismaJson({
            itemCount: itemRows.length,
            totalAmount: updatedOrder.totalAmount.toString(),
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    return serializeOrder(updatedOrder);
  }

  @Patch(":restaurantId/orders/:orderId/items/:itemId")
  @RequirePermission("restaurant.read")
  async updateOrderItem(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateOrderItemDto,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot update restaurant order items.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const item = await this.findTenantOrderItem(context.tenant.id, order.id, itemId);

    if (item.status !== "pending") {
      throw new BadRequestException("Only unsent items can be updated.");
    }

    const quantity = body.quantity ?? item.quantity;
    const modifiers = body.modifiers === undefined ? item.modifiers : body.modifiers;
    const modifierTotal = sumModifierAdjustments(modifiers);
    const totalPrice = new Prisma.Decimal(item.unitPrice)
      .mul(quantity)
      .plus(modifierTotal);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          course: body.course,
          modifiers: body.modifiers === undefined ? undefined : toPrismaJson(body.modifiers),
          notes: body.notes === undefined ? undefined : body.notes.trim() || null,
          quantity: body.quantity,
          totalPrice,
        },
      });
      const updatedOrder = await this.recalculateOrderTotals(tx, order);

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "status_changed",
          newState: toPrismaJson({
            itemId: item.id,
            totalAmount: updatedOrder.totalAmount.toString(),
          }),
          orderId: order.id,
          previousState: toPrismaJson({
            course: item.course,
            notes: item.notes,
            quantity: item.quantity,
            totalPrice: item.totalPrice.toString(),
          }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    for (const item of updatedOrder.items.filter(
      (candidate) => candidate.course === body.course && candidate.status === "sent",
    )) {
      this.publishKitchenEvent(context.tenant.id, "item_fired", {
        course: body.course,
        itemId: item.id,
        orderId: order.id,
        restaurantId: order.restaurantId,
        status: item.status,
        tableId: order.tableId,
      });
    }

    return serializeOrder(updatedOrder);
  }

  @Delete(":restaurantId/orders/:orderId/items/:itemId")
  @RequirePermission("restaurant.read")
  async removeOrderItem(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot remove restaurant order items.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const item = await this.findTenantOrderItem(context.tenant.id, order.id, itemId);

    if (item.status !== "pending") {
      throw new BadRequestException("Only unsent items can be removed.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({
        where: { id: item.id },
      });
      const updatedOrder = await this.recalculateOrderTotals(tx, order);

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "item_removed",
          previousState: toPrismaJson({
            itemId: item.id,
            name: item.name,
            totalPrice: item.totalPrice.toString(),
          }),
          newState: toPrismaJson({
            totalAmount: updatedOrder.totalAmount.toString(),
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/items/:itemId/void")
  @RequirePermission("restaurant.manage")
  async voidOrderItem(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() body: VoidOrderItemDto,
  ) {
    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const item = await this.findTenantOrderItem(context.tenant.id, order.id, itemId);

    if (item.status === "voided") {
      return serializeOrder(
        await this.prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: { orderBy: { createdAt: "asc" } } },
        }),
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          status: "voided",
          voidedAt: new Date(),
          voidedById: context.tenantUser.id,
          voidReason: body.voidReason.trim(),
        },
      });
      const updatedOrder = await this.recalculateOrderTotals(tx, order);

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "item_voided",
          previousState: toPrismaJson({
            itemId: item.id,
            status: item.status,
            totalPrice: item.totalPrice.toString(),
          }),
          newState: toPrismaJson({
            itemId: item.id,
            totalAmount: updatedOrder.totalAmount.toString(),
            voidReason: body.voidReason.trim(),
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    this.publishKitchenEvent(context.tenant.id, "item_voided", {
      itemId: item.id,
      orderId: order.id,
      restaurantId: order.restaurantId,
      status: "voided",
      tableId: order.tableId,
    });

    return serializeOrder(updatedOrder);
  }

  @Patch(":restaurantId/orders/:orderId/items/:itemId/status")
  @RequirePermission("restaurant.read")
  async updateOrderItemStatus(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateOrderItemStatusDto,
  ) {
    await this.findTenantRestaurant(context.tenant.id, restaurantId);
    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const item = await this.findTenantOrderItem(context.tenant.id, order.id, itemId);

    if (!["owner", "admin", "restaurant_manager", "kitchen", "waiter"].includes(context.role)) {
      throw new BadRequestException("Your role cannot update kitchen item status.");
    }

    if (item.status === "voided") {
      throw new BadRequestException("Voided items cannot be updated.");
    }

    if (body.status === "preparing" && item.status !== "sent") {
      throw new BadRequestException("Only sent items can start preparing.");
    }

    if (body.status === "ready" && !["sent", "preparing"].includes(item.status)) {
      throw new BadRequestException("Only sent or preparing items can be marked ready.");
    }

    if (body.status === "served" && item.status !== "ready") {
      throw new BadRequestException("Only ready items can be marked served.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: itemStatusUpdateForKitchenStatus(body.status),
      });

      const activeItems = await tx.orderItem.findMany({
        where: {
          orderId: order.id,
          status: { not: "voided" },
          tenantId: context.tenant.id,
        },
        select: { status: true },
      });
      const nextOrderStatus = deriveOrderStatusFromItems(activeItems);
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: nextOrderStatus },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "status_changed",
          newState: toPrismaJson({
            itemId: item.id,
            status: body.status,
          }),
          orderId: order.id,
          previousState: toPrismaJson({
            itemId: item.id,
            status: item.status,
          }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return updatedOrder;
    });

    if (body.status === "ready") {
      this.publishKitchenEvent(context.tenant.id, "item_ready", {
        itemId: item.id,
        orderId: order.id,
        restaurantId: order.restaurantId,
        status: body.status,
        tableId: order.tableId,
      });

      const courseItems = updatedOrder.items.filter(
        (candidate) =>
          candidate.course === item.course && candidate.status !== "voided",
      );

      if (
        courseItems.length > 0 &&
        courseItems.every((candidate) =>
          ["ready", "served"].includes(candidate.status),
        )
      ) {
        this.publishKitchenEvent(context.tenant.id, "course_ready", {
          course: item.course,
          orderId: order.id,
          restaurantId: order.restaurantId,
          status: "ready",
          tableId: order.tableId,
        });
      }
    }

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/fire-course")
  @RequirePermission("restaurant.read")
  async fireCourse(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: FireCourseDto,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot fire courses.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: {
          course: body.course,
          orderId: order.id,
          status: "pending",
          tenantId: context.tenant.id,
        },
        data: {
          sentAt: new Date(),
          status: "sent",
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          courseCount: Math.max(order.courseCount, body.course),
          status: order.status === "draft" ? "sent" : undefined,
        },
      });
      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "course_fired",
          newState: toPrismaJson({ course: body.course }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/discount")
  @RequirePermission("restaurant.read")
  async applyDiscount(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: ApplyDiscountDto,
  ) {
    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const discountAmount = await this.resolveDiscountAmount(context.tenant.id, order, body);
    const threshold = readDecimalEnv("RESTAURANT_DISCOUNT_APPROVAL_THRESHOLD");
    const requiresApproval = discountAmount.greaterThan(threshold);

    if (requiresApproval && !canManageRestaurant(context.role)) {
      throw new BadRequestException("Manager approval is required for this discount.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderDiscount.create({
        data: {
          amount: discountAmount,
          appliedById: context.tenantUser.id,
          approvedById: requiresApproval ? context.tenantUser.id : null,
          label: body.label?.trim() || formatDiscountLabel(body),
          orderId: order.id,
          orderItemId: body.orderItemId || null,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
          type: body.type,
        },
      });
      const updatedOrder = await this.recalculateOrderTotals(tx, order);

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "discount_applied",
          newState: toPrismaJson({
            amount: discountAmount.toString(),
            totalAmount: updatedOrder.totalAmount.toString(),
            type: body.type,
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/pay")
  @RequirePermission("restaurant.read")
  async recordOrderPayment(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: RecordOrderPaymentDto,
  ) {
    if (!canTakeRestaurantPayment(context.role)) {
      throw new BadRequestException("Your role cannot take restaurant payments.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const amount = new Prisma.Decimal(body.amount);
    const confirmedTotal = await this.confirmedPaymentTotal(context.tenant.id, order.id);
    const remaining = new Prisma.Decimal(order.totalAmount).minus(confirmedTotal);

    if (amount.greaterThan(remaining)) {
      throw new BadRequestException("Payment cannot exceed the outstanding balance.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.create({
        data: {
          amount,
          currency: order.currency,
          method: body.method,
          orderId: order.id,
          paidAt: new Date(),
          propertyId: order.propertyId,
          recordedById: context.tenantUser.id,
          reference: body.reference?.trim() || null,
          restaurantId: order.restaurantId,
          status: "confirmed",
          tenantId: context.tenant.id,
        },
      });

      const paymentStatus = confirmedTotal.plus(amount).greaterThanOrEqualTo(order.totalAmount)
        ? "paid"
        : "partial";
      const shouldClose = paymentStatus === "paid";
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          closedAt: shouldClose ? new Date() : undefined,
          closedById: shouldClose ? context.tenantUser.id : undefined,
          paymentStatus,
          status: shouldClose ? "closed" : order.status,
        },
      });

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "payment_confirmed",
          newState: toPrismaJson({
            amount: amount.toString(),
            method: body.method,
            paymentStatus,
          }),
          orderId: order.id,
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      if (shouldClose) {
        await this.markTableAfterClose(tx, order.tableId);
        await tx.orderAuditLog.create({
          data: {
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
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/close")
  @RequirePermission("restaurant.read")
  async closeOrder(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot close restaurant orders.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const confirmedTotal = await this.confirmedPaymentTotal(context.tenant.id, order.id);

    if (confirmedTotal.lessThan(order.totalAmount)) {
      throw new BadRequestException("Cannot close an order with an outstanding balance.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          closedAt: new Date(),
          closedById: context.tenantUser.id,
          paymentStatus: "paid",
          status: "closed",
        },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
      await this.markTableAfterClose(tx, order.tableId);
      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "order_closed",
          newState: toPrismaJson({ status: "closed" }),
          orderId: order.id,
          previousState: toPrismaJson({ status: order.status }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return updatedOrder;
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/cancel")
  @RequirePermission("restaurant.manage")
  async cancelOrder(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: CancelOrderDto,
  ) {
    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const confirmedTotal = await this.confirmedPaymentTotal(context.tenant.id, order.id);

    if (confirmedTotal.greaterThan(0)) {
      throw new BadRequestException("Cannot cancel a paid order; use refund or void workflow.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: {
          orderId: order.id,
          status: { not: "voided" },
          tenantId: context.tenant.id,
        },
        data: {
          status: "voided",
          voidReason: body.reason?.trim() || "Order cancelled",
          voidedAt: new Date(),
          voidedById: context.tenantUser.id,
        },
      });
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "voided",
          status: "cancelled",
        },
        include: { items: { orderBy: { createdAt: "asc" } } },
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

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: "order_cancelled",
          newState: toPrismaJson({
            reason: body.reason?.trim() || null,
            status: "cancelled",
          }),
          orderId: order.id,
          previousState: toPrismaJson({ status: order.status }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return updatedOrder;
    });

    this.publishKitchenEvent(context.tenant.id, "order_cancelled", {
      orderId: order.id,
      restaurantId: order.restaurantId,
      status: "cancelled",
      tableId: order.tableId,
    });

    return serializeOrder(updatedOrder);
  }

  @Post(":restaurantId/orders/:orderId/transfer-table")
  @RequirePermission("restaurant.read")
  async transferTable(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: TransferTableDto,
  ) {
    if (!canCreateOrder(context.role)) {
      throw new BadRequestException("Your role cannot transfer restaurant tables.");
    }

    const order = await this.findMutableTenantOrder(
      context.tenant.id,
      restaurantId,
      orderId,
    );
    const targetTable = await this.findTenantTable(
      context.tenant.id,
      restaurantId,
      body.tableId,
    );

    if (["seated", "ordering", "served"].includes(targetTable.status)) {
      throw new BadRequestException("Cannot transfer to an occupied table.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { tableId: targetTable.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
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
          newState: toPrismaJson({ tableId: targetTable.id }),
          orderId: order.id,
          previousState: toPrismaJson({ tableId: order.tableId }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      return updatedOrder;
    });

    return serializeOrder(updatedOrder);
  }

  @Patch(":restaurantId/orders/:orderId/status")
  @RequirePermission("restaurant.read")
  async updateOrderStatus(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
    @Param("orderId") orderId: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    await this.findTenantRestaurant(context.tenant.id, restaurantId);
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
        tenantId: context.tenant.id,
      },
    });

    if (!order) {
      throw new BadRequestException("Order was not found for this restaurant.");
    }

    if (!allowedOrderStatusesForRole(context.role).includes(body.status)) {
      throw new BadRequestException("Your role cannot set orders to that status.");
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new BadRequestException("This order is already final.");
    }

    if (body.status === "closed" && order.status !== "served") {
      throw new BadRequestException("Only served orders can be closed.");
    }

    if (body.status === "served" && !["ready", "served"].includes(order.status)) {
      throw new BadRequestException("Only ready orders can be marked served.");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          closedAt: body.status === "closed" ? new Date() : undefined,
          closedById: body.status === "closed" ? context.tenantUser.id : undefined,
          paymentStatus: body.status === "cancelled" ? "voided" : undefined,
          status: body.status,
        },
        include: { items: true },
      });

      const itemStatusUpdate = itemStatusUpdateForOrderStatus(body.status);

      if (itemStatusUpdate) {
        await tx.orderItem.updateMany({
          where: {
            orderId: order.id,
            status: { not: "voided" },
            tenantId: context.tenant.id,
          },
          data: itemStatusUpdate,
        });
      }

      await tx.orderAuditLog.create({
        data: {
          actorId: context.tenantUser.id,
          actorRole: context.role,
          event: body.status === "cancelled"
            ? "order_cancelled"
            : body.status === "closed"
              ? "order_closed"
              : "status_changed",
          newState: toPrismaJson({
            status: updatedOrder.status,
          }),
          orderId: order.id,
          previousState: toPrismaJson({
            status: order.status,
          }),
          propertyId: order.propertyId,
          restaurantId: order.restaurantId,
          tenantId: context.tenant.id,
        },
      });

      if (order.tableId) {
        const tableStatus = this.tableStatusForOrderStatus(body.status);

        if (tableStatus) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: {
              assignedWaiterName: tableStatus === "free" ? null : undefined,
              assignedWaiterUserId: tableStatus === "free" ? null : undefined,
              coverCount: tableStatus === "free" ? 0 : undefined,
              status: tableStatus,
            },
          });
        }
      }

      return updatedOrder;
    });

    if (body.status === "sent") {
      for (const item of updatedOrder.items.filter((item) => item.status === "sent")) {
        this.publishKitchenEvent(context.tenant.id, "item_fired", {
          itemId: item.id,
          orderId: updatedOrder.id,
          restaurantId: updatedOrder.restaurantId,
          status: item.status,
          tableId: updatedOrder.tableId,
        });
      }
    }

    return serializeOrder(updatedOrder);
  }

  private async findTenantRestaurant(tenantId: string, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        tenantId,
      },
      include: {
        property: true,
      },
    });

    if (!restaurant) {
      throw new BadRequestException("Restaurant was not found for this tenant.");
    }

    return restaurant;
  }

  private async findMutableTenantOrder(
    tenantId: string,
    restaurantId: string,
    orderId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
        tenantId,
      },
    });

    if (!order) {
      throw new BadRequestException("Order was not found for this restaurant.");
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new BadRequestException("This order is already final.");
    }

    return order;
  }

  private async findTenantOrderItem(
    tenantId: string,
    orderId: string,
    itemId: string,
  ) {
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        tenantId,
      },
    });

    if (!item) {
      throw new BadRequestException("Order item was not found.");
    }

    return item;
  }

  private async buildOrderItemRows(
    tenantId: string,
    propertyId: string,
    restaurantId: string,
    orderId: string,
    items: CreateOrderItemDto[],
    status: "pending" | "sent",
  ) {
    const menuItems = await this.prisma.menuItem.findMany({
      include: {
        category: true,
      },
      where: {
        id: { in: items.map((item) => item.menuItemId) },
        isActive: true,
        restaurantId,
        tenantId,
      },
    });

    if (menuItems.length !== items.length) {
      throw new BadRequestException("One or more menu items were not found.");
    }

    return items.map((item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem) {
        throw new BadRequestException("One or more menu items were not found.");
      }

      const unitPrice = new Prisma.Decimal(menuItem.price);
      const totalPrice = unitPrice.mul(item.quantity);

      return {
        menuItemId: menuItem.id,
        kitchenStation:
          menuItem.kitchenStation ?? menuItem.category?.defaultStation ?? "main_kitchen",
        name: menuItem.name,
        notes: item.notes?.trim() || null,
        orderId,
        propertyId,
        quantity: item.quantity,
        sentAt: status === "sent" ? new Date() : null,
        status,
        tenantId,
        totalPrice,
        unitPrice,
      };
    });
  }

  private async buildReservationItemRows(
    tenantId: string,
    propertyId: string,
    restaurantId: string,
    items: CreateOrderItemDto[],
  ) {
    if (!items.length) {
      return [];
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: items.map((item) => item.menuItemId) },
        isActive: true,
        restaurantId,
        tenantId,
      },
    });

    if (menuItems.length !== items.length) {
      throw new BadRequestException("One or more reservation menu items were not found.");
    }

    return items.map((item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);

      if (!menuItem) {
        throw new BadRequestException("One or more reservation menu items were not found.");
      }

      const unitPrice = new Prisma.Decimal(menuItem.price);

      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        notes: item.notes?.trim() || null,
        propertyId,
        quantity: item.quantity,
        tenantId,
        totalPrice: unitPrice.mul(item.quantity),
        unitPrice,
      };
    });
  }

  private async recalculateOrderTotals(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      tenantId: string;
    },
  ) {
    const [items, discounts] = await Promise.all([
      tx.orderItem.findMany({
        where: {
          orderId: order.id,
          status: { not: "voided" },
          tenantId: order.tenantId,
        },
        select: { totalPrice: true },
      }),
      tx.orderDiscount.findMany({
        where: {
          orderId: order.id,
          tenantId: order.tenantId,
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
    const totals = calculateOrderTotals(subtotal, discountAmount);

    return tx.order.update({
      where: { id: order.id },
      data: {
        discountAmount: totals.discountAmount,
        serviceChargeAmount: totals.serviceChargeAmount,
        serviceChargeRate: totals.serviceChargeRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        taxRate: totals.taxRate,
        totalAmount: totals.totalAmount,
      },
    });
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

  private async resolveDiscountAmount(
    tenantId: string,
    order: {
      id: string;
      subtotal: Prisma.Decimal;
    },
    body: ApplyDiscountDto,
  ) {
    if (body.type === "item" && !body.orderItemId) {
      throw new BadRequestException("Item discounts require an order item.");
    }

    const base = body.orderItemId
      ? await this.prisma.orderItem
          .findFirst({
            where: {
              id: body.orderItemId,
              orderId: order.id,
              status: { not: "voided" },
              tenantId,
            },
            select: { totalPrice: true },
          })
          .then((item) => {
            if (!item) {
              throw new BadRequestException("Order item was not found.");
            }

            return item.totalPrice;
          })
      : order.subtotal;

    if (body.type === "percent") {
      if (body.amount > 100) {
        throw new BadRequestException("Percentage discounts cannot exceed 100.");
      }

      return roundMoney(new Prisma.Decimal(base).mul(body.amount).div(100));
    }

    const discountAmount = new Prisma.Decimal(body.amount);

    if (discountAmount.greaterThan(base)) {
      throw new BadRequestException("Discount cannot exceed the target amount.");
    }

    return discountAmount;
  }

  private async markTableAfterClose(
    tx: Prisma.TransactionClient,
    tableId: string | null,
  ) {
    if (!tableId) {
      return;
    }

    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { status: "cleaning" },
    });
  }

  private async findTenantProperty(tenantId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        tenantId,
      },
    });

    if (!property) {
      throw new BadRequestException("Property was not found for this tenant.");
    }

    return property;
  }

  private async findTenantTable(
    tenantId: string,
    restaurantId: string,
    tableId: string,
  ) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: {
        id: tableId,
        restaurantId,
        tenantId,
      },
    });

    if (!table) {
      throw new BadRequestException("Table was not found for this restaurant.");
    }

    return table;
  }

  private async findTenantMenuCategory(
    tenantId: string,
    restaurantId: string,
    categoryId: string,
  ) {
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        isActive: true,
        restaurantId,
        tenantId,
      },
    });

    if (!category) {
      throw new BadRequestException("Menu category was not found.");
    }

    return category;
  }

  private async listAssignableWaiters(tenantId: string) {
    const users = await this.prisma.tenantUser.findMany({
      orderBy: { createdAt: "asc" },
      where: {
        role: { in: [...waiterRoles] },
        status: "active",
        tenantId,
      },
    });
    const clerk = this.clerkClients.getClient();
    const clerkUsers = await Promise.allSettled(
      users.map((user) => clerk.users.getUser(user.clerkUserId)),
    );

    return users.map((user, index) => {
      const clerkUser =
        clerkUsers[index].status === "fulfilled" ? clerkUsers[index].value : null;
      const name = clerkUser ? getDisplayName(clerkUser) : user.clerkUserId;

      return {
        clerkUserId: user.clerkUserId,
        email: clerkUser ? getPrimaryEmail(clerkUser) : null,
        name,
        role: user.role,
      };
    });
  }

  private async resolveWaiterAssignment(
    tenantId: string,
    body: UpdateTableDto,
  ): Promise<{
    assignedWaiterName?: string | null;
    assignedWaiterUserId?: string | null;
  }> {
    if (body.assignedWaiterUserId === undefined) {
      return body.assignedWaiterName === undefined
        ? {}
        : { assignedWaiterName: body.assignedWaiterName.trim() || null };
    }

    const waiterUserId = body.assignedWaiterUserId.trim();

    if (!waiterUserId) {
      return {
        assignedWaiterName: null,
        assignedWaiterUserId: null,
      };
    }

    const waiter = await this.prisma.tenantUser.findFirst({
      where: {
        clerkUserId: waiterUserId,
        role: { in: [...waiterRoles] },
        status: "active",
        tenantId,
      },
    });

    if (!waiter) {
      throw new BadRequestException("Choose an active waiter from this workspace.");
    }

    const clerk = this.clerkClients.getClient();
    const clerkUser = await clerk.users.getUser(waiter.clerkUserId).catch(() => null);

    return {
      assignedWaiterName: clerkUser ? getDisplayName(clerkUser) : waiter.clerkUserId,
      assignedWaiterUserId: waiter.clerkUserId,
    };
  }

  private tableStatusForOrderStatus(status: OrderStatus): TableStatus | null {
    if (status === "sent" || status === "preparing" || status === "ready") {
      return "ordering";
    }

    if (status === "served") {
      return "served";
    }

    if (status === "closed") {
      return "cleaning";
    }

    if (status === "cancelled") {
      return "free";
    }

    return null;
  }

  private serializeReservation(
    reservation: {
      createdAt: Date;
      guestName: string;
      id: string;
      items?: Array<{
        id: string;
        menuItemId: string | null;
        name: string;
        notes: string | null;
        quantity: number;
        totalPrice: { toString(): string };
        unitPrice: { toString(): string };
      }>;
      notes: string | null;
      partySize: number;
      scheduledAt: Date;
      status: string;
      tableId: string | null;
    },
    tables: Array<{
      coverCount: number;
      id: string;
      name: string;
      status: string;
    }>,
  ) {
    const suggestedTables = tables
      .filter((table) =>
        ["free", "reserved"].includes(table.status) &&
        (table.coverCount === 0 || table.coverCount >= reservation.partySize),
      )
      .sort((left, right) => {
        const leftGap = Math.abs((left.coverCount || reservation.partySize) - reservation.partySize);
        const rightGap = Math.abs((right.coverCount || reservation.partySize) - reservation.partySize);
        return leftGap - rightGap || left.name.localeCompare(right.name);
      })
      .slice(0, 3)
      .map((table) => ({
        coverCount: table.coverCount,
        id: table.id,
        name: table.name,
        status: table.status,
      }));

    return {
      createdAt: reservation.createdAt,
      guestName: reservation.guestName,
      id: reservation.id,
      items: (reservation.items ?? []).map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        notes: item.notes,
        quantity: item.quantity,
        totalPrice: Number(item.totalPrice),
        unitPrice: Number(item.unitPrice),
      })),
      notes: reservation.notes,
      partySize: reservation.partySize,
      scheduledAt: reservation.scheduledAt,
      status: reservation.status,
      suggestedTables,
      tableId: reservation.tableId,
    };
  }

  private publishKitchenEvent(
    tenantId: string,
    type: string,
    data: {
      course?: number;
      itemId?: string;
      orderId: string;
      restaurantId: string;
      status?: string;
      tableId?: string | null;
    },
  ) {
    this.kitchenEvents.publish(tenantId, { data, type });
  }
}

function resolveOrderIdempotencyKey(headerValue?: string, bodyValue?: string) {
  const idempotencyKey = headerValue?.trim() || bodyValue?.trim();

  if (!idempotencyKey) {
    return randomUUID();
  }

  if (!isUuid(idempotencyKey)) {
    throw new BadRequestException("Order idempotency key must be a UUID.");
  }

  return idempotencyKey;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDiscountLabel(discount: ApplyDiscountDto) {
  if (discount.type === "percent") {
    return `${discount.amount}% discount`;
  }

  if (discount.type === "item") {
    return "Item discount";
  }

  return "Discount";
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

function sumModifierAdjustments(modifiers: unknown) {
  if (!Array.isArray(modifiers)) {
    return new Prisma.Decimal(0);
  }

  return modifiers.reduce((total, modifier) => {
    if (!modifier || typeof modifier !== "object" || Array.isArray(modifier)) {
      return total;
    }

    const priceAdjustment = (modifier as { priceAdjustment?: unknown }).priceAdjustment;

    if (
      typeof priceAdjustment !== "number" &&
      typeof priceAdjustment !== "string"
    ) {
      return total;
    }

    try {
      return total.plus(new Prisma.Decimal(priceAdjustment));
    } catch {
      return total;
    }
  }, new Prisma.Decimal(0));
}

function itemStatusUpdateForOrderStatus(status: OrderStatus) {
  if (status === "sent") {
    return {
      sentAt: new Date(),
      status: "sent" as const,
    };
  }

  if (status === "preparing") {
    return {
      status: "preparing" as const,
    };
  }

  if (status === "ready") {
    return {
      preparedAt: new Date(),
      status: "ready" as const,
    };
  }

  if (status === "served") {
    return {
      servedAt: new Date(),
      status: "served" as const,
    };
  }

  if (status === "cancelled") {
    return {
      status: "voided" as const,
      voidReason: "Order cancelled",
      voidedAt: new Date(),
    };
  }

  return undefined;
}

function itemStatusUpdateForKitchenStatus(
  status: "preparing" | "ready" | "served",
) {
  if (status === "ready") {
    return {
      preparedAt: new Date(),
      status,
    };
  }

  if (status === "served") {
    return {
      servedAt: new Date(),
      status,
    };
  }

  return { status };
}

function deriveOrderStatusFromItems(items: Array<{ status: string }>): OrderStatus {
  if (items.length === 0) {
    return "draft";
  }

  if (items.every((item) => item.status === "served")) {
    return "served";
  }

  if (items.every((item) => item.status === "ready" || item.status === "served")) {
    return "ready";
  }

  if (items.some((item) => item.status === "preparing")) {
    return "preparing";
  }

  return "sent";
}
