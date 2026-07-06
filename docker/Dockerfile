# Stage 1: Build the Vite frontend application
FROM node:22-alpine AS frontend-builder
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml tsconfig.json index.html ./
COPY src ./src
COPY public ./public
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Stage 2: Build the Rust server statically
FROM rust:alpine AS server-builder
RUN apk add --no-cache musl-dev
WORKDIR /build
COPY docker/server-rust /build
RUN cargo build --release --target x86_64-unknown-linux-musl

# Stage 3: Final zero-vulnerability image using scratch
FROM scratch

# Copy Vite frontend assets
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy statically-compiled Rust server
COPY --from=server-builder /build/target/x86_64-unknown-linux-musl/release/openspeedtest-rust /openspeedtest-rust

# Set environment variables and expose port
ENV HTTP_PORT=3000
EXPOSE 3000

# Execute Rust server
ENTRYPOINT ["/openspeedtest-rust"]
