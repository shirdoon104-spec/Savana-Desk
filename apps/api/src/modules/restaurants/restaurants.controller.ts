import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
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
import type { TenantRole } from "@rayaan/shared";
import { ClerkClientService } from "../auth/clerk-client.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
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
const waiterRoles = ["owner", "admin", "restaurant_manager", "waiter"] as const;

type TableStatus = (typeof tableStatuses)[number];
type OrderStatus = (typeof orderStatuses)[number];

interface SerializableOrder {
  createdAt: Date;
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
}

class CreateMenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;
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

class UpdateOrderStatusDto {
  @IsIn(orderStatuses)
  status!: OrderStatus;
}

function canCreateOrder(role: TenantRole) {
  return ["owner", "admin", "restaurant_manager", "waiter"].includes(role);
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
    menuItemId: string | null;
    name: string;
    notes: string | null;
    quantity: number;
    totalPrice: { toString(): string };
    unitPrice: { toString(): string };
  }>;
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
      menuItemId: item.menuItemId,
      name: item.name,
      notes: item.notes,
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      unitPrice: Number(item.unitPrice),
    })),
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
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission("restaurant.read")
  async list(@CurrentTenant() context: TenantContext) {
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
              orderBy: { createdAt: "asc" },
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
        menuItems: {
          orderBy: { createdAt: "asc" },
          where: { isActive: true },
        },
        property: true,
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
          id: category.id,
          items: category.items.map((item) => ({
            categoryId: item.categoryId,
            currency: item.currency,
            description: item.description,
              id: item.id,
              imageUrl: item.imageUrl,
              name: item.name,
              price: Number(item.price),
            })),
          name: category.name,
        })),
        menuItems: restaurant.menuItems.map((item) => ({
          categoryId: item.categoryId,
          currency: item.currency,
          description: item.description,
          id: item.id,
          imageUrl: item.imageUrl,
          name: item.name,
          price: Number(item.price),
        })),
        tables: restaurant.tables.map((table) => ({
          assignedWaiterName: table.assignedWaiterName,
          assignedWaiterUserId: table.assignedWaiterUserId,
          coverCount: table.coverCount,
          id: table.id,
          name: table.name,
          qrCode: table.qrCode,
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
  ) {
    const restaurant = await this.findTenantRestaurant(
      context.tenant.id,
      restaurantId,
    );

    return this.prisma.menuCategory.create({
      data: {
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
    categoryId: string | null;
    currency: string;
    description: string | null;
    id: string;
    imageUrl: string | null;
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
        categoryId: body.categoryId || null,
        currency: restaurant.property.currency,
        description: body.description?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        name: body.name.trim(),
        price: body.price,
        propertyId: restaurant.propertyId,
        restaurantId: restaurant.id,
        tenantId: context.tenant.id,
      },
    });

    return {
      categoryId: menuItem.categoryId,
      currency: menuItem.currency,
      description: menuItem.description,
      id: menuItem.id,
      imageUrl: menuItem.imageUrl,
      name: menuItem.name,
      price: Number(menuItem.price),
    };
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

    return this.prisma.restaurantTable.create({
      data: {
        name,
        coverCount: body.coverCount ?? 0,
        propertyId: restaurant.propertyId,
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

  @Post(":restaurantId/orders")
  @RequirePermission("restaurant.read")
  async createOrder(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
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

    const orderItems = body.items?.length
      ? await this.prisma.menuItem.findMany({
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
        name: menuItem.name,
        notes: item.notes?.trim() || null,
        propertyId: restaurant.propertyId,
        quantity: item.quantity,
        tenantId: context.tenant.id,
        totalPrice,
        unitPrice,
      };
    });
    const totalAmount =
      itemRows.length > 0
        ? itemRows.reduce((total, item) => total + item.totalPrice, 0)
        : (body.totalAmount ?? 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          currency: restaurant.property.currency,
          items: itemRows.length
            ? {
                create: itemRows,
              }
            : undefined,
          propertyId: restaurant.propertyId,
          restaurantId: restaurant.id,
          status: "sent",
          tableId: body.tableId || null,
          tenantId: context.tenant.id,
          totalAmount,
        },
        include: { items: true },
      });

      if (body.tableId) {
        await tx.restaurantTable.update({
          where: { id: body.tableId },
          data: { status: "ordering" },
        });
      }

      return order;
    });

    return serializeOrder(order);
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
        data: { status: body.status },
        include: { items: true },
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
}
