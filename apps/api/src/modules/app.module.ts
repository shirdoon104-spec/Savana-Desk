import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module";
import { KitchenEventsController } from "./events/kitchen-events.controller";
import { KitchenEventsService } from "./events/kitchen-events.service";
import { FoliosController } from "./folios/folios.controller";
import { HealthController } from "./health/health.controller";
import { IdempotencyInterceptor } from "./idempotency/idempotency.interceptor";
import { IdempotencyService } from "./idempotency/idempotency.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import {
  PaymentsController,
  PaystackWebhookController,
} from "./payments/payments.controller";
import { PropertiesController } from "./properties/properties.controller";
import { PublicMenuController } from "./restaurants/public-menu.controller";
import { RestaurantsController } from "./restaurants/restaurants.controller";
import { SetupController } from "./setup/setup.controller";
import { SyncController } from "./sync/sync.controller";
import { TeamController } from "./team/team.controller";
import { TenancyController } from "./tenancy/tenancy.controller";
import { ClerkAuthGuard } from "./auth/clerk-auth.guard";
import { ClerkClientService } from "./auth/clerk-client.service";
import { ClerkOrganizationResolver } from "./auth/clerk-organization.resolver";
import { TenantPermissionGuard } from "./auth/tenant-permission.guard";
import { TenantContextService } from "./tenancy/tenant-context.service";
import { ClerkWebhookController } from "./webhooks/clerk-webhook.controller";
import { ClerkWebhookService } from "./webhooks/clerk-webhook.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  controllers: [
    HealthController,
    OnboardingController,
    SetupController,
    PropertiesController,
    PublicMenuController,
    RestaurantsController,
    TeamController,
    TenancyController,
    PaymentsController,
    PaystackWebhookController,
    SyncController,
    ClerkWebhookController,
    FoliosController,
    KitchenEventsController,
  ],
  providers: [
    ClerkAuthGuard,
    ClerkClientService,
    ClerkOrganizationResolver,
    ClerkWebhookService,
    IdempotencyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    KitchenEventsService,
    TenantContextService,
    TenantPermissionGuard,
  ],
})
export class AppModule {}
