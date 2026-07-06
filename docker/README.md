# Docker Deployment: Zero-Vulnerability Rust Web Server

This directory contains the Docker configuration for packaging **OpenSpeedTest-Vite** as a zero-vulnerability image built `FROM scratch`, served by a custom, highly optimized asynchronous static web server written in Rust (using `axum` and `tokio`).

---

## Core Features

1. **Zero Vulnerabilities:**
   By using the minimal `scratch` base image, the container does not include an operating system, package managers (like `apk`/`apt`), shells, or dynamic C libraries. A vulnerability scan (`docker scout`) reports **0 vulnerabilities**.
2. **High Memory Efficiency:**
   The Rust web server is designed to stream incoming upload payloads (during the Upload Test) directly to a black hole without accumulating them in RAM. This keeps container memory usage stable at **<10MB** even under multi-gigabit workloads.
3. **Ultra-Lightweight Image:**
   The final compressed image size is only **10–15 MB**, containing only the statically-compiled Rust binary and the compiled frontend assets.

---

## Prerequisites

* Docker Engine v20.10 or newer.
* Docker Compose (for the compose workflow).

---

## Environment Configuration

The container accepts the following environment variable for dynamic port binding:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `HTTP_PORT` | The HTTP port the server listens on | `3000` |

---

## Running the Container

### Using Docker Compose (Recommended)
From the root of the repository, run:
```bash
docker compose up -d --build
```
The application will be accessible at `http://localhost:3000`.

### Using Docker CLI
Build the image locally:
```bash
docker build -t openspeedtest-vite:latest -f docker/Dockerfile .
```

Run the container:
```bash
docker run -d -p 3000:3000 -e HTTP_PORT=3000 --name openspeedtest openspeedtest-vite:latest
```

---

## Debugging & Container Inspection

Since this image is built `FROM scratch`, **there is no shell (`sh` or `bash`) or debugging utility inside the container**. Standard commands like `docker exec -it <container_id> sh` will not work.

To inspect files or check network states inside the running container, use the **Docker Ephemeral Debug Container** feature (requires Docker CLI v23+):

```bash
docker debug <container_name_or_id>
```

This launches a separate secure shell attached to the container's namespaces for debugging, without introducing security vulnerabilities into the production image itself.
