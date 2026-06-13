import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@rayaan/database";
import { PrismaService } from "../database/prisma.service";

type RateLookupSource =
  | "reservation_override"
  | "room_rate"
  | "rate_plan_default"
  | "room_type_default";

type RateLookupInput = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  arrivalDate: Date;
  departureDate: Date;
  guestCount?: number;
  ratePlanId?: string;
  reservationRateOverride?: Prisma.Decimal.Value;
};

type NightlyRate = {
  date: Date;
  baseRate: Prisma.Decimal;
  extraGuestRate: Prisma.Decimal;
  baseOccupancy: number;
  minNights: number;
  currency: string;
  source: RateLookupSource;
  ratePlanId: string | null;
  roomRateId: string | null;
};

type RateLookupResult = {
  arrivalDate: Date;
  departureDate: Date;
  nights: number;
  guestCount: number;
  currency: string;
  minNights: number;
  nightlyRates: NightlyRate[];
  baseAmount: Prisma.Decimal;
  extraGuestAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

@Injectable()
export class HotelRateLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(input: RateLookupInput): Promise<RateLookupResult> {
    const arrivalDate = normalizeHotelDate(input.arrivalDate, "Arrival date");
    const departureDate = normalizeHotelDate(
      input.departureDate,
      "Departure date",
    );

    if (departureDate <= arrivalDate) {
      throw new BadRequestException(
        "Departure date must be after arrival date.",
      );
    }

    const nights = datesForStay(arrivalDate, departureDate);
    const property = await this.prisma.property.findFirst({
      where: {
        id: input.propertyId,
        tenantId: input.tenantId,
      },
    });

    if (!property) {
      throw new BadRequestException("Property was not found for this tenant.");
    }

    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: input.roomTypeId,
        isActive: true,
        propertyId: input.propertyId,
        tenantId: input.tenantId,
      },
    });

    if (!roomType) {
      throw new BadRequestException(
        "Room type was not found for this property.",
      );
    }

    const guestCount = Math.max(1, Number(input.guestCount ?? 1));
    const nightlyRates = input.reservationRateOverride
      ? await this.buildOverrideRates(
          input,
          nights,
          roomType,
          property.currency,
        )
      : await this.buildConfiguredRates(
          input,
          nights,
          roomType,
          property.currency,
        );

    const minNights = Math.max(
      ...nightlyRates.map((rate) => rate.minNights),
      1,
    );

    if (nights.length < minNights) {
      throw new BadRequestException(
        `This rate requires at least ${minNights} night${
          minNights === 1 ? "" : "s"
        }.`,
      );
    }

    const extraGuestAmount = nightlyRates.reduce(
      (total, rate) =>
        total.plus(
          rate.extraGuestRate.mul(Math.max(guestCount - rate.baseOccupancy, 0)),
        ),
      new Prisma.Decimal(0),
    );
    const baseAmount = sumDecimals(nightlyRates.map((rate) => rate.baseRate));

    return {
      arrivalDate,
      baseAmount: roundMoney(baseAmount),
      currency: nightlyRates[0]?.currency ?? property.currency,
      departureDate,
      extraGuestAmount: roundMoney(extraGuestAmount),
      guestCount,
      minNights,
      nightlyRates,
      nights: nights.length,
      totalAmount: roundMoney(baseAmount.plus(extraGuestAmount)),
    };
  }

  private async buildOverrideRates(
    input: RateLookupInput,
    nights: Date[],
    roomType: {
      baseOccupancy: number;
      defaultCurrency: string;
    },
    propertyCurrency: string,
  ) {
    const ratePlan = input.ratePlanId
      ? await this.findRatePlan(input, input.ratePlanId)
      : null;
    const baseRate = new Prisma.Decimal(input.reservationRateOverride ?? 0);
    const currency =
      ratePlan?.currency ?? roomType.defaultCurrency ?? propertyCurrency;

    return nights.map<NightlyRate>((date) => ({
      baseOccupancy: this.effectiveBaseOccupancy(
        roomType.baseOccupancy,
        ratePlan?.baseOccupancy,
      ),
      baseRate,
      currency,
      date,
      extraGuestRate: new Prisma.Decimal(ratePlan?.extraGuestRate ?? 0),
      minNights: ratePlan?.minNights ?? 1,
      ratePlanId: ratePlan?.id ?? null,
      roomRateId: null,
      source: "reservation_override",
    }));
  }

  private async buildConfiguredRates(
    input: RateLookupInput,
    nights: Date[],
    roomType: {
      baseOccupancy: number;
      defaultCurrency: string;
      defaultRate: Prisma.Decimal | null;
    },
    propertyCurrency: string,
  ) {
    const ratePlan = input.ratePlanId
      ? await this.findRatePlan(input, input.ratePlanId)
      : await this.findDefaultRatePlan(input);

    const nightlyRates: NightlyRate[] = [];

    for (const date of nights) {
      const roomRate = await this.prisma.roomRate.findFirst({
        where: {
          isActive: true,
          propertyId: input.propertyId,
          ratePlanId: input.ratePlanId ?? undefined,
          roomTypeId: input.roomTypeId,
          startDate: { lte: date },
          tenantId: input.tenantId,
          endDate: { gt: date },
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });

      if (roomRate) {
        nightlyRates.push({
          baseOccupancy: this.effectiveBaseOccupancy(
            roomType.baseOccupancy,
            roomRate.baseOccupancy,
          ),
          baseRate: roomRate.baseRate,
          currency: roomRate.currency,
          date,
          extraGuestRate: roomRate.extraGuestRate,
          minNights: roomRate.minNights,
          ratePlanId: roomRate.ratePlanId,
          roomRateId: roomRate.id,
          source: "room_rate",
        });
        continue;
      }

      if (ratePlan?.defaultRate) {
        nightlyRates.push({
          baseOccupancy: this.effectiveBaseOccupancy(
            roomType.baseOccupancy,
            ratePlan.baseOccupancy,
          ),
          baseRate: ratePlan.defaultRate,
          currency: ratePlan.currency,
          date,
          extraGuestRate: ratePlan.extraGuestRate,
          minNights: ratePlan.minNights,
          ratePlanId: ratePlan.id,
          roomRateId: null,
          source: "rate_plan_default",
        });
        continue;
      }

      if (roomType.defaultRate) {
        nightlyRates.push({
          baseOccupancy: roomType.baseOccupancy,
          baseRate: roomType.defaultRate,
          currency: roomType.defaultCurrency || propertyCurrency,
          date,
          extraGuestRate: new Prisma.Decimal(0),
          minNights: 1,
          ratePlanId: ratePlan?.id ?? null,
          roomRateId: null,
          source: "room_type_default",
        });
        continue;
      }

      throw new BadRequestException(
        "No active room rate is configured for the requested dates.",
      );
    }

    return nightlyRates;
  }

  private effectiveBaseOccupancy(
    roomTypeBaseOccupancy: number,
    configuredBaseOccupancy?: number | null,
  ) {
    if (!configuredBaseOccupancy || configuredBaseOccupancy <= 1) {
      return roomTypeBaseOccupancy;
    }

    return configuredBaseOccupancy;
  }

  private async findDefaultRatePlan(input: RateLookupInput) {
    return this.prisma.ratePlan.findFirst({
      where: {
        OR: [{ roomTypeId: input.roomTypeId }, { roomTypeId: null }],
        propertyId: input.propertyId,
        status: "active",
        tenantId: input.tenantId,
      },
      orderBy: [{ roomTypeId: "desc" }, { createdAt: "asc" }],
    });
  }

  private async findRatePlan(input: RateLookupInput, ratePlanId: string) {
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: {
        OR: [{ roomTypeId: input.roomTypeId }, { roomTypeId: null }],
        id: ratePlanId,
        propertyId: input.propertyId,
        status: "active",
        tenantId: input.tenantId,
      },
    });

    if (!ratePlan) {
      throw new BadRequestException(
        "Rate plan was not found for this room type.",
      );
    }

    return ratePlan;
  }
}

function normalizeHotelDate(value: Date, label: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} is invalid.`);
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function datesForStay(arrivalDate: Date, departureDate: Date) {
  const dates: Date[] = [];
  let cursor = new Date(arrivalDate);

  while (cursor < departureDate) {
    dates.push(new Date(cursor));
    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
      ),
    );
  }

  return dates;
}

function sumDecimals(values: Prisma.Decimal.Value[]) {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(new Prisma.Decimal(value)),
    new Prisma.Decimal(0),
  );
}

function roundMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}
