import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn } from "class-validator";
import { tenantRoles, type TenantRole } from "@rayaan/shared";
import { ClerkClientService } from "../auth/clerk-client.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import type { TenantContext } from "../tenancy/tenant-context.service";
import { PrismaService } from "../database/prisma.service";
import type { ClerkAuthContext } from "../auth/clerk-auth.guard";

const staffRoles = tenantRoles.filter((role) => role !== "guest");

class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsIn(staffRoles)
  role!: TenantRole;
}

function assertTenantRole(role: string | undefined): TenantRole {
  if (!role || !tenantRoles.includes(role as TenantRole)) {
    throw new BadRequestException("Choose a valid staff role.");
  }

  if (role === "guest") {
    throw new BadRequestException("Guest is not a staff role.");
  }

  return role as TenantRole;
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

@Controller("team")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class TeamController {
  constructor(
    private readonly clerkClients: ClerkClientService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission("staff.read")
  async list(@CurrentTenant() context: TenantContext) {
    const clerk = this.getClerkClient();
    const users = await this.prisma.tenantUser.findMany({
      where: { tenantId: context.tenant.id, status: "active" },
      orderBy: { createdAt: "asc" },
    });
    const invitations = await this.prisma.staffInvitation.findMany({
      where: { tenantId: context.tenant.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const clerkUsers = await Promise.allSettled(
      users.map((user) => clerk.users.getUser(user.clerkUserId)),
    );

    return {
      currentUser: {
        clerkUserId: context.tenantUser.clerkUserId,
        role: context.role,
      },
      tenant: context.tenant,
      users: users.map((user, index) => {
        const clerkUser =
          clerkUsers[index].status === "fulfilled"
            ? clerkUsers[index].value
            : null;

        return {
          id: user.id,
          clerkUserId: user.clerkUserId,
          name: clerkUser ? getDisplayName(clerkUser) : user.clerkUserId,
          email: clerkUser ? getPrimaryEmail(clerkUser) : null,
          role: user.role,
          createdAt: user.createdAt,
        };
      }),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        invitationUrl: invitation.invitationUrl,
        role: invitation.role,
        status: invitation.status,
        createdAt: invitation.createdAt,
      })),
    };
  }

  @Post("invitations")
  @RequirePermission("staff.manage")
  async invite(
    @CurrentAuth() auth: ClerkAuthContext,
    @CurrentTenant() context: TenantContext,
    @Body() body: InviteStaffDto,
  ) {
    const email = body.email?.trim().toLowerCase();
    const role = assertTenantRole(body.role);

    if (!email) {
      throw new BadRequestException("Enter a valid email address.");
    }

    const redirectUrl = `${process.env.WEB_APP_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000"}/accept-invitation`;
    const existingInvitation = await this.prisma.staffInvitation.findUnique({
      where: {
        tenantId_email: {
          tenantId: context.tenant.id,
          email,
        },
      },
    });
    const clerk = this.getClerkClient();

    if (
      existingInvitation?.status === "pending" &&
      existingInvitation.clerkInvitationId
    ) {
      await clerk.organizations
        .revokeOrganizationInvitation({
          organizationId: context.clerkOrgId,
          invitationId: existingInvitation.clerkInvitationId,
          requestingUserId: auth.userId,
        })
        .catch(() => undefined);
    }

    const clerkInvitation =
      await clerk.organizations.createOrganizationInvitation({
        organizationId: context.clerkOrgId,
        emailAddress: email,
        role: role === "owner" || role === "admin" ? "org:admin" : "org:member",
        inviterUserId: auth.userId,
        privateMetadata: { tenantRole: role },
        publicMetadata: { tenantRole: role },
        redirectUrl,
      });

    const invitation = await this.prisma.staffInvitation.upsert({
      where: {
        tenantId_email: {
          tenantId: context.tenant.id,
          email,
        },
      },
      create: {
        tenantId: context.tenant.id,
        clerkOrgId: context.clerkOrgId,
        clerkInvitationId: clerkInvitation.id,
        invitationUrl: clerkInvitation.url,
        email,
        role,
        invitedByClerkUserId: auth.userId,
      },
      update: {
        clerkInvitationId: clerkInvitation.id,
        invitationUrl: clerkInvitation.url,
        role,
        status: "pending",
        invitedByClerkUserId: auth.userId,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      invitationUrl: invitation.invitationUrl,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      redirectUrl,
    };
  }

  @Delete("members/:memberId")
  @RequirePermission("staff.manage")
  async removeMember(
    @CurrentAuth() auth: ClerkAuthContext,
    @CurrentTenant() context: TenantContext,
    @Param("memberId") memberId: string,
  ) {
    const member = await this.prisma.tenantUser.findFirst({
      where: {
        id: memberId,
        status: "active",
        tenantId: context.tenant.id,
      },
    });

    if (!member) {
      throw new BadRequestException("Member was not found in this tenant.");
    }

    if (member.clerkUserId === auth.userId) {
      throw new BadRequestException("You cannot remove your own membership.");
    }

    if (member.role === "owner") {
      const activeOwners = await this.prisma.tenantUser.count({
        where: {
          role: "owner",
          status: "active",
          tenantId: context.tenant.id,
        },
      });

      if (activeOwners <= 1) {
        throw new BadRequestException("A tenant must keep at least one owner.");
      }
    }

    const clerk = this.getClerkClient();
    const clerkMembershipRemoved = await clerk.organizations
      .deleteOrganizationMembership({
        organizationId: context.clerkOrgId,
        userId: member.clerkUserId,
      })
      .then(() => true)
      .catch(() => false);

    const removedMember = await this.prisma.tenantUser.update({
      where: { id: member.id },
      data: {
        removedAt: new Date(),
        removedByClerkUserId: auth.userId,
        status: "removed",
      },
    });

    return {
      clerkMembershipRemoved,
      id: removedMember.id,
      status: removedMember.status,
    };
  }

  private getClerkClient() {
    return this.clerkClients.getClient();
  }
}
