FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
RUN pnpm --filter @rayaan/api... build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages

EXPOSE 4000
CMD ["sh", "-c", "pnpm db:migrate:deploy && node apps/api/dist/main.js"]
