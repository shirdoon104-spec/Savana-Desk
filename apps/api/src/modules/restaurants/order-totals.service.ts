import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@rayaan/database";

type TotalsClient = Pick<Prisma.TransactionClient, "restaurant">;

@Injectable()
export class RestaurantOrderTotalsService {
  async calculateForRestaurant(
    client: TotalsClient,
    tenantId: string,
    restaurantId: string,
    subtotal: Prisma.Decimal,
    requestedDiscountAmount = new Prisma.Decimal(0),
  ) {
    const restaurant = await client.restaurant.findFirst({
      where: {
        id: restaurantId,
        tenantId,
      },
      select: {
        serviceChargeRate: true,
        taxRate: true,
        property: {
          select: {
            serviceChargeRate: true,
            taxRate: true,
          },
        },
      },
    });

    if (!restaurant) {
      throw new BadRequestException("Restaurant was not found for totals calculation.");
    }

    return this.calculate(subtotal, requestedDiscountAmount, {
      serviceChargeRate:
        restaurant.serviceChargeRate ??
        restaurant.property.serviceChargeRate ??
        readDecimalEnv("RESTAURANT_SERVICE_CHARGE_RATE"),
      taxRate:
        restaurant.taxRate ??
        restaurant.property.taxRate ??
        readDecimalEnv("RESTAURANT_TAX_RATE"),
    });
  }

  calculate(
    subtotal: Prisma.Decimal,
    requestedDiscountAmount = new Prisma.Decimal(0),
    rates: {
      serviceChargeRate: Prisma.Decimal;
      taxRate: Prisma.Decimal;
    },
  ) {
    const discountAmount = Prisma.Decimal.min(requestedDiscountAmount, subtotal);
    const serviceChargeBase = subtotal.minus(discountAmount);
    const serviceChargeAmount = roundMoney(serviceChargeBase.mul(rates.serviceChargeRate));
    const taxableBase = serviceChargeBase.plus(serviceChargeAmount);
    const taxAmount = roundMoney(taxableBase.mul(rates.taxRate));

    return {
      discountAmount,
      serviceChargeAmount,
      serviceChargeRate: rates.serviceChargeRate,
      subtotal,
      taxAmount,
      taxRate: rates.taxRate,
      totalAmount: roundMoney(taxableBase.plus(taxAmount)),
    };
  }
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
