FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

RUN npm ci --workspace=packages/backend --include-workspace-root

WORKDIR /app/packages/backend

RUN npx prisma generate
RUN npx tsc

FROM node:20-alpine

WORKDIR /app

COPY --from=grafana/k6:latest /usr/bin/k6 /usr/bin/k6

COPY package.json package-lock.json ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY --from=build /app/packages/backend/dist /app/packages/backend/dist

RUN npm ci --workspace=packages/backend --include-workspace-root --production

WORKDIR /app/packages/backend

RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/index.js"]
