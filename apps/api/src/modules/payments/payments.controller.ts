import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  ManualMobileMoneyProvider,
  PaystackProvider,
  StripeProvider,
  type PaymentProviderAdapter,
  type PaymentRequest,
  type PaymentResult,
} from "@rayaan/payments";
import { Prisma } from "@rayaan/database";
import { hasTenantPermission, paymentProviders, type TenantRole } from "@rayaan/shared";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantPermissionGuard } from "../auth/tenant-permission.guard";
import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "../tenancy/tenant-context.service";

class InitiatePaymentDto implements PaymentRequest {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsIn(["KES", "USD", "SOS"])
  currency!: "KES" | "USD" | "SOS";

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  folioId?: string;

  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  orderId?: string;

  @IsIn(paymentProviders)
  provider!: PaymentRequest["provider"];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  restaurantId?: string;

  @IsString()
  @MaxLength(128)
  propertyId!: string;

  @IsString()
  @MaxLength(128)
  tenantId!: string;
}

@Controller("payments")
@UseGuards(ClerkAuthGuard, TenantPermissionGuard)
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("initiate")
  @RequirePermission("billing.read")
  async initiate(
    @CurrentTenant() context: TenantContext,
    @Body() request: InitiatePaymentDto,
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

    if (request.orderId) {
      await this.validateRestaurantOrderPayment(context, request);
    } else if (!hasTenantPermission(context.role, "billing.manage")) {
      throw new BadRequestException("Your role cannot initiate this payment.");
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
    });

    if (existingPayment) {
      return {
        provider: existingPayment.provider,
        providerTransactionId: existingPayment.providerTransactionId,
        raw: {
          access_code: existingPayment.accessCode,
          authorization_url: existingPayment.checkoutUrl,
          reference: existingPayment.providerTransactionId,
        },
        status: existingPayment.status,
      };
    }

    const provider = this.getProvider(request.provider);
    const result = await provider.initiatePayment(request).catch((error) => {
      const message =
        error instanceof Error ? error.message : "Could not start payment.";

      throw new BadRequestException(message);
    });
    const checkout = result.raw as {
      access_code?: string;
      authorization_url?: string;
    };

    await this.prisma.payment.create({
      data: {
        accessCode: checkout.access_code,
        amount: request.amount,
        checkoutUrl: checkout.authorization_url,
        currency: request.currency,
        customerPhone: request.customerPhone,
        folioId: request.folioId,
        idempotencyKey: request.idempotencyKey,
        method: request.provider === "paystack" ? "paystack_checkout" : request.provider,
        orderId: request.orderId,
        propertyId: request.propertyId,
        provider: request.provider,
        providerTransactionId: result.providerTransactionId,
        restaurantId: request.restaurantId,
        status: result.status,
        tenantId: context.tenant.id,
      },
    });

    return result;
  }

  @Get("paystack/verify/:reference")
  @RequirePermission("billing.read")
  async verifyPaystack(
    @CurrentTenant() context: TenantContext,
    @Param("reference") reference: string,
  ): Promise<unknown> {
    const provider = this.getPaystackProvider();
    const result = await provider.checkStatus(reference);

    return this.applyPaystackResult(context.tenant.id, result);
  }

  private async applyPaystackResult(
    tenantId: string,
    result: PaymentResult,
  ): Promise<unknown> {
    const reference = result.providerTransactionId;

    if (!reference) {
      throw new BadRequestException("Paystack response is missing a reference.");
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: "paystack",
        providerTransactionId: reference,
        tenantId,
      },
    });

    if (!payment) {
      throw new BadRequestException("Payment reference was not found.");
    }

    const verified = result.raw as {
      amount?: number;
      currency?: string;
      status?: string;
    };

    if (
      result.status === "paid" &&
      (verified.currency !== payment.currency ||
        !paystackAmountMatches(verified.amount, verified.currency, payment.amount))
    ) {
      throw new BadRequestException("Verified payment amount does not match.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: result.status },
      });

      if (result.status === "paid") {
        if (payment.orderId && payment.restaurantId) {
          const order = await tx.order.findFirst({
            where: {
              id: payment.orderId,
              propertyId: payment.propertyId,
              restaurantId: payment.restaurantId,
              tenantId: payment.tenantId,
            },
          });

          if (order) {
            await tx.orderPayment.upsert({
              where: {
                tenantId_method_reference: {
                  method: "paystack",
                  reference,
                  tenantId: payment.tenantId,
                },
              },
              create: {
                amount: payment.amount,
                currency: payment.currency,
                metadata: toPrismaJson({
                  provider: "paystack",
                  providerTransactionId: reference,
                  verified,
                }),
                method: "paystack",
                orderId: order.id,
                paidAt: new Date(),
                propertyId: order.propertyId,
                reference,
                restaurantId: order.restaurantId,
                status: "confirmed",
                tenantId: order.tenantId,
              },
              update: {
                metadata: toPrismaJson({
                  provider: "paystack",
                  providerTransactionId: reference,
                  verified,
                }),
                paidAt: new Date(),
                status: "confirmed",
              },
            });
          }
        }

        await closeRestaurantOrderForPayment(tx, {
          orderId: payment.orderId,
          tenantId: payment.tenantId,
        });
      }

      return updatedPayment;
    });
  }

  private getProvider(provider: PaymentRequest["provider"]): PaymentProviderAdapter {
    if (provider === "paystack") {
      return this.getPaystackProvider();
    }

    if (provider === "stripe") {
      return new StripeProvider();
    }

    return new ManualMobileMoneyProvider();
  }

  private getPaystackProvider() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new ServiceUnavailableException("PAYSTACK_SECRET_KEY is not configured.");
    }

    return new PaystackProvider({
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
      secretKey,
    });
  }

  private async validateRestaurantOrderPayment(
    context: TenantContext,
    request: InitiatePaymentDto,
  ) {
    if (!canTakeRestaurantPayment(context.role)) {
      throw new BadRequestException("Your role cannot take restaurant payments.");
    }

    if (!request.restaurantId) {
      throw new BadRequestException("Restaurant order payments require a restaurant.");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: request.orderId,
        propertyId: request.propertyId,
        restaurantId: request.restaurantId,
        tenantId: context.tenant.id,
      },
    });

    if (!order) {
      throw new BadRequestException("Order was not found for this restaurant.");
    }

    if (["closed", "cancelled"].includes(order.status)) {
      throw new BadRequestException("This order is already final.");
    }

    if (order.currency !== request.currency) {
      throw new BadRequestException("Payment currency does not match the order.");
    }

    if (toSubunitAmount(Number(order.totalAmount)) !== toSubunitAmount(request.amount)) {
      throw new BadRequestException("Payment amount does not match the order.");
    }
  }
}

