import { Injectable } from "@nestjs/common";
import { createClerkClient } from "@clerk/backend";
import type { TenantRole } from "@rayaan/shared";
import type { ClerkAuthContext } from "../auth/clerk-auth.guard";
import { ClerkOrganizationResolver } from "../auth/clerk-organization.resolver";
import { PrismaService } from "../database/prisma.service";

export interface TenantContext {
  clerkOrgId: string;
  clerkOrgRole?: string;
  clerkOrgSlug?: string;
  role: TenantRole;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  tenantUser: {
    id: string;
    clerkUserId: string;
    role: TenantRole;
  };
}

@Injectable()
export class TenantContextService {
  constructor(
    private readonly clerkOrganizations: ClerkOrganizationResolver,
    private readonly prisma: PrismaService,
  ) {}

  async resolve(auth: ClerkAuthContext): Promise<TenantContext | null> {
    const organization = await this.clerkOrganizations.resolve(auth);

    if (!organization.orgId) {
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { clerkOrgId: organization.orgId },
      include: {
        users: {
          where: { clerkUserId: auth.userId, status: "active" },
          take: 1,
        },
      },
    });

    let tenantUser = tenant?.users[0];

    if (!tenant) {
      return null;
    }

    if (!tenantUser) {
      tenantUser = await this.provisionInvitedTenantUser({
        clerkOrgId: organization.orgId,
        clerkOrgRole: organization.orgRole,
        clerkUserId: auth.userId,
        tenantId: tenant.id,
      });
    }

    if (!tenantUser) {
      return null;
    }

    return {
      clerkOrgId: organization.orgId,
      clerkOrgRole: organization.orgRole,
      clerkOrgSlug: organization.orgSlug,
      role: tenantUser.role as TenantRole,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      },
      tenantUser: {
        id: tenantUser.id,
        clerkUserId: tenantUser.clerkUserId,
        role: tenantUser.role as TenantRole,
      },
    };
  }

  private async provisionInvitedTenantUser(input: {
    clerkOrgId: string;
    clerkOrgRole?: string;
    clerkUserId: string;
    tenantId: string;
  }) {
    const email = await this.getPrimaryEmail(input.clerkUserId);
    const invitation = email
      ? await this.prisma.staffInvitation.findFirst({
          where: {
            tenantId: input.tenantId,
            email,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const role =
      (invitation?.role as TenantRole | undefined) ??
      this.mapClerkRoleToTenantRole(input.clerkOrgRole);

    const tenantUser = await this.prisma.tenantUser.upsert({
      where: {
        tenantId_clerkUserId: {
          tenantId: input.tenantId,
          clerkUserId: input.clerkUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        clerkUserId: input.clerkUserId,
        role,
        status: "active",
      },
      update: {
        removedAt: null,
        removedByClerkUserId: null,
        role,
        status: "active",
      },
    });

    if (invitation && invitation.status !== "accepted") {
      await this.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedByClerkUserId: input.clerkUserId,
          status: "accepted",
        },
      });
    }

    return tenantUser;
  }

  private async getPrimaryEmail(clerkUserId: string) {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      return null;
    }

    const user = await createClerkClient({ secretKey }).users.getUser(clerkUserId);
    const primaryEmail = user.emailAddresses?.find(
      (email) => email.id === user.primaryEmailAddressId,
    );

    return (
      primaryEmail?.emailAddress.toLowerCase() ??
      user.emailAddresses?.[0]?.emailAddress.toLowerCase() ??
      null
    );
  }

  private mapClerkRoleToTenantRole(clerkRole?: string): TenantRole {
    return clerkRole === "org:admin" ? "admin" : "front_desk";
  }
}
