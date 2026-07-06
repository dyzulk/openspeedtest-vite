# Stage 1: Build the Vite application
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@11.9.0

WORKDIR /app

# Copy configuration files
COPY package.json pnpm-lock.yaml tsconfig.json index.html ./

# Copy source code and assets
COPY src ./src
COPY public ./public

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Stage 2: Serve the application using Nginx
FROM nginxinc/nginx-unprivileged:stable-alpine

LABEL maintainer "OpenSpeedTest-Vite"

ENV HTTP_PORT=3000
ENV CONFIG=/etc/nginx/conf.d/OpenSpeedTest-Server.conf

# Copy build files from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY docker/nginx/OpenSpeedTest-Server.conf ${CONFIG}
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Ensure permissions are correct for unprivileged user
USER root
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/nginx.key -out /etc/ssl/nginx.crt \
    -subj "/CN=localhost" && \
    chown nginx:nginx /etc/ssl/nginx.key /etc/ssl/nginx.crt && \
    chmod 600 /etc/ssl/nginx.key && \
    chmod 644 /etc/ssl/nginx.crt && \
    rm -rf /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown nginx:nginx ${CONFIG} \
    && chmod 644 ${CONFIG} \
    && chown nginx:nginx /etc/nginx/nginx.conf \
    && chmod 644 /etc/nginx/nginx.conf

USER nginx

EXPOSE ${HTTP_PORT}

CMD ["nginx", "-g", "daemon off;"]
