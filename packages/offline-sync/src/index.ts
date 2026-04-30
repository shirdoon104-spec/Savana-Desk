import type { OfflineActionStatus, TenantScope } from "@rayaan/shared";

export type OfflineEntityType =
  | "reservation"
  | "room"
  | "guest"
  | "folio"
  | "restaurant_table"
  | "order"
  | "payment";

export interface OfflineAction<TPayload = unknown> extends TenantScope {
  id: string;
  deviceId: string;
  actorUserId: string;
  entityType: OfflineEntityType;
  entityId?: string;
  actionType: string;
  payload: TPayload;
  idempotencyKey: string;
  occurredAt: string;
  status: OfflineActionStatus;
  retryCount: number;
}

export interface ConflictResult {
  hasConflict: boolean;
  reason?: string;
  resolution: "accept" | "reject" | "manual_review";
}

export function detectTimestampConflict(
  localUpdatedAt: string,
  remoteUpdatedAt?: string,
): ConflictResult {
  if (!remoteUpdatedAt) {
    return { hasConflict: false, resolution: "accept" };
  }

  if (new Date(localUpdatedAt).getTime() < new Date(remoteUpdatedAt).getTime()) {
    return {
      hasConflict: true,
      reason: "Remote record is newer than the offline action.",
      resolution: "manual_review",
    };
  }

  return { hasConflict: false, resolution: "accept" };
}
