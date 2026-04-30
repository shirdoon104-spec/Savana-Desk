import { Controller, Get } from "@nestjs/common";

@Controller("setup")
export class SetupController {
  @Get("status")
  status() {
    const clerkSecretConfigured = Boolean(process.env.CLERK_SECRET_KEY);
    const databaseConfigured = Boolean(process.env.DATABASE_URL);
    const redisConfigured = Boolean(process.env.REDIS_URL);

    return {
      api: {
        ready: clerkSecretConfigured && databaseConfigured && redisConfigured,
        clerkSecretConfigured,
        databaseConfigured,
        redisConfigured,
        webOrigin: process.env.WEB_ORIGIN ?? null,
      },
      nextSteps: [
        clerkSecretConfigured
          ? "API Clerk secret is configured."
          : "Add CLERK_SECRET_KEY to apps/api/.env.",
        databaseConfigured
          ? "Database URL is configured."
          : "Add DATABASE_URL to apps/api/.env.",
        redisConfigured
          ? "Redis URL is configured."
          : "Add REDIS_URL to apps/api/.env.",
      ],
    };
  }
}
