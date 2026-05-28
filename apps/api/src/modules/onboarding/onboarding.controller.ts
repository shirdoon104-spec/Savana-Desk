import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { ClerkAuthContext } from "../auth/clerk-auth.guard";
import { ClerkOrganizationResolver } from "../auth/clerk-organization.resolver";
import { PrismaService } from "../database/prisma.service";

type OperatingModel = "hotel_only" | "hotel_restaurant";

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === "" ? undefined : value;

class CompleteOnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsIn(["USD", "SOS"])
  currency!: "USD" | "SOS";

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  mobileMoneyProvider!: string;

  @IsIn(["hotel_only", "hotel_restaurant"])
  operatingModel!: OperatingModel;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  propertyName!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  restaurantName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  restaurantServiceStyle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomCount?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tenantName!: string;
}

@Controller("onboarding")
export class OnboardingController {
  constructor(
    private readonly clerkOrganizations: ClerkOrganizationResolver,
    private readonly prisma: PrismaService,
  ) {}

  @Post("complete")
  @UseGuards(ClerkAuthGuard)
  async complete(
    @CurrentAuth() auth: ClerkAuthContext,
    @Body() body: CompleteOnboardingDto,
  ): Promise<Record<string, unknown>> {
    const organization = await this.clerkOrganizations.resolve(auth);

    if (!organization.orgId) {
      throw new BadRequestException(
        "Create or select a Clerk organization before completing onboarding.",
      );
    }

    this.validate(body);

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { clerkOrgId: organization.orgId },
      include: {
        users: {
          where: {
            clerkUserId: auth.userId,
            role: "owner",
            status: "active",
          },
          take: 1,
        },
      },
    });

    if (existingTenant && !existingTenant.users.length) {
      throw new ForbiddenException(
        "Only an active tenant owner can update onboarding.",
      );
    }

    const tenantSlug = this.slugify(organization.orgSlug ?? body.tenantName);
    const tenant = await this.prisma.tenant.upsert({
      where: { clerkOrgId: organization.orgId },
      update: {
        mobileMoneyProvider: body.mobileMoneyProvider,
        name: body.tenantName.trim(),
        onboardingCompletedAt: new Date(),
        operatingModel: body.operatingModel,
      },
      create: {
        clerkOrgId: organization.orgId,
        mobileMoneyProvider: body.mobileMoneyProvider,
        name: body.tenantName.trim(),
        onboardingCompletedAt: new Date(),
        operatingModel: body.operatingModel,
        slug: await this.uniqueTenantSlug(tenantSlug),
        users: {
          create: {
            clerkUserId: auth.userId,
            role: "owner",
          },
        },
      },
      include: {
        users: true,
      },
    });

    await this.prisma.tenantUser.upsert({
      where: {
        tenantId_clerkUserId: {
          tenantId: tenant.id,
          clerkUserId: auth.userId,
        },
      },
      update: {
        role: "owner",
      },
      create: {
        tenantId: tenant.id,
        clerkUserId: auth.userId,
        role: "owner",
      },
    });

    const property = await this.prisma.property.upsert({
      where: {
        id: `bootstrap:${tenant.id}`,
      },
      update: {
        city: body.city.trim(),
        currency: body.currency,
        name: body.propertyName.trim(),
        roomCount: body.roomCount ?? null,
      },
      create: {
        city: body.city.trim(),
        currency: body.currency,
        id: `bootstrap:${tenant.id}`,
        name: body.propertyName.trim(),
        roomCount: body.roomCount ?? null,
        tenantId: tenant.id,
      },
    });

    const restaurant =
      body.operatingModel === "hotel_restaurant"
        ? await this.prisma.restaurant.upsert({
            where: {
              id: `bootstrap:${tenant.id}:restaurant`,
            },
            update: {
              name: body.restaurantName?.trim() || `${body.propertyName} Restaurant`,
              serviceStyle: body.restaurantServiceStyle ?? null,
            },
            create: {
              id: `bootstrap:${tenant.id}:restaurant`,
              name: body.restaurantName?.trim() || `${body.propertyName} Restaurant`,
              propertyId: property.id,
              serviceStyle: body.restaurantServiceStyle ?? null,
              tenantId: tenant.id,
            },
          })
        : null;

    return {
      tenant,
      property,
      restaurant,
      setup: {
        operatingModel: body.operatingModel,
        city: body.city.trim(),
        roomCount: body.roomCount ?? null,
        mobileMoneyProvider: body.mobileMoneyProvider,
        restaurantServiceStyle:
          body.operatingModel === "hotel_restaurant"
            ? body.restaurantServiceStyle ?? null
            : null,
      },
    };
  }

  private validate(body: CompleteOnboardingDto) {
    if (!["hotel_only", "hotel_restaurant"].includes(body.operatingModel)) {
      throw new BadRequestException("Choose a valid operating model.");
    }

    for (const [key, value] of Object.entries({
      tenantName: body.tenantName,
      propertyName: body.propertyName,
      city: body.city,
      currency: body.currency,
      mobileMoneyProvider: body.mobileMoneyProvider,
    })) {
      if (!value || String(value).trim().length < 2) {
        throw new BadRequestException(`${key} is required.`);
      }
    }

    if (
      body.operatingModel === "hotel_restaurant" &&
      (!body.restaurantName || body.restaurantName.trim().length < 2)
    ) {
      throw new BadRequestException("Restaurant name is required.");
    }
  }

  private async uniqueTenantSlug(baseSlug: string) {
    let candidate = baseSlug || "tenant";
    let suffix = 1;

    while (await this.prisma.tenant.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
