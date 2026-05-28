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
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { hasTenantPermission, type TenantRole } from "@rayaan/shared";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "../tenancy/tenant-context.service";

const roomStatuses = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
  "out_of_order",
] as const;

type RoomStatus = (typeof roomStatuses)[number];

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === "" ? undefined : value;

class CreatePropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(["USD", "SOS"])
  currency?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

class CreateRoomsDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  floor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  from!: number;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  prefix?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  to!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;
}

class UpdateRoomStatusDto {
  @IsIn(roomStatuses)
  status!: RoomStatus;
}

class CheckInDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  expectedCheckOutAt?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

class CheckOutDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeRestaurantCharges?: boolean;
}

function allowedRoomStatusesForRole(role: TenantRole): RoomStatus[] {
  if (role === "owner" || role === "admin") {
    return [...roomStatuses];
  }

  if (role === "front_desk") {
    return ["available", "occupied"];
  }

  if (role === "housekeeping") {
    return ["available", "cleaning"];
  }

  if (role === "maintenance") {
    return ["available", "maintenance", "out_of_order"];
  }

  return [];
}

@Controller("properties")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class PropertiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("property.read")
  async list(@CurrentTenant() context: TenantContext) {
    const properties = await this.prisma.property.findMany({
      where: { tenantId: context.tenant.id },
      include: {
        restaurants: {
          orderBy: { createdAt: "asc" },
        },
        rooms: {
          include: {
            stays: {
              where: { status: "active" },
              include: { guest: true },
              orderBy: { checkInAt: "desc" },
              take: 1,
            },
          },
          orderBy: [{ number: "asc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      allowedRoomStatuses: allowedRoomStatusesForRole(context.role),
      canManageStays: hasTenantPermission(context.role, "reservations.manage"),
      canManageRooms: hasTenantPermission(context.role, "rooms.manage"),
      canManageProperties: hasTenantPermission(context.role, "property.manage"),
      currentUser: {
        clerkUserId: context.tenantUser.clerkUserId,
        role: context.role,
      },
      tenant: context.tenant,
      properties: properties.map((property) => ({
        city: property.city,
        currency: property.currency,
        id: property.id,
        name: property.name,
        restaurants: property.restaurants.map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          serviceStyle: restaurant.serviceStyle,
        })),
        roomCount: property.roomCount,
        rooms: property.rooms.map((room) => ({
          activeStay: room.stays[0]
            ? {
                checkInAt: room.stays[0].checkInAt,
                expectedCheckOutAt: room.stays[0].expectedCheckOutAt,
                guest: {
                  email: room.stays[0].guest.email,
                  firstName: room.stays[0].guest.firstName,
                  id: room.stays[0].guest.id,
                  lastName: room.stays[0].guest.lastName,
                  phone: room.stays[0].guest.phone,
                },
                id: room.stays[0].id,
                notes: room.stays[0].notes,
              }
            : null,
          id: room.id,
          number: room.number,
          status: room.status,
          type: room.type,
        })),
        timezone: property.timezone,
      })),
    };
  }

  @Post()
  @RequirePermission("property.manage")
  async create(
    @CurrentTenant() context: TenantContext,
    @Body() body: CreatePropertyDto,
  ): Promise<Record<string, unknown>> {
    const name = body.name?.trim();
    const city = body.city?.trim();
    const currency = body.currency?.trim().toUpperCase() || "USD";

    if (!name || name.length < 2) {
      throw new BadRequestException("Property name is required.");
    }

    if (!["KES", "USD", "SOS"].includes(currency)) {
      throw new BadRequestException("Choose a supported currency.");
    }

    const property = await this.prisma.property.create({
      data: {
        city: city || null,
        currency,
        name,
        roomCount: this.optionalPositiveInteger(body.roomCount),
        tenantId: context.tenant.id,
        timezone: body.timezone?.trim() || "Africa/Mogadishu",
      },
    });

    return property;
  }

  @Post(":propertyId/rooms")
  @RequirePermission("property.manage")
  async createRooms(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateRoomsDto,
  ) {
    const property = await this.findTenantProperty(context.tenant.id, propertyId);
    const from = this.requiredPositiveInteger(body.from, "Starting room number");
    const to = this.requiredPositiveInteger(body.to, "Ending room number");
    const roomType = body.type?.trim() || "standard";
    const prefix = body.prefix?.trim() ?? "";

    if (to < from) {
      throw new BadRequestException("Ending room number must be after the start.");
    }

    if (to - from > 199) {
      throw new BadRequestException("Create 200 rooms or fewer at a time.");
    }

    const floor = body.floor?.trim();
    const rooms = Array.from({ length: to - from + 1 }, (_value, index) => {
      const number = `${prefix}${from + index}`;
      return {
        number,
        propertyId: property.id,
        tenantId: context.tenant.id,
        type: floor ? `${roomType} - floor ${floor}` : roomType,
      };
    });

    await this.prisma.room.createMany({
      data: rooms,
      skipDuplicates: true,
    });

    const updatedRooms = await this.prisma.room.findMany({
      where: { propertyId: property.id, tenantId: context.tenant.id },
      orderBy: { number: "asc" },
    });

    await this.prisma.property.update({
      where: { id: property.id },
      data: { roomCount: updatedRooms.length },
    });

    return {
      propertyId: property.id,
      rooms: updatedRooms,
    };
  }

  @Post(":propertyId/rooms/:roomId/check-in")
  @RequirePermission("reservations.manage")
  async checkIn(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Param("roomId") roomId: string,
    @Body() body: CheckInDto,
  ) {
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const email = body.email?.trim().toLowerCase() || null;
    const phone = body.phone?.trim() || null;

    if (!firstName || !lastName) {
      throw new BadRequestException("Guest first and last name are required.");
    }

    await this.findTenantProperty(context.tenant.id, propertyId);
    const room = await this.findTenantRoom(context.tenant.id, propertyId, roomId);

    if (room.status === "maintenance" || room.status === "out_of_order") {
      throw new BadRequestException("This room is not available for check-in.");
    }

    const activeStay = await this.prisma.stay.findFirst({
      where: {
        roomId,
        status: "active",
        tenantId: context.tenant.id,
      },
    });

    if (activeStay) {
      throw new BadRequestException("This room already has an active stay.");
    }

    const expectedCheckOutAt = body.expectedCheckOutAt
      ? new Date(body.expectedCheckOutAt)
      : null;

    if (expectedCheckOutAt && Number.isNaN(expectedCheckOutAt.getTime())) {
      throw new BadRequestException("Expected check-out date is invalid.");
    }

    const stay = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({
        data: {
          email,
          firstName,
          lastName,
          phone,
          tenantId: context.tenant.id,
        },
      });

      const createdStay = await tx.stay.create({
        data: {
          checkedInByUserId: context.tenantUser.clerkUserId,
          expectedCheckOutAt,
          guestId: guest.id,
          notes: body.notes?.trim() || null,
          propertyId,
          roomId,
          tenantId: context.tenant.id,
        },
        include: {
          guest: true,
          room: true,
        },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { status: "occupied" },
      });

      return createdStay;
    });

    return stay;
  }

  @Post(":propertyId/rooms/:roomId/check-out")
  @RequirePermission("reservations.manage")
  async checkOut(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Param("roomId") roomId: string,
    @Body() body: CheckOutDto,
  ) {
    await this.findTenantProperty(context.tenant.id, propertyId);
    const room = await this.findTenantRoom(context.tenant.id, propertyId, roomId);
    const activeStay = await this.prisma.stay.findFirst({
      where: {
        roomId,
        status: "active",
        tenantId: context.tenant.id,
      },
      orderBy: { checkInAt: "desc" },
    });

    if (!activeStay) {
      throw new BadRequestException("This room does not have an active stay.");
    }

    const restaurantCharges = await this.prisma.folioCharge.findMany({
      where: {
        restaurantId: { not: null },
        stayId: activeStay.id,
        tenantId: context.tenant.id,
      },
      orderBy: { createdAt: "asc" },
    });

    if (restaurantCharges.length > 0 && !body?.acknowledgeRestaurantCharges) {
      const total = restaurantCharges.reduce(
        (sum, charge) => sum + Number(charge.amount),
        0,
      );
      const currency = restaurantCharges[0]?.currency ?? "USD";
      const chargeSummary = restaurantCharges
        .map(
          (charge) =>
            `${charge.description || "Restaurant charge"} (${charge.currency} ${Number(
              charge.amount,
            ).toFixed(2)})`,
        )
        .join("; ");

      throw new BadRequestException(
        `Review ${restaurantCharges.length} posted restaurant charge${
          restaurantCharges.length === 1 ? "" : "s"
        } totaling ${currency} ${total.toFixed(
          2,
        )} before checkout: ${chargeSummary}. Confirm checkout to acknowledge these charges.`,
      );
    }

    const stay = await this.prisma.$transaction(async (tx) => {
      const completedStay = await tx.stay.update({
        where: { id: activeStay.id },
        data: {
          checkedOutByUserId: context.tenantUser.clerkUserId,
          checkOutAt: new Date(),
          status: "checked_out",
        },
        include: {
          guest: true,
          room: true,
        },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { status: "cleaning" },
      });

      return completedStay;
    });

    return stay;
  }

  @Patch(":propertyId/rooms/:roomId/status")
  @RequirePermission("rooms.read")
  async updateRoomStatus(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Param("roomId") roomId: string,
    @Body() body: UpdateRoomStatusDto,
  ) {
    const status = body.status?.trim();

    if (!status || !roomStatuses.includes(status as RoomStatus)) {
      throw new BadRequestException("Choose a valid room status.");
    }

    const allowedStatuses = allowedRoomStatusesForRole(context.role);

    if (!allowedStatuses.includes(status as RoomStatus)) {
      throw new BadRequestException(
        "Your role cannot set rooms to that status.",
      );
    }

    await this.findTenantProperty(context.tenant.id, propertyId);

    const room = await this.findTenantRoom(context.tenant.id, propertyId, roomId);

    return this.prisma.room.update({
      where: { id: room.id },
      data: { status },
    });
  }

  private async findTenantProperty(tenantId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      throw new BadRequestException("Property was not found for this tenant.");
    }

    return property;
  }

  private async findTenantRoom(
    tenantId: string,
    propertyId: string,
    roomId: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        propertyId,
        tenantId,
      },
    });

    if (!room) {
      throw new BadRequestException("Room was not found for this property.");
    }

    return room;
  }

  private optionalPositiveInteger(value: number | string | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    return this.requiredPositiveInteger(value, "Room count");
  }

  private requiredPositiveInteger(
    value: number | string | undefined,
    label: string,
  ): number {
    const parsedValue =
      typeof value === "string" && value.trim() !== "" ? Number(value) : value;

    if (!Number.isInteger(parsedValue) || Number(parsedValue) < 1) {
      throw new BadRequestException(`${label} must be a positive number.`);
    }

    return Number(parsedValue);
  }
}
