import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { ClerkAuthContext, RequestWithAuth } from "./clerk-auth.guard";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClerkAuthContext | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    return request.auth;
  },
);