function toSubunitAmount(amount: number) {
  return Math.round(amount * 100);
}

function canTakeRestaurantPayment(role: TenantRole) {
  return [
    "owner",
    "admin",
    "restaurant_manager",
    "waiter",
    "accountant",
    "front_desk",
  ].includes(role);
}

interface PaystackWebhookRequest extends Request {
  rawBody?: Buffer;
}

interface PaystackVerifiedTransaction {
  amount?: number;
  currency?: string;
  metadata?: unknown;
  reference?: string;
  status?: string;
}

@Controller("payments/webhooks/paystack")
export class PaystackWebhookController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async handlePaystackWebhook(
    @Headers("x-paystack-signature") signature: string | undefined,
    @Req() request: PaystackWebhookRequest,
    @Body() payload: unknown,
  ) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new ServiceUnavailableException("PAYSTACK_SECRET_KEY is not configured.");
    }

    const reference = extractPaystackReference(payload);

    if (!this.isValidSignature(secretKey, signature, request.rawBody, payload)) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason: "invalid_signature",
      });
      throw new BadRequestException("Invalid Paystack signature.");
    }

    if (!reference) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        rejectionReason: "missing_reference",
      });
      throw new BadRequestException("Paystack webhook is missing a reference.");
    }

    const provider = new PaystackProvider({ secretKey });

    let result: PaymentResult;

    try {
      result = await provider.checkStatus(reference);
    } catch (error) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason:
          error instanceof Error ? `paystack_verify_failed: ${error.message}` : "paystack_verify_failed",
      });
      throw new BadRequestException("Could not verify Paystack transaction.");
    }

    const verified = result.raw as PaystackVerifiedTransaction;
    const verifiedReference = result.providerTransactionId ?? verified.reference;

    if (verifiedReference !== reference) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason: "verified_reference_mismatch",
      });
      throw new BadRequestException("Verified Paystack reference does not match.");
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: "paystack",
        providerTransactionId: reference,
      },
    });

    if (!payment || !payment.orderId || !payment.restaurantId) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason: "payment_or_order_not_found",
      });
      throw new BadRequestException("Payment reference was not found.");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: payment.orderId,
        propertyId: payment.propertyId,
        restaurantId: payment.restaurantId,
        tenantId: payment.tenantId,
      },
    });

    if (!order) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason: "order_scope_not_found",
        scope: payment,
      });
      throw new BadRequestException("Order was not found for this payment.");
    }

    const metadata = readPaystackMetadata(verified.metadata);
    const rejectionReason = validatePaystackVerifiedTransaction({
      metadata,
      order,
      payment,
      result,
      verified,
    });

    if (rejectionReason) {
      await this.logWebhookAttempt({
        outcome: "rejected",
        payload,
        reference,
        rejectionReason,
        scope: payment,
      });
      throw new BadRequestException("Paystack transaction verification failed.");
    }

    const existingLedgerPayment = await this.prisma.orderPayment.findFirst({
      where: {
        method: "paystack",
        reference,
        status: "confirmed",
        tenantId: payment.tenantId,
      },
    });

    if (existingLedgerPayment) {
      await this.logWebhookAttempt({
        outcome: "duplicate",
        payload,
        reference,
        scope: payment,
        verifiedAt: new Date(),
      });

      return { outcome: "duplicate", received: true };
    }

    if (payment.status === "paid" || order.status === "closed") {
      await this.logWebhookAttempt({
        outcome: "duplicate",
        payload,
        reference,
        scope: payment,
        verifiedAt: new Date(),
      });

      return { outcome: "duplicate", received: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "paid" },
      });

      await tx.orderPayment.upsert({
        where: {
          tenantId_method_reference: {
            method: "paystack",
            reference,
            tenantId: payment.tenantId,
          },
        },
        create: {
          amount: payment.amount,
          currency: payment.currency,
          metadata: toPrismaJson({
            provider: "paystack",
            providerTransactionId: reference,
            verified,
          }),
          method: "paystack",
          orderId: order.id,
          paidAt: new Date(),
          propertyId: order.propertyId,
          reference,
          restaurantId: order.restaurantId,
          status: "confirmed",
          tenantId: order.tenantId,
        },
        update: {
          metadata: toPrismaJson({
            provider: "paystack",
            providerTransactionId: reference,
            verified,
          }),
          paidAt: new Date(),
          status: "confirmed",
        },
      });

      await closeRestaurantOrderForPayment(tx, {
        orderId: payment.orderId,
        tenantId: payment.tenantId,
      });

      await tx.paymentWebhookLog.create({
        data: {
          orderId: payment.orderId,
          payload: toPrismaJson(payload),
          propertyId: payment.propertyId,
          provider: "paystack",
          reference,
          restaurantId: payment.restaurantId,
          tenantId: payment.tenantId,
          outcome: "success",
          verifiedAt: new Date(),
        },
      });
    });

    return { outcome: "success", received: true };
  }

  private async logWebhookAttempt(input: {
    outcome: "success" | "rejected" | "duplicate";
    payload: unknown;
    reference?: string;
    rejectionReason?: string;
    scope?: {
      orderId: string | null;
      propertyId: string;
      restaurantId: string | null;
      tenantId: string;
    };
    verifiedAt?: Date;
  }) {
    await this.prisma.paymentWebhookLog.create({
      data: {
        orderId: input.scope?.orderId,
        payload: toPrismaJson(input.payload),
        propertyId: input.scope?.propertyId,
        provider: "paystack",
        reference: input.reference,
        rejectionReason: input.rejectionReason,
        restaurantId: input.scope?.restaurantId,
        tenantId: input.scope?.tenantId,
        outcome: input.outcome,
        verifiedAt: input.verifiedAt,
      },
    });
  }

  private isValidSignature(
    secretKey: string,
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: unknown,
  ) {
    if (!signature) {
      return false;
    }

    const body = rawBody ?? Buffer.from(JSON.stringify(payload));
    const expected = createHmac("sha512", secretKey).update(body).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    return (
      expectedBuffer.length === signatureBuffer.length &&
      timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  }
}

