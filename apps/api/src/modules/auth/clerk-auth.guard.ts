import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import type { Request } from "express";

export interface ClerkAuthContext {
  userId: string;
  sessionId?: string;
  orgId?: string;
  orgRole?: string;
  orgSlug?: string;
  claims: Record<string, unknown>;
}

export interface RequestWithAuth extends Request {
  auth?: ClerkAuthContext;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new ServiceUnavailableException(
        "CLERK_SECRET_KEY is not configured for the API.",
      );
    }

    try {
      const verified = await verifyToken(token, { secretKey });
      const claims = verified as Record<string, unknown>;
      const userId = this.getStringClaim(claims, "sub");

      if (!userId) {
        throw new UnauthorizedException("Clerk token is missing user subject.");
      }

      request.auth = {
        userId,
        sessionId: this.getStringClaim(claims, "sid"),
        orgId: this.getStringClaim(claims, "org_id"),
        orgRole: this.getStringClaim(claims, "org_role"),
        orgSlug: this.getStringClaim(claims, "org_slug"),
        claims,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid Clerk token.");
    }
  }

  private getBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      const token = request.query.access_token;
      return typeof token === "string" ? token.trim() : undefined;
    }

    return header.slice("Bearer ".length).trim();
  }

  private getStringClaim(
    claims: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = claims[key];
    return typeof value === "string" ? value : undefined;
  }
}
