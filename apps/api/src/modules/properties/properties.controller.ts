import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Prisma } from "@rayaan/database";
import { hasTenantPermission, type TenantRole } from "@rayaan/shared";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "../tenancy/tenant-context.service";
import { HotelRateLookupService } from "./hotel-rate-lookup.service";

const roomStatuses = [
  "available",
  "occupied",
  "cleaning",
  "maintenance",
  "out_of_order",
] as const;

type RoomStatus = (typeof roomStatuses)[number];
type RatePlanStatus = "active" | "inactive";
type CancellationPenaltyType = "none" | "fixed" | "percent" | "first_night";
type HotelReservationStatus =
  | "draft"
  | "confirmed"
  | "guaranteed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";
type HotelReservationSource =
  | "walk_in"
  | "phone"
  | "direct"
  | "ota"
  | "corporate";
type RoomChargeLineItem = {
  amount: Prisma.Decimal;
  currency: string;
  description: string;
  postedById: string;
  propertyId: string;
  sourceType: string;
  tenantId: string;
  type: "room_night" | "service_charge" | "tax";
  unitAmount: Prisma.Decimal;
};

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === "" ? undefined : value;

class CreatePropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(["KES", "USD", "SOS"])
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

class UpdatePropertySettingsDto {
  @IsOptional()
  @IsString()
  serviceChargeRate?: string;

  @IsOptional()
  @IsString()
  taxRate?: string;
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

class UpsertRoomTypeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  baseOccupancy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  defaultRate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxOccupancy?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

class CreateRatePlanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  baseOccupancy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  defaultRate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  extraGuestRate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  freeCancellationUntilHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minNights?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  noShowPenaltyValue?: string;

  @IsOptional()
  @IsIn(["none", "fixed", "percent", "first_night"])
  noShowPenaltyType?: CancellationPenaltyType;

  @IsOptional()
  @IsString()
  penaltyValue?: string;

  @IsOptional()
  @IsIn(["none", "fixed", "percent", "first_night"])
  penaltyType?: CancellationPenaltyType;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: RatePlanStatus;
}

class CreateRoomRateDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  baseOccupancy?: number;

  @IsString()
  baseRate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  extraGuestRate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minNights?: number;

  @IsString()
  ratePlanId!: string;

  @IsString()
  roomTypeId!: string;

  @IsDateString()
  startDate!: string;
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

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  reservationId?: string;
}

class CheckOutDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeExtraNightCharges?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeRestaurantCharges?: boolean;
}

class RateLookupQueryDto {
  @IsDateString()
  arrivalDate!: string;

  @IsDateString()
  departureDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  ratePlanId?: string;

  @IsString()
  roomTypeId!: string;
}

class HotelAvailabilityQueryDto {
  @IsDateString()
  arrivalDate!: string;

  @IsDateString()
  departureDate!: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;
}

class CreateHotelReservationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adultCount?: number;

  @IsDateString()
  arrivalDate!: string;

  @IsOptional()
  @IsString()
  assignedRoomId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  childCount?: number;

  @IsOptional()
  @IsBoolean()
  isComplimentary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  complimentaryReason?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  depositRequiredAmount?: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  guestName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guestPhone?: string;

  @IsDateString()
  departureDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  rateOverride?: string;

  @IsOptional()
  @IsString()
  ratePlanId?: string;

  @IsString()
  roomTypeId!: string;

  @IsOptional()
  @IsIn(["walk_in", "phone", "direct", "ota", "corporate"])
  source?: HotelReservationSource;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}