function extractPaystackReference(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const event = payload as { data?: { reference?: unknown } };

  return typeof event.data?.reference === "string" ? event.data.reference : undefined;
}

function readPaystackMetadata(metadata: unknown): Record<string, string> {
  if (typeof metadata === "string") {
    try {
      return readPaystackMetadata(JSON.parse(metadata));
    } catch {
      return {};
    }
  }

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      )
      .map(([key, value]) => [key, String(value)]),
  );
}

function validatePaystackVerifiedTransaction(input: {
  metadata: Record<string, string>;
  order: {
    id: string;
    tenantId: string;
    propertyId: string;
    restaurantId: string;
    totalAmount: Prisma.Decimal;
    currency: string;
  };
  payment: {
    tenantId: string;
    propertyId: string;
    restaurantId: string | null;
    orderId: string | null;
    amount: Prisma.Decimal;
    currency: string;
  };
  result: PaymentResult;
  verified: PaystackVerifiedTransaction;
}) {
  const { metadata, order, payment, result, verified } = input;

  if (result.status !== "paid" || verified.status !== "success") {
    return "paystack_status_not_success";
  }

  if (
    payment.tenantId !== order.tenantId ||
    payment.propertyId !== order.propertyId ||
    payment.restaurantId !== order.restaurantId ||
    payment.orderId !== order.id
  ) {
    return "stored_payment_order_scope_mismatch";
  }

  if (verified.currency !== payment.currency || verified.currency !== order.currency) {
    return "currency_mismatch";
  }

  if (!paystackAmountMatches(verified.amount, verified.currency, payment.amount)) {
    return "payment_amount_mismatch";
  }

  if (!paystackAmountMatches(verified.amount, verified.currency, order.totalAmount)) {
    return "order_amount_mismatch";
  }

  if (metadata.orderId !== order.id) {
    return "metadata_order_mismatch";
  }

  if (metadata.tenantId !== order.tenantId) {
    return "metadata_tenant_mismatch";
  }

  if (metadata.propertyId !== order.propertyId) {
    return "metadata_property_mismatch";
  }

  if (metadata.restaurantId !== order.restaurantId) {
    return "metadata_restaurant_mismatch";
  }

  return undefined;
}

