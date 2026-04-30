import { Controller, Get } from "@nestjs/common";

@Controller("setup")
export class SetupController {
  @Get("status")
  status() {
    const clerkSecretConfigured = Boolean(process.env.CLERK_SECRET_KEY);
    const databaseConfigured = Boolean(process.env.DATABASE_URL);
    const redisConfigured = Boolean(process.env.REDIS_URL);
    const ready = clerkSecretConfigured && databaseConfigured && redisConfigured;

    return {
      api: {
        ready,
      },
      nextSteps: [
        ready
          ? "API setup is ready."
          : "API setup is incomplete. Check local environment files.",
      ],
    };
  }
}