class UpdateHotelReservationStatusDto {
  @IsIn([
    "draft",
    "confirmed",
    "guaranteed",
    "checked_in",
    "checked_out",
    "cancelled",
    "no_show",
  ])
  status!: HotelReservationStatus;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLookup: HotelRateLookupService,
  ) {}

  @Get()
  @RequirePermission("property.read")
  async list(
    @CurrentTenant() context: TenantContext,
  ): Promise<Record<string, unknown>> {
    const properties = await this.prisma.property.findMany({
      where: { tenantId: context.tenant.id },
      include: {
        restaurants: {
          orderBy: { createdAt: "asc" },
        },
        hotelReservations: {
          include: {
            assignedRoom: true,
            guarantee: true,
            guests: true,
            roomType: true,
          },
          orderBy: [{ arrivalDate: "asc" }, { createdAt: "desc" }],
          take: 60,
        },
        roomTypes: {
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
        },
        ratePlans: {
          include: {
            cancellationPolicy: true,
            roomRates: {
              orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
            },
            roomType: true,
          },
          orderBy: [{ status: "asc" }, { name: "asc" }],
        },
        rooms: {
          include: {
            roomType: true,
            stays: {
              where: { status: "active" },
              include: { guest: true, guestFolio: true },
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
        serviceChargeRate: property.serviceChargeRate,
        taxRate: property.taxRate,
        restaurants: property.restaurants.map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          serviceStyle: restaurant.serviceStyle,
        })),
        hotelReservations: property.hotelReservations.map((reservation) => ({
          adultCount: reservation.adultCount,
          arrivalDate: reservation.arrivalDate,
          assignedRoom: reservation.assignedRoom
            ? {
                id: reservation.assignedRoom.id,
                number: reservation.assignedRoom.number,
              }
            : null,
          assignedRoomId: reservation.assignedRoomId,
          childCount: reservation.childCount,
          complimentaryReason: reservation.complimentaryReason,
          confirmationCode: reservation.confirmationCode,
          currency: reservation.currency,
          departureDate: reservation.departureDate,
          depositPaidAmount: reservation.depositPaidAmount,
          depositRequiredAmount: reservation.depositRequiredAmount,
          guestEmail: reservation.guestEmail,
          guestName: reservation.guestName,
          guestPhone: reservation.guestPhone,
          guarantee: reservation.guarantee,
          guests: reservation.guests,
          id: reservation.id,
          isComplimentary: reservation.isComplimentary,
          notes: reservation.notes,
          rateOverride: reservation.rateOverride,
          ratePlanId: reservation.ratePlanId,
          roomType: {
            id: reservation.roomType.id,
            name: reservation.roomType.name,
          },
          roomTypeId: reservation.roomTypeId,
          source: reservation.source,
          specialRequests: reservation.specialRequests,
          status: reservation.status,
        })),
        roomCount: property.roomCount,
        roomTypes: property.roomTypes.map((roomType) => ({
          baseOccupancy: roomType.baseOccupancy,
          code: roomType.code,
          defaultCurrency: roomType.defaultCurrency,
          defaultRate: roomType.defaultRate,
          description: roomType.description,
          id: roomType.id,
          isActive: roomType.isActive,
          maxOccupancy: roomType.maxOccupancy,
          name: roomType.name,
        })),
        ratePlans: property.ratePlans.map((ratePlan) => ({
          baseOccupancy: ratePlan.baseOccupancy,
          cancellationPolicy: ratePlan.cancellationPolicy,
          code: ratePlan.code,
          currency: ratePlan.currency,
          defaultRate: ratePlan.defaultRate,
          description: ratePlan.description,
          extraGuestRate: ratePlan.extraGuestRate,
          id: ratePlan.id,
          minNights: ratePlan.minNights,
          name: ratePlan.name,
          roomRates: ratePlan.roomRates,
          roomType: ratePlan.roomType
            ? {
                code: ratePlan.roomType.code,
                id: ratePlan.roomType.id,
                name: ratePlan.roomType.name,
              }
            : null,
          roomTypeId: ratePlan.roomTypeId,
          status: ratePlan.status,
        })),
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
                folio: room.stays[0].guestFolio
                  ? {
                      balance: room.stays[0].guestFolio.balance,
                      currency: room.stays[0].guestFolio.currency,
                      id: room.stays[0].guestFolio.id,
                      status: room.stays[0].guestFolio.status,
                    }
                  : null,
                folioId: room.stays[0].guestFolio?.id ?? room.stays[0].id,
                id: room.stays[0].id,
                notes: room.stays[0].notes,
              }
            : null,
          id: room.id,
          number: room.number,
          roomType: room.roomType
            ? {
                baseOccupancy: room.roomType.baseOccupancy,
                code: room.roomType.code,
                defaultCurrency: room.roomType.defaultCurrency,
                defaultRate: room.roomType.defaultRate,
                id: room.roomType.id,
                isActive: room.roomType.isActive,
                maxOccupancy: room.roomType.maxOccupancy,
                name: room.roomType.name,
              }
            : null,
          roomTypeId: room.roomTypeId,
          status: room.status,
          type: room.type,
        })),
        timezone: property.timezone,
      })),
    };
  }

  @Post(":propertyId/room-types")
  @RequirePermission("property.manage")
  async upsertRoomType(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: UpsertRoomTypeDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const name = body.name?.trim();

    if (!name) {
      throw new BadRequestException("Room type name is required.");
    }

    const code = this.toRoomTypeCode(body.code?.trim() || name);

    return this.prisma.roomType.upsert({
      where: {
        propertyId_code: {
          code,
          propertyId: property.id,
        },
      },
      create: {
        baseOccupancy: this.optionalPositiveInteger(body.baseOccupancy) ?? 1,
        code,
        defaultCurrency: property.currency,
        defaultRate: this.optionalDecimal(body.defaultRate, "Default rate"),
        description: body.description?.trim() || null,
        isActive: body.isActive ?? true,
        maxOccupancy: this.optionalPositiveInteger(body.maxOccupancy),
        name,
        propertyId: property.id,
        tenantId: context.tenant.id,
      },
      update: {
        baseOccupancy: this.optionalPositiveInteger(body.baseOccupancy) ?? 1,
        defaultCurrency: property.currency,
        defaultRate: this.optionalDecimal(body.defaultRate, "Default rate"),
        description: body.description?.trim() || null,
        isActive: body.isActive ?? true,
        maxOccupancy: this.optionalPositiveInteger(body.maxOccupancy),
        name,
      },
    });
  }

  @Post(":propertyId/rate-plans")
  @RequirePermission("property.manage")
  async createRatePlan(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateRatePlanDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const name = body.name?.trim();

    if (!name) {
      throw new BadRequestException("Rate plan name is required.");
    }

    const roomType = body.roomTypeId
      ? await this.findTenantRoomType(
          context.tenant.id,
          property.id,
          body.roomTypeId,
        )
      : null;

    const code = this.toRoomTypeCode(body.code?.trim() || name);

    return this.prisma.ratePlan.create({
      data: {
        baseOccupancy:
          this.optionalPositiveInteger(body.baseOccupancy) ??
          roomType?.baseOccupancy ??
          1,
        cancellationPolicy: {
          create: {
            freeCancellationUntilHours: this.optionalPositiveInteger(
              body.freeCancellationUntilHours,
            ),
            noShowPenaltyType: body.noShowPenaltyType ?? "none",
            noShowPenaltyValue:
              this.optionalDecimal(
                body.noShowPenaltyValue,
                "No-show penalty",
              ) ?? new Prisma.Decimal(0),
            penaltyType: body.penaltyType ?? "none",
            penaltyValue:
              this.optionalDecimal(body.penaltyValue, "Penalty") ??
              new Prisma.Decimal(0),
            propertyId: property.id,
            tenantId: context.tenant.id,
          },
        },
        code,
        currency: property.currency,
        defaultRate: this.optionalDecimal(body.defaultRate, "Default rate"),
        description: body.description?.trim() || null,
        extraGuestRate:
          this.optionalDecimal(body.extraGuestRate, "Extra guest rate") ??
          new Prisma.Decimal(0),
        minNights: this.optionalPositiveInteger(body.minNights) ?? 1,
        name,
        propertyId: property.id,
        roomTypeId: body.roomTypeId?.trim() || null,
        status: body.status ?? "active",
        tenantId: context.tenant.id,
      },
      include: {
        cancellationPolicy: true,
        roomType: true,
      },
    });
  }

  @Post(":propertyId/room-rates")
  @RequirePermission("property.manage")
  async createRoomRate(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateRoomRateDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const roomType = await this.findTenantRoomType(
      context.tenant.id,
      property.id,
      body.roomTypeId,
    );
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: {
        id: body.ratePlanId,
        propertyId: property.id,
        tenantId: context.tenant.id,
      },
    });

    if (!ratePlan) {
      throw new BadRequestException(
        "Rate plan was not found for this property.",
      );
    }

    if (ratePlan.roomTypeId && ratePlan.roomTypeId !== roomType.id) {
      throw new BadRequestException(
        "This rate plan is linked to a different room type.",
      );
    }

    const startDate = this.requiredHotelDate(body.startDate, "Start date");
    const endDate = this.requiredHotelDate(body.endDate, "End date");

    if (endDate <= startDate) {
      throw new BadRequestException("End date must be after start date.");
    }

    return this.prisma.roomRate.create({
      data: {
        baseOccupancy:
          this.optionalPositiveInteger(body.baseOccupancy) ??
          roomType.baseOccupancy,
        baseRate: this.requiredDecimal(body.baseRate, "Base rate"),
        currency: property.currency,
        endDate,
        extraGuestRate:
          this.optionalDecimal(body.extraGuestRate, "Extra guest rate") ??
          new Prisma.Decimal(0),
        isActive: body.isActive ?? true,
        minNights: this.optionalPositiveInteger(body.minNights) ?? 1,
        propertyId: property.id,
        ratePlanId: ratePlan.id,
        roomTypeId: roomType.id,
        startDate,
        tenantId: context.tenant.id,
      },
    });
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

  @Patch(":propertyId/settings")
  @RequirePermission("property.manage")
  async updateSettings(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: UpdatePropertySettingsDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );

    return this.prisma.property.update({
      where: { id: property.id },
      data: {
        serviceChargeRate:
          this.optionalPercentRate(
            body.serviceChargeRate,
            "Service charge rate",
          ) ?? new Prisma.Decimal(0),
        taxRate:
          this.optionalPercentRate(body.taxRate, "Tax rate") ??
          new Prisma.Decimal(0),
      },
    });
  }

  @Post(":propertyId/rooms")
  @RequirePermission("property.manage")
  async createRooms(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateRoomsDto,
  ): Promise<unknown> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const from = this.requiredPositiveInteger(
      body.from,
      "Starting room number",
    );
    const to = this.requiredPositiveInteger(body.to, "Ending room number");
    const roomType = body.type?.trim() || "standard";
    const prefix = body.prefix?.trim() ?? "";

    if (to < from) {
      throw new BadRequestException(
        "Ending room number must be after the start.",
      );
    }

    if (to - from > 199) {
      throw new BadRequestException("Create 200 rooms or fewer at a time.");
    }

    const floor = body.floor?.trim();
    const roomTypeRecord = await this.prisma.roomType.upsert({
      where: {
        propertyId_code: {
          code: this.toRoomTypeCode(roomType),
          propertyId: property.id,
        },
      },
      create: {
        code: this.toRoomTypeCode(roomType),
        defaultCurrency: property.currency,
        name: roomType,
        propertyId: property.id,
        tenantId: context.tenant.id,
      },
      update: {
        defaultCurrency: property.currency,
        isActive: true,
        name: roomType,
      },
    });
    const rooms = Array.from({ length: to - from + 1 }, (_value, index) => {
      const number = `${prefix}${from + index}`;
      return {
        number,
        propertyId: property.id,
        roomTypeId: roomTypeRecord.id,
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

  @Get(":propertyId/rates/lookup")
  @RequirePermission("property.read")
  async lookupRate(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Query() query: RateLookupQueryDto,
  ): Promise<Record<string, unknown>> {
    const result = await this.rateLookup.lookup({
      arrivalDate: new Date(query.arrivalDate),
      departureDate: new Date(query.departureDate),
      guestCount: query.guestCount,
      propertyId,
      ratePlanId: query.ratePlanId?.trim() || undefined,
      roomTypeId: query.roomTypeId,
      tenantId: context.tenant.id,
    });

    return {
      arrivalDate: result.arrivalDate,
      baseAmount: result.baseAmount,
      currency: result.currency,
      departureDate: result.departureDate,
      extraGuestAmount: result.extraGuestAmount,
      guestCount: result.guestCount,
      minNights: result.minNights,
      nightlyRates: result.nightlyRates,
      nights: result.nights,
      totalAmount: result.totalAmount,
    };
  }

  @Get(":propertyId/hotel-availability")
  @RequirePermission("property.read")
  async checkHotelAvailability(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Query() query: HotelAvailabilityQueryDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const arrivalDate = this.requiredHotelDate(
      query.arrivalDate,
      "Arrival date",
    );
    const departureDate = this.requiredHotelDate(
      query.departureDate,
      "Departure date",
    );

    if (departureDate <= arrivalDate) {
      throw new BadRequestException(
        "Departure date must be after arrival date.",
      );
    }

    if (query.roomTypeId) {
      await this.findTenantRoomType(
        context.tenant.id,
        property.id,
        query.roomTypeId,
      );
    }

    const availability = await this.buildAvailability({
      arrivalDate,
      departureDate,
      propertyId: property.id,
      roomTypeId: query.roomTypeId?.trim() || undefined,
      tenantId: context.tenant.id,
    });

    return {
      arrivalDate,
      departureDate,
      ...availability,
    };
  }

  @Post(":propertyId/hotel-reservations")
  @RequirePermission("reservations.manage")
  async createHotelReservation(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateHotelReservationDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const roomType = await this.findTenantRoomType(
      context.tenant.id,
      property.id,
      body.roomTypeId,
    );
    const arrivalDate = this.requiredHotelDate(
      body.arrivalDate,
      "Arrival date",
    );
    const departureDate = this.requiredHotelDate(
      body.departureDate,
      "Departure date",
    );

    if (departureDate <= arrivalDate) {
      throw new BadRequestException(
        "Departure date must be after arrival date.",
      );
    }

    const assignedRoom = body.assignedRoomId
      ? await this.findAssignableRoom(
          context.tenant.id,
          property.id,
          body.assignedRoomId,
          roomType.id,
        )
      : null;

    if (assignedRoom) {
      await this.assertRoomAvailableForDates({
        arrivalDate,
        departureDate,
        roomId: assignedRoom.id,
        tenantId: context.tenant.id,
      });
    }

    if (body.ratePlanId) {
      await this.findTenantRatePlan(
        context.tenant.id,
        property.id,
        body.ratePlanId,
        roomType.id,
      );
    }

    const rateOverride = this.optionalDecimal(
      body.rateOverride,
      "Rate override",
    );

    if (rateOverride && !hasTenantPermission(context.role, "property.manage")) {
      throw new BadRequestException(
        "Only property managers can apply reservation rate overrides.",
      );
    }

    const isComplimentary = body.isComplimentary ?? false;

    if (
      isComplimentary &&
      !hasTenantPermission(context.role, "property.manage")
    ) {
      throw new BadRequestException(
        "Only property managers can mark reservations as complimentary.",
      );
    }

    if (isComplimentary && rateOverride) {
      throw new BadRequestException(
        "Complimentary reservations cannot also use a rate override.",
      );
    }

    const [firstName, ...lastNameParts] = body.guestName.trim().split(/\s+/);
    const lastName = lastNameParts.join(" ") || "Guest";

    return this.prisma.hotelReservation.create({
      data: {
        adultCount: this.optionalPositiveInteger(body.adultCount) ?? 1,
        arrivalDate,
        assignedRoomId: assignedRoom?.id ?? null,
        childCount: this.optionalNonNegativeInteger(body.childCount) ?? 0,
        confirmationCode: this.generateConfirmationCode(),
        createdByUserId: context.tenantUser.clerkUserId,
        currency: property.currency,
        departureDate,
        depositRequiredAmount:
          this.optionalDecimal(
            body.depositRequiredAmount,
            "Deposit required",
          ) ?? new Prisma.Decimal(0),
        guestEmail: body.guestEmail?.trim().toLowerCase() || null,
        guestName: body.guestName.trim(),
        guestPhone: body.guestPhone?.trim() || null,
        isComplimentary,
        guests: {
          create: {
            email: body.guestEmail?.trim().toLowerCase() || null,
            firstName,
            isPrimary: true,
            lastName,
            phone: body.guestPhone?.trim() || null,
            propertyId: property.id,
            tenantId: context.tenant.id,
          },
        },
        notes: body.notes?.trim() || null,
        propertyId: property.id,
        complimentaryReason: isComplimentary
          ? body.complimentaryReason?.trim() || null
          : null,
        rateOverride,
        ratePlanId: body.ratePlanId?.trim() || null,
        roomTypeId: roomType.id,
        source: body.source ?? "walk_in",
        specialRequests: body.specialRequests?.trim() || null,
        status: "confirmed",
        tenantId: context.tenant.id,
      },
      include: {
        assignedRoom: true,
        guests: true,
        roomType: true,
      },
    });
  }

  @Patch(":propertyId/hotel-reservations/:reservationId/status")
  @RequirePermission("reservations.manage")
  async updateHotelReservationStatus(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Param("reservationId") reservationId: string,
    @Body() body: UpdateHotelReservationStatusDto,
  ): Promise<Record<string, unknown>> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const reservation = await this.prisma.hotelReservation.findFirst({
      where: {
        id: reservationId,
        propertyId,
        tenantId: context.tenant.id,
      },
    });

    if (!reservation) {
      throw new BadRequestException(
        "Reservation was not found for this property.",
      );
    }

    return this.prisma.hotelReservation.update({
      where: { id: reservation.id },
      data: {
        status: body.status,
        statusChangedAt: new Date(),
        statusChangedByUserId: context.tenantUser.clerkUserId,
      },
    });
  }

  @Post(":propertyId/rooms/:roomId/check-in")
  @RequirePermission("reservations.manage")
  async checkIn(
    @CurrentTenant() context: TenantContext,
    @Param("propertyId") propertyId: string,
    @Param("roomId") roomId: string,
    @Body() body: CheckInDto,
  ): Promise<unknown> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const room = await this.findTenantRoom(
      context.tenant.id,
      propertyId,
      roomId,
    );

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

    const reservation = body.reservationId
      ? await this.prisma.hotelReservation.findFirst({
          where: {
            id: body.reservationId,
            propertyId,
            tenantId: context.tenant.id,
          },
          include: {
            guests: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
            },
          },
        })
      : null;

    if (body.reservationId && !reservation) {
      throw new BadRequestException(
        "Reservation was not found for this property.",
      );
    }

    if (
      reservation &&
      !["confirmed", "guaranteed"].includes(reservation.status)
    ) {
      throw new BadRequestException(
        "Only confirmed or guaranteed reservations can be checked in.",
      );
    }

    if (reservation?.assignedRoomId && reservation.assignedRoomId !== room.id) {
      throw new BadRequestException(
        "This reservation is assigned to a different room.",
      );
    }

    if (
      reservation &&
      room.roomTypeId &&
      reservation.roomTypeId !== room.roomTypeId
    ) {
      throw new BadRequestException(
        "This room does not match the reservation room type.",
      );
    }

    if (reservation) {
      const existingReservationStay = await this.prisma.stay.findFirst({
        where: {
          hotelReservationId: reservation.id,
          tenantId: context.tenant.id,
        },
      });

      if (existingReservationStay) {
        throw new BadRequestException(
          "This reservation has already been checked in.",
        );
      }
    }

    const reservationPrimaryGuest = reservation?.guests[0] ?? null;
    const [reservationFirstName, ...reservationLastNameParts] =
      reservation?.guestName.trim().split(/\s+/) ?? [];
    const firstName =
      body.firstName?.trim() ||
      reservationPrimaryGuest?.firstName ||
      reservationFirstName;
    const lastName =
      body.lastName?.trim() ||
      reservationPrimaryGuest?.lastName ||
      reservationLastNameParts.join(" ") ||
      "Guest";
    const email =
      body.email?.trim().toLowerCase() ||
      reservationPrimaryGuest?.email ||
      reservation?.guestEmail?.trim().toLowerCase() ||
      null;
    const phone =
      body.phone?.trim() ||
      reservationPrimaryGuest?.phone ||
      reservation?.guestPhone?.trim() ||
      null;

    if (!firstName || !lastName) {
      throw new BadRequestException("Guest first and last name are required.");
    }

    const checkedInAt = new Date();
    const expectedCheckOutAt = body.expectedCheckOutAt
      ? this.parseExpectedCheckOutAt(body.expectedCheckOutAt)
      : (reservation?.departureDate ?? null);

    if (expectedCheckOutAt && Number.isNaN(expectedCheckOutAt.getTime())) {
      throw new BadRequestException("Expected check-out date is invalid.");
    }

    if (expectedCheckOutAt && expectedCheckOutAt <= checkedInAt) {
      throw new BadRequestException(
        "Expected check-out date must be after check-in.",
      );
    }

    const isComplimentaryStay = reservation?.isComplimentary ?? false;
    const roomNightQuote =
      expectedCheckOutAt && room.roomTypeId && !isComplimentaryStay
        ? await this.tryBuildRoomNightQuote({
            arrivalDate: checkedInAt,
            departureDate: expectedCheckOutAt,
            guestCount: reservation
              ? reservation.adultCount + reservation.childCount
              : 1,
            propertyId,
            ratePlanId: reservation?.ratePlanId ?? undefined,
            reservationRateOverride: reservation?.rateOverride ?? undefined,
            roomTypeId: room.roomTypeId,
            tenantId: context.tenant.id,
          })
        : null;
    const roomChargeLineItems = roomNightQuote
      ? this.buildRoomChargeLineItems({
          postedById: context.tenantUser.clerkUserId,
          property,
          quote: roomNightQuote,
          roomNumber: room.number,
          tenantId: context.tenant.id,
        })
      : [];
    const roomChargeTotal = this.sumFolioLineAmounts(roomChargeLineItems);

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
          checkInAt: checkedInAt,
          expectedCheckOutAt,
          guestId: guest.id,
          hotelReservationId: reservation?.id ?? null,
          notes:
            body.notes?.trim() ||
            reservation?.notes?.trim() ||
            reservation?.specialRequests?.trim() ||
            null,
          propertyId,
          roomId,
          tenantId: context.tenant.id,
        },
        include: {
          guest: true,
          room: true,
        },
      });

      const guestFolio = await tx.guestFolio.create({
        data: {
          createdByUserId: context.tenantUser.clerkUserId,
          currency: property.currency,
          guestId: guest.id,
          propertyId,
          stayId: createdStay.id,
          tenantId: context.tenant.id,
        },
      });

      if (roomChargeLineItems.length > 0) {
        await tx.folioLineItem.createMany({
          data: roomChargeLineItems.map((lineItem) => ({
            ...lineItem,
            folioId: guestFolio.id,
            sourceId: createdStay.id,
          })),
        });

        await tx.guestFolio.update({
          where: { id: guestFolio.id },
          data: {
            balance: { increment: roomChargeTotal },
          },
        });
      }

      await tx.room.update({
        where: { id: room.id },
        data: { status: "occupied" },
      });

      if (reservation) {
        await tx.hotelReservation.update({
          where: { id: reservation.id },
          data: {
            assignedRoomId: room.id,
            status: "checked_in",
            statusChangedAt: new Date(),
            statusChangedByUserId: context.tenantUser.clerkUserId,
          },
        });

        await tx.hotelReservationGuest.updateMany({
          where: {
            isPrimary: true,
            reservationId: reservation.id,
            tenantId: context.tenant.id,
          },
          data: { guestId: guest.id },
        });
      }

      await tx.hotelAuditLog.create({
        data: {
          actorId: context.tenantUser.clerkUserId,
          actorRole: context.role,
          event: "check_in_completed",
          newState: {
            expectedCheckOutAt,
            folioId: guestFolio.id,
            isComplimentary: isComplimentaryStay,
            roomChargeTotal:
              roomChargeLineItems.length > 0
                ? roomChargeTotal.toString()
                : null,
            roomNightChargeTotal:
              roomNightQuote?.totalAmount.toString() ?? null,
            roomNightCount: roomNightQuote?.nights ?? 0,
            guestId: guest.id,
            hotelReservationId: reservation?.id ?? null,
            roomId,
            roomStatus: "occupied",
            stayId: createdStay.id,
          },
          previousState: {
            roomStatus: room.status,
            stayStatus: null,
          },
          propertyId,
          reservationId: reservation?.id ?? null,
          roomId,
          stayId: createdStay.id,
          tenantId: context.tenant.id,
        },
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
  ): Promise<unknown> {
    const property = await this.findTenantProperty(
      context.tenant.id,
      propertyId,
    );
    const room = await this.findTenantRoom(
      context.tenant.id,
      propertyId,
      roomId,
    );
    const activeStay = await this.prisma.stay.findFirst({
      where: {
        propertyId,
        roomId,
        status: "active",
        tenantId: context.tenant.id,
      },
      include: {
        hotelReservation: true,
      },
      orderBy: { checkInAt: "desc" },
    });

    if (!activeStay) {
      const completedStay = await this.prisma.stay.findFirst({
        where: {
          propertyId,
          roomId,
          status: "checked_out",
          tenantId: context.tenant.id,
        },
        include: {
          guest: true,
          room: true,
        },
        orderBy: { checkOutAt: "desc" },
      });

      if (completedStay) {
        return completedStay;
      }

      throw new BadRequestException("This room does not have an active stay.");
    }

    if (room.status !== "occupied") {
      throw new BadRequestException(
        "Only occupied rooms with an active stay can be checked out.",
      );
    }

    const checkedOutAt = new Date();
    const extraNightQuote = await this.tryBuildExtraNightQuote({
      checkedOutAt,
      propertyId,
      roomTypeId: room.roomTypeId,
      stay: activeStay,
      tenantId: context.tenant.id,
    });
    const extraNightLineItems = extraNightQuote
      ? this.buildRoomChargeLineItems({
          descriptionPrefix: "Extra room night",
          postedById: context.tenantUser.clerkUserId,
          property,
          quote: extraNightQuote,
          roomNumber: room.number,
          tenantId: context.tenant.id,
        })
      : [];
    const extraNightChargeTotal = this.sumFolioLineAmounts(extraNightLineItems);

    if (extraNightLineItems.length > 0 && !body?.acknowledgeExtraNightCharges) {
      throw new BadRequestException(
        `Review ${extraNightQuote?.nights ?? 0} extra room night${
          extraNightQuote?.nights === 1 ? "" : "s"
        } totaling ${
          extraNightQuote?.currency ?? property.currency
        } ${extraNightChargeTotal.toFixed(
          2,
        )} before checkout. Confirm checkout to post these charges.`,
      );
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
      const guestFolio = await tx.guestFolio.findUnique({
        where: { stayId: activeStay.id },
      });

      if (extraNightLineItems.length > 0 && guestFolio) {
        await tx.folioLineItem.createMany({
          data: extraNightLineItems.map((lineItem) => ({
            ...lineItem,
            folioId: guestFolio.id,
            sourceId: activeStay.id,
          })),
        });

        await tx.guestFolio.update({
          where: { id: guestFolio.id },
          data: {
            balance: { increment: extraNightChargeTotal },
          },
        });
      }

      const completedStay = await tx.stay.update({
        where: { id: activeStay.id },
        data: {
          checkedOutByUserId: context.tenantUser.clerkUserId,
          checkOutAt: checkedOutAt,
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

      await tx.guestFolio.updateMany({
        where: {
          stayId: completedStay.id,
          status: { in: ["open", "pending_checkout"] },
          tenantId: context.tenant.id,
        },
        data: {
          closedAt: completedStay.checkOutAt,
          closedByUserId: context.tenantUser.clerkUserId,
          status: "closed",
        },
      });

      await tx.hotelAuditLog.create({
        data: {
          actorId: context.tenantUser.clerkUserId,
          actorRole: context.role,
          event: "check_out_completed",
          newState: {
            checkOutAt: completedStay.checkOutAt,
            extraNightChargeTotal:
              extraNightLineItems.length > 0
                ? extraNightChargeTotal.toString()
                : null,
            extraNightCount: extraNightQuote?.nights ?? 0,
            folioStatus: "closed",
            roomStatus: "cleaning",
            stayStatus: completedStay.status,
          },
          previousState: {
            roomStatus: room.status,
            stayStatus: activeStay.status,
          },
          propertyId,
          reservationId: completedStay.hotelReservationId,
          roomId: room.id,
          stayId: completedStay.id,
          tenantId: context.tenant.id,
        },
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
  ): Promise<unknown> {
    const status = body.status;

    if (!roomStatuses.includes(status)) {
      throw new BadRequestException("Choose a valid room status.");
    }

    const allowedStatuses = allowedRoomStatusesForRole(context.role);

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        "Your role cannot set rooms to that status.",
      );
    }

    await this.findTenantProperty(context.tenant.id, propertyId);

    const room = await this.findTenantRoom(
      context.tenant.id,
      propertyId,
      roomId,
    );

    if (room.status === status) {
      return room;
    }

    const activeStay = await this.prisma.stay.findFirst({
      where: {
        roomId: room.id,
        status: "active",
        tenantId: context.tenant.id,
      },
      orderBy: { checkInAt: "desc" },
    });

    if (activeStay && status !== "occupied") {
      throw new BadRequestException(
        "Rooms with an active stay must remain occupied until checkout.",
      );
    }

    if (!activeStay && status === "occupied") {
      throw new BadRequestException("Use check-in to mark a room as occupied.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRoom = await tx.room.update({
        where: { id: room.id },
        data: { status },
      });

      await tx.hotelAuditLog.create({
        data: {
          actorId: context.tenantUser.clerkUserId,
          actorRole: context.role,
          event: "room_status_changed",
          newState: {
            status: updatedRoom.status,
          },
          previousState: {
            status: room.status,
          },
          propertyId,
          roomId: room.id,
          stayId: activeStay?.id ?? null,
          tenantId: context.tenant.id,
        },
      });

      return updatedRoom;
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

  private async findTenantRoomType(
    tenantId: string,
    propertyId: string,
    roomTypeId: string,
  ) {
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
        propertyId,
        tenantId,
      },
    });

    if (!roomType) {
      throw new BadRequestException(
        "Room type was not found for this property.",
      );
    }

    return roomType;
  }

  private async findTenantRatePlan(
    tenantId: string,
    propertyId: string,
    ratePlanId: string,
    roomTypeId: string,
  ) {
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: {
        OR: [{ roomTypeId }, { roomTypeId: null }],
        id: ratePlanId,
        propertyId,
        status: "active",
        tenantId,
      },
    });

    if (!ratePlan) {
      throw new BadRequestException(
        "Rate plan was not found for this room type.",
      );
    }

    return ratePlan;
  }

  private async findAssignableRoom(
    tenantId: string,
    propertyId: string,
    roomId: string,
    roomTypeId: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        propertyId,
        roomTypeId,
        status: { notIn: ["maintenance", "out_of_order"] },
        tenantId,
      },
    });

    if (!room) {
      throw new BadRequestException(
        "Assigned room was not found, does not match the room type, or is unavailable.",
      );
    }

    return room;
  }

  private async assertRoomAvailableForDates(input: {
    tenantId: string;
    roomId: string;
    arrivalDate: Date;
    departureDate: Date;
  }) {
    const [overlappingReservation, overlappingStay] = await Promise.all([
      this.prisma.hotelReservation.findFirst({
        where: {
          assignedRoomId: input.roomId,
          arrivalDate: { lt: input.departureDate },
          departureDate: { gt: input.arrivalDate },
          status: {
            notIn: ["cancelled", "no_show", "checked_out"],
          },
          tenantId: input.tenantId,
        },
      }),
      this.prisma.stay.findFirst({
        where: {
          OR: [
            { expectedCheckOutAt: null },
            { expectedCheckOutAt: { gt: input.arrivalDate } },
            { checkOutAt: { gt: input.arrivalDate } },
          ],
          checkInAt: { lt: input.departureDate },
          roomId: input.roomId,
          status: "active",
          tenantId: input.tenantId,
        },
      }),
    ]);

    if (overlappingReservation || overlappingStay) {
      throw new BadRequestException(
        "Assigned room is not available for those dates.",
      );
    }
  }

  private async buildAvailability(input: {
    tenantId: string;
    propertyId: string;
    roomTypeId?: string;
    arrivalDate: Date;
    departureDate: Date;
  }) {
    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId: input.propertyId,
        roomTypeId: input.roomTypeId,
        status: { notIn: ["maintenance", "out_of_order"] },
        tenantId: input.tenantId,
      },
      orderBy: { number: "asc" },
    });
    const [reservedRoomIds, occupiedRoomIds] = await Promise.all([
      this.prisma.hotelReservation.findMany({
        select: { assignedRoomId: true },
        where: {
          assignedRoomId: { not: null },
          arrivalDate: { lt: input.departureDate },
          departureDate: { gt: input.arrivalDate },
          propertyId: input.propertyId,
          status: {
            notIn: ["cancelled", "no_show", "checked_out"],
          },
          tenantId: input.tenantId,
        },
      }),
      this.prisma.stay.findMany({
        select: { roomId: true },
        where: {
          OR: [
            { expectedCheckOutAt: null },
            { expectedCheckOutAt: { gt: input.arrivalDate } },
            { checkOutAt: { gt: input.arrivalDate } },
          ],
          checkInAt: { lt: input.departureDate },
          propertyId: input.propertyId,
          status: "active",
          tenantId: input.tenantId,
        },
      }),
    ]);
    const blockedRoomIds = new Set([
      ...reservedRoomIds
        .map((reservation) => reservation.assignedRoomId)
        .filter(Boolean),
      ...occupiedRoomIds.map((stay) => stay.roomId),
    ]);
    const availableRooms = rooms.filter((room) => !blockedRoomIds.has(room.id));

    return {
      availableRooms: availableRooms.map((room) => ({
        id: room.id,
        number: room.number,
        roomTypeId: room.roomTypeId,
        status: room.status,
        type: room.type,
      })),
      availableRoomCount: availableRooms.length,
      totalRoomCount: rooms.length,
    };
  }

  private optionalDecimal(
    value: string | number | undefined,
    label: string,
  ): Prisma.Decimal | null {
    if (value === undefined || value === null || String(value).trim() === "") {
      return null;
    }

    return this.requiredDecimal(value, label);
  }

  private optionalPercentRate(
    value: string | number | undefined,
    label: string,
  ): Prisma.Decimal | null {
    if (value === undefined || value === null || String(value).trim() === "") {
      return null;
    }

    const percent = this.requiredDecimal(value, label);

    if (percent.greaterThan(100)) {
      throw new BadRequestException(`${label} cannot be more than 100%.`);
    }

    return percent.div(100).toDecimalPlaces(6);
  }

  private requiredDecimal(
    value: string | number | undefined,
    label: string,
  ): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(value ?? "");

      if (decimal.isNegative()) {
        throw new Error("negative");
      }

      return decimal;
    } catch {
      throw new BadRequestException(`${label} must be a valid amount.`);
    }
  }

  private requiredHotelDate(value: string, label: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} is invalid.`);
    }

    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private parseExpectedCheckOutAt(value: string) {
    const trimmedValue = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;

      return new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999),
      );
    }

    return new Date(trimmedValue);
  }

  private toHotelDate(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private async tryBuildRoomNightQuote(input: {
    arrivalDate: Date;
    departureDate: Date;
    guestCount: number;
    propertyId: string;
    ratePlanId?: string;
    reservationRateOverride?: Prisma.Decimal.Value;
    roomTypeId: string;
    tenantId: string;
  }) {
    try {
      return await this.rateLookup.lookup(input);
    } catch (error) {
      const response =
        error instanceof BadRequestException ? error.getResponse() : null;
      const message =
        typeof response === "object" && response && "message" in response
          ? String((response as { message?: unknown }).message)
          : error instanceof Error
            ? error.message
            : "";

      if (message.includes("No active room rate is configured")) {
        return null;
      }

      throw error;
    }
  }

  private async tryBuildExtraNightQuote(input: {
    checkedOutAt: Date;
    propertyId: string;
    roomTypeId: string | null;
    stay: {
      checkInAt: Date;
      expectedCheckOutAt: Date | null;
      hotelReservation: {
        adultCount: number;
        childCount: number;
        isComplimentary: boolean;
        rateOverride: Prisma.Decimal | null;
        ratePlanId: string | null;
      } | null;
    };
    tenantId: string;
  }) {
    if (
      !input.roomTypeId ||
      !input.stay.expectedCheckOutAt ||
      input.stay.hotelReservation?.isComplimentary
    ) {
      return null;
    }

    const extraArrivalDate = this.toHotelDate(input.stay.expectedCheckOutAt);
    const extraDepartureDate = this.toHotelDate(input.checkedOutAt);

    if (extraDepartureDate <= extraArrivalDate) {
      return null;
    }

    return this.tryBuildRoomNightQuote({
      arrivalDate: extraArrivalDate,
      departureDate: extraDepartureDate,
      guestCount: input.stay.hotelReservation
        ? input.stay.hotelReservation.adultCount +
          input.stay.hotelReservation.childCount
        : 1,
      propertyId: input.propertyId,
      ratePlanId: input.stay.hotelReservation?.ratePlanId ?? undefined,
      reservationRateOverride:
        input.stay.hotelReservation?.rateOverride ?? undefined,
      roomTypeId: input.roomTypeId,
      tenantId: input.tenantId,
    });
  }

  private buildRoomChargeLineItems(input: {
    descriptionPrefix?: string;
    postedById: string;
    property: {
      id: string;
      serviceChargeRate: Prisma.Decimal | null;
      taxRate: Prisma.Decimal | null;
    };
    quote: Awaited<ReturnType<HotelRateLookupService["lookup"]>>;
    roomNumber: string;
    tenantId: string;
  }): RoomChargeLineItem[] {
    const roomNightLines = input.quote.nightlyRates.map((rate) => {
      const extraGuestCount = Math.max(
        input.quote.guestCount - rate.baseOccupancy,
        0,
      );
      const extraGuestAmount = rate.extraGuestRate.mul(extraGuestCount);
      const amount = this.roundMoney(rate.baseRate.plus(extraGuestAmount));

      return {
        amount,
        currency: rate.currency,
        description: `${input.descriptionPrefix ?? "Room night"} ${
          input.roomNumber
        } - ${rate.date.toISOString().slice(0, 10)}`,
        postedById: input.postedById,
        propertyId: input.property.id,
        sourceType: "stay",
        tenantId: input.tenantId,
        type: "room_night" as const,
        unitAmount: amount,
      };
    });
    const roomSubtotal = this.sumFolioLineAmounts(roomNightLines);
    const currency = input.quote.currency;
    const serviceChargeRate =
      input.property.serviceChargeRate ?? new Prisma.Decimal(0);
    const taxRate = input.property.taxRate ?? new Prisma.Decimal(0);
    const serviceChargeAmount = this.roundMoney(
      roomSubtotal.mul(serviceChargeRate),
    );
    const taxableBase = roomSubtotal.plus(serviceChargeAmount);
    const taxAmount = this.roundMoney(taxableBase.mul(taxRate));
    const lineItems: RoomChargeLineItem[] = [...roomNightLines];

    if (serviceChargeAmount.greaterThan(0)) {
      lineItems.push({
        amount: serviceChargeAmount,
        currency,
        description: `Room service charge ${serviceChargeRate
          .mul(100)
          .toDecimalPlaces(2)
          .toString()}%`,
        postedById: input.postedById,
        propertyId: input.property.id,
        sourceType: "stay",
        tenantId: input.tenantId,
        type: "service_charge" as const,
        unitAmount: serviceChargeAmount,
      });
    }

    if (taxAmount.greaterThan(0)) {
      lineItems.push({
        amount: taxAmount,
        currency,
        description: `Room tax ${taxRate.mul(100).toDecimalPlaces(2).toString()}%`,
        postedById: input.postedById,
        propertyId: input.property.id,
        sourceType: "stay",
        tenantId: input.tenantId,
        type: "tax" as const,
        unitAmount: taxAmount,
      });
    }

    return lineItems;
  }

  private sumFolioLineAmounts(lineItems: Array<{ amount: Prisma.Decimal }>) {
    return lineItems.reduce(
      (total, lineItem) => total.plus(lineItem.amount),
      new Prisma.Decimal(0),
    );
  }

  private roundMoney(value: Prisma.Decimal) {
    return value.toDecimalPlaces(2);
  }

  private optionalNonNegativeInteger(value: number | string | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    const parsedValue =
      typeof value === "string" && value.trim() !== "" ? Number(value) : value;

    if (!Number.isInteger(parsedValue) || Number(parsedValue) < 0) {
      throw new BadRequestException("Value must be zero or greater.");
    }

    return Number(parsedValue);
  }

  private optionalPositiveInteger(value: number | string | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    return this.requiredPositiveInteger(value, "Room count");
  }

  private toRoomTypeCode(value: string) {
    const code = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    return code || "standard";
  }

  private generateConfirmationCode() {
    return `HR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
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
