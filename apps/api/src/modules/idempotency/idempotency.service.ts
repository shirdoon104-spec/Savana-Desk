import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@rayaan/database";
import { PrismaService } from "../database/prisma.service";

interface IdempotencyOptions<TResponse> {
  actorId: string;
  body: unknown;
  handler: () => Promise<TResponse>;
  key?: string;
  route: string;
  tenantId: string;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<TResponse>({
    actorId,
    body,
    handler,
    key,
    route,
    tenantId,
  }: IdempotencyOptions<TResponse>): Promise<TResponse> {
    const normalizedKey = key?.trim();

    if (!normalizedKey) {
      return handler();
    }

    if (normalizedKey.length > 160) {
      throw new BadRequestException("Idempotency key is too long.");
    }

    const requestHash = hashRequest({ body, route });
    const now = new Date();
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_key: {
          key: normalizedKey,
          tenantId,
        },
      },
    });

    if (existing && existing.expiresAt > now) {
      if (existing.requestHash !== requestHash) {
        throw new BadRequestException(
          "Idempotency key was reused for a different request.",
        );
      }

      return existing.responseBody as TResponse;
    }

    if (existing) {
      await this.prisma.idempotencyRecord.delete({
        where: { id: existing.id },
      });
    }

    const response = await handler();

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          actorId,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          key: normalizedKey,
          requestHash,
          responseBody: toPrismaJson(response),
          responseStatus: 200,
          route,
          tenantId,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await this.prisma.idempotencyRecord.findUnique({
        where: {
          tenantId_key: {
            key: normalizedKey,
            tenantId,
          },
        },
      });

      if (!winner || winner.requestHash !== requestHash) {
        throw new BadRequestException(
          "Idempotency key was reused for a different request.",
        );
      }

      return winner.responseBody as TResponse;
    }

    await this.pruneExpired(tenantId);

    return response;
  }

  private async pruneExpired(tenantId: string) {
    await this.prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        tenantId,
      },
    });
  }
}

function hashRequest(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
