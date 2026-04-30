import { SetMetadata } from "@nestjs/common";
import type { TenantPermission } from "@rayaan/shared";

export const REQUIRED_PERMISSION_KEY = "requiredPermission";

export function RequirePermission(permission: TenantPermission) {
  return SetMetadata(REQUIRED_PERMISSION_KEY, permission);
}
