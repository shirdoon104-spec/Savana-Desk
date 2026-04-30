import { Injectable } from "@nestjs/common";
import { createClerkClient } from "@clerk/backend";
import type { ClerkAuthContext } from "./clerk-auth.guard";

export interface ResolvedClerkOrganization {
  orgId?: string;
  orgRole?: string;
  orgSlug?: string;
}

@Injectable()
export class ClerkOrganizationResolver {
  async resolve(auth: ClerkAuthContext): Promise<ResolvedClerkOrganization> {
    if (auth.orgId) {
      return {
        orgId: auth.orgId,
        orgRole: auth.orgRole,
        orgSlug: auth.orgSlug,
      };
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      return {};
    }

    const clerk = createClerkClient({ secretKey });
    const memberships =
      await clerk.organizations.getInstanceOrganizationMembershipList({
        limit: 100,
      });
    const membership = memberships.data.find(
      (item) => item.publicUserData?.userId === auth.userId,
    );

    return {
      orgId: membership?.organization.id,
      orgRole: membership?.role,
      orgSlug: membership?.organization.slug ?? undefined,
    };
  }
}
