import { Controller, Get, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { ClerkAuthContext } from "../auth/clerk-auth.guard";
import { ClerkOrganizationResolver } from "../auth/clerk-organization.resolver";
import { PrismaService } from "../database/prisma.service";

@Controller("tenancy")
export class TenancyController {
  constructor(
    private readonly clerkOrganizations: ClerkOrganizationResolver,
    private readonly prisma: PrismaService,
  ) {}

  @Get("context")
  @UseGuards(ClerkAuthGuard)
  async context(@CurrentAuth() auth: ClerkAuthContext) {
    const organization = await this.clerkOrganizations.resolve(auth);
    const tenant = organization.orgId
      ? await this.prisma.tenant.findUnique({
          where: { clerkOrgId: organization.orgId },
          include: {
            properties: {
              include: {
                restaurants: true,
              },
              orderBy: { createdAt: "asc" },
            },
            users: {
              where: { clerkUserId: auth.userId, status: "active" },
              take: 1,
            },
          },
        })
      : null;

    return {
      user: {
        clerkUserId: auth.userId,
        sessionId: auth.sessionId ?? null,
        role: tenant?.users[0]?.role ?? null,
      },
      organization: {
        clerkOrgId: organization.orgId ?? null,
        role: organization.orgRole ?? null,
        slug: organization.orgSlug ?? null,
      },
      tenantResolved: Boolean(tenant),
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            operatingModel: tenant.operatingModel,
            mobileMoneyProvider: tenant.mobileMoneyProvider,
            onboardingCompletedAt: tenant.onboardingCompletedAt,
            properties: tenant.properties.map((property) => ({
              city: property.city,
              id: property.id,
              name: property.name,
              roomCount: property.roomCount,
              currency: property.currency,
              restaurants: property.restaurants.map((restaurant) => ({
                id: restaurant.id,
                name: restaurant.name,
                serviceStyle: restaurant.serviceStyle,
              })),
            })),
          }
        : null,
      note: tenant
        ? "Tenant resolved from Clerk organization."
        : "No internal tenant exists for this Clerk organization yet.",
    };
  }
}
