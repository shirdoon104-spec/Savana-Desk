import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { TenantContext } from "../tenancy/tenant-context.service";

export interface RequestWithTenant extends Request {
  tenantContext?: TenantContext;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    return request.tenantContext;
  },
);
