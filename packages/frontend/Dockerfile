FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/ packages/shared/
COPY packages/frontend/ packages/frontend/

RUN npm ci --workspace=packages/frontend --include-workspace-root

WORKDIR /app/packages/frontend

RUN npx vite build

FROM nginx:alpine

COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html

COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files \$uri /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