function paystackAmountMatches(
  verifiedMinorUnitAmount: number | undefined,
  currency: string | undefined,
  expectedMajorUnitAmount: Prisma.Decimal.Value,
) {
  if (
    typeof verifiedMinorUnitAmount !== "number" ||
    !Number.isFinite(verifiedMinorUnitAmount) ||
    !currency
  ) {
    return false;
  }

  const verifiedMajorUnitAmount = new Prisma.Decimal(verifiedMinorUnitAmount).div(
    currencyMinorUnitFactor(currency),
  );

  return verifiedMajorUnitAmount.equals(expectedMajorUnitAmount);
}

function currencyMinorUnitFactor(currency: string) {
  return new Prisma.Decimal(10).pow(currencyMinorUnitExponent(currency));
}

function currencyMinorUnitExponent(currency: string) {
  const exponents: Record<string, number> = {
    KES: 2,
    SOS: 2,
    USD: 2,
  };

  return exponents[currency] ?? 2;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

async function closeRestaurantOrderForPayment(
  tx: {
    order: Pick<PrismaService["order"], "findFirst" | "update">;
    restaurantTable: Pick<PrismaService["restaurantTable"], "update">;
  },
  payment: { orderId: string | null; tenantId: string },
) {
  if (!payment.orderId) {
    return;
  }

  const order = await tx.order.findFirst({
    where: {
      id: payment.orderId,
      tenantId: payment.tenantId,
    },
  });

  if (!order || ["closed", "cancelled"].includes(order.status)) {
    return;
  }

  await tx.order.update({
    where: { id: order.id },
    data: { status: "closed" },
  });

  if (order.tableId) {
    await tx.restaurantTable.update({
      where: { id: order.tableId },
      data: { status: "cleaning" },
    });
  }
}
