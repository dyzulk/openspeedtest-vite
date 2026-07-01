# OpenSpeedTest Vite Modernization - Workspace Rules & Architecture

This document defines the project rules, Developer Experience (DX) standards, target file tree structure, and asset migration strategy for porting OpenSpeedTest from ES5/vanilla JS to modern TypeScript + Vite.

## Workspace Rules

### 1. No Emojis Rule
*   Do not use emojis under any circumstances in the codebase, comments, logs, commit messages, documentation, or any other files.

### 2. TypeScript & Modern Code Standards
*   **ES Modules:** Avoid global variables. Use the ES Modules `import`/`export` system.
*   **Strong Typing:** Avoid using `any`. Every DOM element accessed must be explicitly typed (e.g., `document.getElementById('id') as SVGElement`).
*   **Asynchronous:** Use `async`/`await` for network operations instead of nested callbacks.
*   **Separation of Concerns:** Separate visual logic (UI), mathematical calculations (Math), and network logic (Network).

### 3. SVG UI Integration
*   Instead of loading `app.svg` using an external `<object>` element which triggers additional HTTP requests and delay, import the SVG file inline using Vite's raw loader:
    ```typescript
    import appSvgRaw from './assets/images/app.svg?raw';
    ```
    Then inject it directly into the root element `#app` at initialization so SVG DOM manipulation can be performed synchronously and safely.

### 4. Modern CSS & Variables
*   Use CSS Custom Properties (CSS variables) for colors and themes.
*   Combine `app.css` and `darkmode.css` into a single unified `src/style.css` file with a `@media (prefers-color-scheme: dark)` media query or a class-based theme switcher.

---

## File Tree Illustration

Here is the target file structure after the migration is complete compared to the original/reference files:

```
openspeedtest-vite/
├── .agents/
│   └── AGENTS.md                          <-- This rules file
├── references/                            <-- External References (Git Submodules)
│   ├── openspeedtest-docker-ref/          <-- Official Docker repository
│   └── openspeedtest-ref/                 <-- Official Speed-Test repository
│       ├── index.html
│       └── assets/
│           ├── css/
│           │   ├── app.css
│           │   └── darkmode.css
│           ├── fonts/
│           │   └── roboto-v30-latin-...
│           ├── images/
│           │   ├── app.svg
│           │   └── icons/
│           └── js/
│               ├── app-2.5.4.js
│               └── darkmode.js
├── public/                                <-- Static Assets for Root Server
│   ├── browserconfig.xml
│   ├── favicon.ico
│   ├── site.webmanifest
│   └── images/
│       └── icons/                         <-- Favicons & Launcher Icons
├── src/                                   <-- Modern Source Code (Vite + TS)
│   ├── assets/
│   │   ├── fonts/                         <-- Migrated Roboto Fonts
│   │   └── images/
│   │       └── app.svg                    <-- Migrated Main UI SVG
│   ├── components/
│   │   ├── UIController.ts                <-- Controls visual & gauge needle
│   │   ├── ChartPlotter.ts                <-- Draws charts/SVG polygons
│   │   └── NetworkEngine/                 <-- Network testing logic
│   │       ├── LatencyEngine.ts           <-- Ping & Jitter
│   │       ├── DownloadEngine.ts          <-- Parallel XHR Download test
│   │       └── UploadEngine.ts            <-- Parallel XHR Upload test
│   ├── utils/
│   │   ├── speedMath.ts                   <-- Average & random blob generator
│   │   └── config.ts                      <-- URL parameters & configuration
│   ├── main.ts                            <-- Main Orchestrator & entry point
│   └── style.css                          <-- Modernized CSS (Variables & Dark Mode)
├── index.html                             <-- Main HTML template
├── package.json
└── tsconfig.json
```

---

## Asset Migration Strategy

### 1. Font Migration
*   **Source:** `openspeedtest-ref/assets/fonts/*`
*   **Destination:** `src/assets/fonts/`
*   **Implementation:** Define fonts in `src/style.css` using `@font-face` with relative paths pointing to `src/assets/fonts/`.

### 2. Icons & Metadata Migration
*   **Source:** `openspeedtest-ref/assets/images/icons/*`
*   **Destination:** `public/` and `public/images/icons/`
*   **Implementation:** Keep XML files, Manifests, and `.ico` in the `public/` directory so they are accessible directly by the browser at root paths like `/favicon.ico` or `/site.webmanifest`.

### 3. Main SVG Migration
*   **Source:** `openspeedtest-ref/assets/images/app.svg`
*   **Destination:** `src/assets/images/app.svg`
*   **Implementation:** Used as an inline string in `src/components/UIController.ts` or injected directly via `src/main.ts` using Vite's raw import feature.

---

## 5-Phase Migration Plan

To ensure a structured modernization process, the migration of `openspeedtest-ref/assets/js/app-2.5.4.js` will be divided into 5 distinct, sequential agent conversations:

### Phase 1: Configuration & Core Utilities (`Config` & `Utils`)
*   **Scope:**
    *   Parse and validate URL query configuration parameters (lines 598-800 in `openspeedtest-ref/assets/js/app-2.5.4.js`).
    *   Migrate helper methods from `openSpeedtestGet` (lines 475-537 in `openspeedtest-ref/assets/js/app-2.5.4.js`), including array summation, average speed tracking with time window (`AvgSpeed`), and random Uint32 blob generator (`uRandom`).
*   **DX Goal:** Modularize into `src/utils/config.ts` and `src/utils/speedMath.ts` with explicit TypeScript interface definitions.

### Phase 2: SVG UI & Animation Controller (`UIController`)
*   **Scope:**
    *   Reference and interact with imported `src/assets/images/app.svg` DOM elements.
    *   Migrate animation/visual properties from `openSpeedtestShow` (lines 57-178, 254-307, 308-461 in `openspeedtest-ref/assets/js/app-2.5.4.js`), including fade transitions, status logs, visibility toggles, and gauge pointer rotation (`getNonlinearDegree`, `mainGaugeProgress`).
    *   Refactor animation interval loops from `setInterval` to `requestAnimationFrame` for better performance.
*   **DX Goal:** Build a strongly-typed `UIController` class in `src/components/UIController.ts` to manage DOM references and state without implicit types.

### Phase 3: Chart & Graph Engine (`ChartPlotter`)
*   **Scope:**
    *   Migrate the SVG polygon charting logic (`Graph` function from lines 179-253 in `openspeedtest-ref/assets/js/app-2.5.4.js`).
    *   Calculate layout points, horizontal/vertical steps, and maximum limits.
*   **DX Goal:** Abstract into a standalone `ChartPlotter` class in `src/components/ChartPlotter.ts` with clean data points rendering.

### Phase 4: Network Latency & Speed Test Engines
*   **Scope:**
    *   Migrate Latency (Ping & Jitter) testing loops.
    *   Migrate Parallel Download engine (default 6 threads) downloading from `/downloading`.
    *   Migrate Parallel Upload engine (default 6 threads) uploading `uRandom` data to `/upload`.
*   **DX Goal:** Leverage ES Modules and modern `async`/`await` patterns for XHR threads management under `src/components/NetworkEngine/`.

### Phase 5: Main Orchestrator & Integration (`SpeedTestEngine` + Page Polish)
*   **Scope:**
    *   Build the main test controller / state machine (orchestrating Ping -> Download -> Upload -> Display Results).
    *   Bootstrap the application in `src/main.ts` and clean up `index.html`.
    *   Modernize styling and dark mode integration using CSS variables in `src/style.css`.
*   **DX Goal:** Finalize the application with a single unified entry point and verify compiling correctness.

