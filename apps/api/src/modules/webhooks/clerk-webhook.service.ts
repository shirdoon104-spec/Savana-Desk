import { Injectable } from "@nestjs/common";
import type {
  OrganizationInvitationAcceptedWebhookEvent,
  OrganizationInvitationWebhookEvent,
  OrganizationMembershipWebhookEvent,
  UserWebhookEvent,
  WebhookEvent,
} from "@clerk/backend/webhooks";
import type { TenantRole } from "@rayaan/shared";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ClerkWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async handle(event: WebhookEvent) {
    switch (event.type) {
      case "user.deleted":
        return this.removeDeletedUser(event);
      case "organizationInvitation.accepted":
        return this.acceptInvitation(event);
      case "organizationInvitation.revoked":
        return this.revokeInvitation(event);
      case "organizationMembership.created":
        return this.provisionMembership(event);
      case "organizationMembership.deleted":
        return this.removeMembership(event);
      default:
        return { ignored: true, type: event.type };
    }
  }

  private async acceptInvitation(event: OrganizationInvitationAcceptedWebhookEvent) {
    const email = event.data.email_address.toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { clerkOrgId: event.data.organization_id },
    });

    if (!tenant) {
      return { ignored: true, reason: "tenant_not_found", type: event.type };
    }

    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { tenantId_email: { email, tenantId: tenant.id } },
    });

    if (!invitation || invitation.status === "revoked") {
      return { ignored: true, reason: "invitation_not_found", type: event.type };
    }

    await this.prisma.$transaction([
      this.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedByClerkUserId: event.data.user_id,
          status: "accepted",
        },
      }),
      this.prisma.tenantUser.upsert({
        where: {
          tenantId_clerkUserId: {
            clerkUserId: event.data.user_id,
            tenantId: tenant.id,
          },
        },
        create: {
          clerkUserId: event.data.user_id,
          role: invitation.role,
          status: "active",
          tenantId: tenant.id,
        },
        update: {
          removedAt: null,
          removedByClerkUserId: null,
          role: invitation.role,
          status: "active",
        },
      }),
    ]);

    return { accepted: true, type: event.type };
  }

  private async provisionMembership(event: OrganizationMembershipWebhookEvent) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clerkOrgId: event.data.organization.id },
    });
    const userId = event.data.public_user_data.user_id;
    const email = event.data.public_user_data.identifier?.toLowerCase();

    if (!tenant || !userId || !email) {
      return { ignored: true, reason: "membership_scope_missing", type: event.type };
    }

    const existingMember = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_clerkUserId: {
          clerkUserId: userId,
          tenantId: tenant.id,
        },
      },
    });

    if (existingMember?.status === "active") {
      return { accepted: true, reason: "already_active", type: event.type };
    }

    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { tenantId_email: { email, tenantId: tenant.id } },
    });

    if (!invitation || invitation.status === "revoked") {
      return { ignored: true, reason: "invitation_not_found", type: event.type };
    }

    await this.prisma.$transaction([
      this.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedByClerkUserId: userId,
          status: "accepted",
        },
      }),
      this.prisma.tenantUser.upsert({
        where: {
          tenantId_clerkUserId: {
            clerkUserId: userId,
            tenantId: tenant.id,
          },
        },
        create: {
          clerkUserId: userId,
          role: invitation.role as TenantRole,
          status: "active",
          tenantId: tenant.id,
        },
        update: {
          removedAt: null,
          removedByClerkUserId: null,
          role: invitation.role,
          status: "active",
        },
      }),
    ]);

    return { accepted: true, type: event.type };
  }

  private async removeDeletedUser(event: UserWebhookEvent) {
    const userId = event.data.id;

    if (!userId) {
      return { ignored: true, reason: "user_id_missing", type: event.type };
    }

    const result = await this.prisma.tenantUser.updateMany({
      where: {
        clerkUserId: userId,
        status: "active",
      },
      data: {
        removedAt: new Date(),
        removedByClerkUserId: null,
        status: "removed",
      },
    });

    return { removed: result.count, type: event.type };
  }

  private async removeMembership(event: OrganizationMembershipWebhookEvent) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clerkOrgId: event.data.organization.id },
    });
    const userId = event.data.public_user_data.user_id;

    if (!tenant || !userId) {
      return { ignored: true, reason: "membership_scope_missing", type: event.type };
    }

    const result = await this.prisma.tenantUser.updateMany({
      where: {
        clerkUserId: userId,
        status: "active",
        tenantId: tenant.id,
      },
      data: {
        removedAt: new Date(),
        removedByClerkUserId: null,
        status: "removed",
      },
    });

    return { removed: result.count, type: event.type };
  }

  private async revokeInvitation(event: OrganizationInvitationWebhookEvent) {
    const result = await this.prisma.staffInvitation.updateMany({
      where: { clerkInvitationId: event.data.id },
      data: { status: "revoked" },
    });

    return { revoked: result.count, type: event.type };
  }
}
