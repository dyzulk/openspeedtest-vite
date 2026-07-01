# OpenSpeedTest -- Vite + TypeScript Edition

A modernized, fully typed rewrite of [OpenSpeedTest](https://openspeedtest.com) using **Vite**, **TypeScript**, and **ES Modules**. This project preserves all the core functionality of the original -- download, upload, and latency testing directly in the browser -- while delivering a cleaner architecture, better developer experience, and improved runtime performance.

> **Based on** [OpenSpeedTest/Speed-Test](https://github.com/openspeedtest/Speed-Test) (MIT License).

---

## Why This Fork?

The original OpenSpeedTest is a proven, battle-tested speed testing tool written in ES5 vanilla JavaScript. This modernization brings it into the current era without changing what made it great:

| Original (ES5) | Modernized (Vite + TS) |
|---|---|
| Single monolithic `app-2.5.4.js` (800+ lines) | Modular components with clear separation of concerns |
| Global variables and implicit types | Strong TypeScript typing with zero `any` usage |
| External SVG loaded via `<object>` tag (extra HTTP request) | Inline SVG injection via Vite raw import (`?raw`) |
| Separate `app.css` + `darkmode.css` | Unified `style.css` with CSS Custom Properties |
| Nested callbacks for network operations | `async`/`await` with Promise-based engines |
| `setInterval` animation loops | `requestAnimationFrame` for smoother gauge animations |

---

## Architecture

```
openspeedtest-vite/
|-- public/                         Static assets served at root
|   |-- favicon.ico
|   |-- site.webmanifest
|   |-- browserconfig.xml
|   `-- images/icons/               Favicons and launcher icons
|-- src/
|   |-- assets/
|   |   |-- fonts/                  Roboto woff2/woff (self-hosted)
|   |   `-- images/
|   |       `-- app.svg             Main UI gauge (inlined at build)
|   |-- components/
|   |   |-- UIController.ts         DOM manipulation, gauge animation, fade transitions
|   |   |-- ChartPlotter.ts         SVG polygon chart rendering
|   |   `-- NetworkEngine/
|   |       |-- LatencyEngine.ts    Ping and jitter measurement
|   |       |-- DownloadEngine.ts   Parallel XHR download threads
|   |       `-- UploadEngine.ts     Parallel XHR upload threads
|   |-- utils/
|   |   |-- config.ts               URL parameter parsing and validation
|   |   `-- speedMath.ts            Average speed tracker and random blob generator
|   |-- main.ts                     Application entry point and test orchestrator
|   `-- style.css                   Unified CSS with variables and dark mode
|-- index.html                      HTML shell with SEO metadata
|-- package.json
|-- tsconfig.json
`-- LICENSE
```

### Component Responsibilities

- **`main.ts`** -- Bootstraps the application, injects the SVG into the DOM, and runs the state machine: Ping -> Download -> Upload -> Results.
- **`UIController`** -- Strongly typed class managing all SVG DOM references, gauge needle rotation (nonlinear degree mapping), progress bars, fade transitions, and live speed display.
- **`ChartPlotter`** -- Standalone class that accumulates speed data points and renders SVG polygon charts for download and upload graphs.
- **`LatencyEngine`** -- Measures round-trip latency across configured servers, selects the best one, and calculates jitter from sequential ping samples.
- **`DownloadEngine`** / **`UploadEngine`** -- Spawn parallel XHR threads (default 6) to saturate the connection and report real-time throughput via callbacks.
- **`config.ts`** -- Parses URL query parameters into a typed `SpeedTestConfig` interface with validation and defaults.
- **`speedMath.ts`** -- Provides `AvgSpeedTracker` (windowed average calculation) and `generateRandomBlob` (cryptographic random `Uint32Array` for upload payloads).

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** (recommended) or npm

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Opens a local Vite dev server with hot module replacement.

### Build for Production

```bash
pnpm build
```

Outputs optimized static files to `dist/`. TypeScript is type-checked before bundling.

### Preview Production Build

```bash
pnpm preview
```

Or serve on a specific host and port:

```bash
pnpm preview:host          # --host 0.0.0.0
pnpm preview:80            # --host 0.0.0.0 --port 80
```

---

## Server Requirements

To host your own speed test, you need any web server that supports HTTP/1.1 or newer. The application is fully static -- no server-side runtime is required.

**Requirements:**

- Accept `GET`, `POST`, `HEAD`, and `OPTIONS` requests, responding with `200 OK`.
- Accept `POST` to the `/upload` endpoint, responding with `200 OK`.
- Set `client_max_body_size` to **35 MB** or more.
- Set request timeout to **60 seconds** or more.
- Disable access logs for the download/upload endpoints to improve throughput.
- Optimize **Time to First Byte** (TTFB).

**Recommendations:**

- Use `HTTP/1.1` for maximum throughput during speed tests (`HTTP/2` multiplexing can limit per-stream bandwidth measurement).
- If running behind a **reverse proxy**, ensure the proxy allows POST bodies of at least 35 MB.
- Follow the [OpenSpeedTest Nginx Configuration](https://github.com/openspeedtest/Nginx-Configuration) for a production-ready setup.
- Provide a `downloading` endpoint that serves a ~30 MB static file.
- Provide an `upload` endpoint that accepts and discards POST data.

---

## URL Query Parameters

All parameters are case-insensitive. They allow customizing test behavior without modifying source code.

| Parameter | Alias | Default | Description |
|---|---|---|---|
| `ping` | `p` | `10` | Number of ping samples to collect |
| `out` | `o` | `5000` | Ping timeout in milliseconds |
| `xhr` | `x` | `6` | Number of parallel XHR threads (1--32) for download and upload |
| `host` | `h` | (self) | Custom server URL (must be a valid HTTP URL) |
| `stress` | `s` | `12` | Test duration. Presets: `low` (5m), `medium` (10m), `high` (15m), `veryhigh` (30m), `extreme` (1h), `day` (24h), `year`. Or a custom number in seconds |
| `clean` | `c` | `4` | Overhead compensation percentage (1--4). Set to `0` to disable |
| `test` | `t` | `All` | Run only a specific test: `download`, `upload`, or `ping` |
| `run` | `r` | (disabled) | Auto-start the test. `0` = immediate, `N` = delay N seconds before starting |

**Examples:**

```
https://your-server.com/?run=0
https://your-server.com/?test=download&xhr=4&stress=medium
https://your-server.com/?host=https://speedtest.example.com&p=20
```

---

## Configuration & Customization (Vite Edition)

This modernized version separates configuration into default settings defined in the source code and dynamic parameters parsed from the URL bar.

### 1. Modifying Defaults (In-Code)

You can customize permanent default values by editing the `DEFAULT_CONFIG` object in [src/utils/config.ts](file:///src/utils/config.ts):

*   **`openSpeedTestServerList`**: List of server URLs.
*   **`saveData`**: Set to `true` to save results.
*   **`saveDataURL`**: Endpoint for saving results.
*   **`pingSamples`**: Number of ping samples.
*   **`pingTimeOut`**: Latency check timeout (ms).
*   **`dlDuration` / `ulDuration`**: Test duration (seconds).
*   **`dlThreads` / `ulThreads`**: Number of parallel threads.

### 2. Master Switches

For security or policy compliance, you can lock down user customizations by setting the following boolean flags in `DEFAULT_CONFIG` to `false`:

*   **`setHTTPReq`**: If `false`, disables custom thread overrides (`xhr`/`x`).
*   **`selectServer`**: If `false`, disables custom host overrides (`host`/`h`).
*   **`stressTest`**: If `false`, disables custom stress testing (`stress`/`s`).
*   **`enableClean`**: If `false`, disables custom overhead compensation (`clean`/`c`).
*   **`setPingSamples`**: If `false`, disables custom ping sample overrides (`ping`/`p`).
*   **`setPingTimeout`**: If `false`, disables custom ping timeout overrides (`out`/`o`).

### 3. Docker Environment Variables

> [!WARNING]
> This repository is a static frontend-only project and **does not contain any Docker files** (no `Dockerfile` or `docker-compose.yml`).
> Any environment variables mentioned in the original README (e.g., `ENABLE_LETSENCRYPT`, `HTTP_PORT`, `SET_SERVER_NAME`) are processed externally by the Nginx container wrapper in the official OpenSpeedTest Docker image, not by this codebase.

---

## Styling and Theming

The application uses CSS Custom Properties defined in `src/style.css`. Dark mode activates automatically via `prefers-color-scheme: dark`, or manually by adding the `dark-theme` class to the root element.

The entire UI is rendered as an inline SVG, making it resolution-independent and instantly available without additional HTTP requests.

Self-hosted Roboto fonts (regular 400 and medium 500 weights) are included as `woff2` and `woff` formats with `font-display: swap` for optimal loading.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (ES2023 target) |
| Bundler | Vite 8 |
| Package Manager | pnpm 11 |
| Styling | Vanilla CSS with Custom Properties |
| Fonts | Self-hosted Roboto (woff2/woff) |
| UI Rendering | Inline SVG |
| Network I/O | XMLHttpRequest (parallel threads) |
| Animations | `requestAnimationFrame` |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-change`.
3. Make your changes and ensure `pnpm build` passes cleanly.
4. Submit a pull request with a clear description of your changes.

---

## License

This project is licensed under the [MIT License](LICENSE).

Based on [OpenSpeedTest](https://github.com/openspeedtest/Speed-Test) -- Copyright 2013-2026 OpenSpeedTest. All Rights Reserved.
