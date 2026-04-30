import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { PaymentsController } from "./payments/payments.controller";
import { PropertiesController } from "./properties/properties.controller";
import { SetupController } from "./setup/setup.controller";
import { SyncController } from "./sync/sync.controller";
import { TeamController } from "./team/team.controller";
import { TenancyController } from "./tenancy/tenancy.controller";
import { ClerkAuthGuard } from "./auth/clerk-auth.guard";
import { ClerkOrganizationResolver } from "./auth/clerk-organization.resolver";
import { TenantPermissionGuard } from "./auth/tenant-permission.guard";
import { TenantContextService } from "./tenancy/tenant-context.service";

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
    TeamController,
    TenancyController,
    PaymentsController,
    SyncController,
  ],
  providers: [
    ClerkAuthGuard,
    ClerkOrganizationResolver,
    TenantContextService,
    TenantPermissionGuard,
  ],
})
export class AppModule {}
