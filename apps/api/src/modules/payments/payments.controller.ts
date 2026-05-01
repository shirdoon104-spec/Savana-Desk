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
import { paymentProviders } from "@rayaan/shared";
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
  @RequirePermission("billing.manage")
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
  @RequirePermission("billing.manage")
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
    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (
      result.status === "paid" &&
      (verified.amount !== expectedAmount || verified.currency !== payment.currency)
    ) {
      throw new BadRequestException("Verified payment amount does not match.");
    }

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: result.status },
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
}

interface PaystackWebhookRequest extends Request {
  rawBody?: Buffer;
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

    if (!this.isValidSignature(secretKey, signature, request.rawBody, payload)) {
      throw new BadRequestException("Invalid Paystack signature.");
    }

    const provider = new PaystackProvider({ secretKey });
    const result = await provider.handleWebhook(payload);

    if (result.providerTransactionId) {
      const payment = await this.prisma.payment.findFirst({
        where: {
          provider: "paystack",
          providerTransactionId: result.providerTransactionId,
        },
      });

      if (payment) {
        const eventData = result.raw as {
          data?: { amount?: number; currency?: string };
        };
        const expectedAmount = Math.round(Number(payment.amount) * 100);

        if (
          result.status !== "paid" ||
          (eventData.data?.amount === expectedAmount &&
            eventData.data.currency === payment.currency)
        ) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: result.status },
          });
        }
      }
    }

    return { received: true };
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
