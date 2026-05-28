import { Controller, Param, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "../tenancy/tenant-context.service";
import { KitchenEventsService } from "./kitchen-events.service";

@Controller("events")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class KitchenEventsController {
  constructor(
    private readonly kitchenEvents: KitchenEventsService,
    private readonly prisma: PrismaService,
  ) {}

  @Sse("kitchen/:restaurantId")
  @RequirePermission("restaurant.read")
  async kitchen(
    @CurrentTenant() context: TenantContext,
    @Param("restaurantId") restaurantId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.prisma.restaurant.findFirstOrThrow({
      where: {
        id: restaurantId,
        tenantId: context.tenant.id,
      },
      select: { id: true },
    });

    return this.kitchenEvents.stream(context.tenant.id, restaurantId);
  }
}
