import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { OfflineAction } from "@rayaan/offline-sync";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import type { TenantContext } from "../tenancy/tenant-context.service";

@Controller("sync")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class SyncController {
  @Post("actions")
  @RequirePermission("tenant.read")
  enqueue(
    @CurrentTenant() context: TenantContext,
    @Body() actions: OfflineAction[],
  ) {
    if (!Array.isArray(actions)) {
      throw new BadRequestException("Offline actions must be an array.");
    }

    if (actions.length > 100) {
      throw new BadRequestException("Submit 100 offline actions or fewer at a time.");
    }

    for (const action of actions) {
      if (
        !action?.id ||
        !action.idempotencyKey ||
        action.tenantId !== context.tenant.id ||
        action.actorUserId !== context.tenantUser.clerkUserId
      ) {
        throw new BadRequestException("Offline action scope is invalid.");
      }
    }

    return {
      accepted: actions.map((action) => ({
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        status: "accepted",
      })),
      note: "Persist actions and apply conflict rules in the implementation phase.",
    };
  }
}
