import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Request as ExpressRequest } from "express";
import { ClerkWebhookService } from "./clerk-webhook.service";

interface RawBodyRequest extends ExpressRequest {
  rawBody?: Buffer;
}

@Controller("webhooks/clerk")
export class ClerkWebhookController {
  constructor(private readonly clerkWebhooks: ClerkWebhookService) {}

  @Post()
  async handle(@Req() request: RawBodyRequest) {
    const event = await this.verify(request);

    return this.clerkWebhooks.handle(event);
  }

  private async verify(request: RawBodyRequest) {
    if (!request.rawBody) {
      throw new BadRequestException("Webhook raw body is unavailable.");
    }

    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      throw new BadRequestException("Clerk webhook signing secret is not configured.");
    }

    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      } else if (value !== undefined) {
        headers.set(key, String(value));
      }
    }

    try {
      return await verifyWebhook(
        new Request("http://localhost/api/webhooks/clerk", {
          body: request.rawBody.toString("utf8"),
          headers,
          method: "POST",
        }),
        { signingSecret },
      );
    } catch {
      throw new UnauthorizedException("Clerk webhook signature is invalid.");
    }
  }
}
