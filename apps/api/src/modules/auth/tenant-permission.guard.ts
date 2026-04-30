import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasTenantPermission, type TenantPermission } from "@rayaan/shared";
import type { RequestWithAuth } from "./clerk-auth.guard";
import { REQUIRED_PERMISSION_KEY } from "./require-permission.decorator";
import type { RequestWithTenant } from "./current-tenant.decorator";
import { TenantContextService } from "../tenancy/tenant-context.service";

@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuth & RequestWithTenant>();
    const auth = request.auth;

    if (!auth) {
      throw new UnauthorizedException("Missing authenticated Clerk context.");
    }

    const resolvedTenant = await this.tenantContext.resolve(auth);

    if (!resolvedTenant) {
      throw new ForbiddenException("User is not a member of this tenant.");
    }

    request.tenantContext = resolvedTenant;

    const permission = this.reflector.getAllAndOverride<TenantPermission>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) {
      return true;
    }

    if (!hasTenantPermission(resolvedTenant.role, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return true;
  }
}
