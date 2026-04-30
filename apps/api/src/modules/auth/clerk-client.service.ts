import { BadRequestException, Injectable } from "@nestjs/common";
import { createClerkClient } from "@clerk/backend";

type ClerkClient = ReturnType<typeof createClerkClient>;

@Injectable()
export class ClerkClientService {
  private client: ClerkClient | null = null;

  getClient() {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new BadRequestException("Clerk secret key is not configured.");
    }

    this.client ??= createClerkClient({ secretKey });

    return this.client;
  }

  getOptionalClient() {
    return process.env.CLERK_SECRET_KEY ? this.getClient() : null;
  }
}
