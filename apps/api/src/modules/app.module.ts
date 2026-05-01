import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { PaymentsController } from "./payments/payments.controller";
import { PropertiesController } from "./properties/properties.controller";
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
    RestaurantsController,
    TeamController,
    TenancyController,
    PaymentsController,
    SyncController,
    ClerkWebhookController,
  ],
  providers: [
    ClerkAuthGuard,
    ClerkClientService,
    ClerkOrganizationResolver,
    ClerkWebhookService,
    TenantContextService,
    TenantPermissionGuard,
  ],
})
export class AppModule {}
