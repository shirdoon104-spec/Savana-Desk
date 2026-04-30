import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ManualMobileMoneyProvider,
  StripeProvider,
  type PaymentRequest,
} from "@rayaan/payments";
import { paymentProviders } from "@rayaan/shared";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import type { TenantContext } from "../tenancy/tenant-context.service";

@Controller("payments")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class PaymentsController {
  @Post("initiate")
  @RequirePermission("billing.manage")
  async initiate(
    @CurrentTenant() context: TenantContext,
    @Body() request: PaymentRequest,
  ) {
    if (request.tenantId !== context.tenant.id) {
      throw new BadRequestException("Payment tenant scope is invalid.");
    }

    if (!paymentProviders.includes(request.provider)) {
      throw new BadRequestException("Choose a supported payment provider.");
    }

    if (
      !request.idempotencyKey ||
      request.idempotencyKey.length < 12 ||
      request.idempotencyKey.length > 128
    ) {
      throw new BadRequestException("Payment idempotency key is invalid.");
    }

    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new BadRequestException("Payment amount must be greater than zero.");
    }

    const provider =
      request.provider === "stripe"
        ? new StripeProvider()
        : new ManualMobileMoneyProvider();

    return provider.initiatePayment(request);
  }
}
