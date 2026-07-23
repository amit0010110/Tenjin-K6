FROM node:20-alpine

RUN apk add --no-cache k6

WORKDIR /app

COPY packages/worker-agent/package.json packages/worker-agent/tsconfig.json ./
COPY packages/worker-agent/src ./src
COPY packages/shared ./packages/shared
RUN npm install

EXPOSE 6566

CMD ["npx", "tsx", "src/index.ts"]
