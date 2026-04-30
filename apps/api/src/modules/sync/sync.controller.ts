import { Body, Controller, Post } from "@nestjs/common";
import type { OfflineAction } from "@rayaan/offline-sync";

@Controller("sync")
export class SyncController {
  @Post("actions")
  enqueue(@Body() actions: OfflineAction[]) {
    return {
      accepted: actions.map((action) => ({
        id: action.id,
        idempotencyKey: action.idempotencyKey,
        status: "accepted",
      })),
      note: "Persist actions and apply conflict rules in the implementation phase.",
    };
  }
}
