import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { from, lastValueFrom } from "rxjs";
import type { RequestWithTenant } from "../auth/current-tenant.decorator";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<Request & RequestWithTenant>();
    const key = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(key) ? key[0] : key;
    const tenantContext = request.tenantContext;

    if (
      !tenantContext ||
      !idempotencyKey ||
      !["POST", "PATCH", "DELETE"].includes(request.method)
    ) {
      return next.handle();
    }

    return from(
      this.idempotency.run({
        actorId: tenantContext.tenantUser.id,
        body: {
          body: request.body,
          params: request.params,
          query: request.query,
        },
        handler: () => lastValueFrom(next.handle()),
        key: idempotencyKey,
        route: `${request.method} ${request.baseUrl}${request.route?.path ?? request.path}`,
        tenantId: tenantContext.tenant.id,
      }),
    );
  }
}
