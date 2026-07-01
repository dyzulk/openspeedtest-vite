// UploadEngine.ts
// Migrated from SendUpReq + upload loop (app-2.5.4.js lines 1040-1224).
// Parallel XHR POST upload speed test engine.

import type { SpeedTestConfig } from '../../utils/config.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpeedProgress {
  /** Current calculated speed in Mbps. */
  currentSpeed: number;
  /** Total bytes uploaded so far. */
  totalLoaded: number;
  /** Elapsed time in seconds since the upload started. */
  elapsedSec: number;
}

// ---------------------------------------------------------------------------
// UploadEngine
// ---------------------------------------------------------------------------

export class UploadEngine {
  private config: SpeedTestConfig;
  private stopped = false;

  // Active XHR references for cleanup
  private requests: (XMLHttpRequest | null)[] = [];

  // Cumulative byte counters
  private totalLoaded = 0;

  // Speed calculation accumulators (with periodic warmup reset)
  private uTotal = 0;
  private utTotal = 0;
  private uDiff = 0;
  private utDiff = 0;

  // Warmup reset state
  private warmupDone = false;
  private nextDualReset = 0;

  // Timing
  private startTime = 0;

  constructor(config: SpeedTestConfig) {
    this.config = config;
  }

  /**
   * Begin the upload speed test.
   * Opens `config.ulThreads` parallel XHR POST connections to `uploadUrl`.
   * Calls `onProgress` approximately every time new data is sent.
   * The caller is responsible for stopping after `config.ulDuration` seconds.
   *
   * @param uploadUrl - The server upload endpoint.
   * @param blob      - The random data blob to upload (from generateRandomBlob).
   * @param onProgress - Callback fired with current speed data.
   */
  start(uploadUrl: string, blob: Blob, onProgress: (p: SpeedProgress) => void): void {
    this.stopped = false;
    this.totalLoaded = 0;
    this.uTotal = 0;
    this.utTotal = 0;
    this.uDiff = 0;
    this.utDiff = 0;
    this.warmupDone = false;
    this.nextDualReset = 0;
    this.startTime = performance.now();
    this.requests = [];

    // Calculate warmup threshold: ulFinal/2 seconds after start
    const ulFinal = Math.min(this.config.ulDuration * 0.6, 7);

    for (let i = 0; i < this.config.ulThreads; i++) {
      setTimeout(() => {
        if (!this.stopped) {
          this.sendRequest(i, uploadUrl, blob, ulFinal, onProgress);
        }
      }, this.config.ulDelay * i);
    }
  }

  /**
   * Stop all active uploads.
   */
  stop(): void {
    this.stopped = true;
    for (const xhr of this.requests) {
      if (xhr) {
        try { xhr.abort(); } catch { /* ignore */ }
      }
    }
    this.requests = [];
  }

  /** Returns total bytes uploaded. */
  getTotalLoaded(): number {
    return this.totalLoaded;
  }

  // ---- Internal -----------------------------------------------------------

  private sendRequest(
    index: number,
    uploadUrl: string,
    blob: Blob,
    ulFinal: number,
    onProgress: (p: SpeedProgress) => void,
  ): void {
    if (this.stopped) return;

    // Guard: thread index > 0 should not send data until first thread has loaded enough.
    // This matches the original: `if (i > 0 && uLoaded <= 17000) { } else { send }`
    if (index > 0 && this.totalLoaded <= 17000) {
      // Retry after a short delay
      setTimeout(() => {
        this.sendRequest(index, uploadUrl, blob, ulFinal, onProgress);
      }, 100);
      return;
    }

    let lastULoaded = 0;
    const xhr = new XMLHttpRequest();
    this.requests[index] = xhr;

    xhr.open('POST', `${uploadUrl}?n=${Math.random()}`, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (this.stopped) {
        xhr.abort();
        this.requests[index] = null;
        return;
      }

      const delta = e.loaded <= 0 ? 0 : e.loaded - lastULoaded;
      if (isNaN(delta) || !isFinite(delta) || delta < 0) return;

      this.totalLoaded += delta;
      lastULoaded = e.loaded;

      this.updateSpeed(ulFinal, onProgress);
    };

    xhr.onload = () => {
      // If progress events were not fired, estimate from blob size
      if (lastULoaded === 0) {
        this.totalLoaded += this.config.ulDataSize * 1048576;
      }

      this.requests[index] = null;

      // Loop: start a new upload on this slot
      if (!this.stopped) {
        this.sendRequest(index, uploadUrl, blob, ulFinal, onProgress);
      }
    };

    xhr.onerror = () => {
      this.requests[index] = null;
      if (!this.stopped) {
        this.sendRequest(index, uploadUrl, blob, ulFinal, onProgress);
      }
    };

    xhr.send(blob);
  }

  private updateSpeed(
    ulFinal: number,
    onProgress: (p: SpeedProgress) => void,
  ): void {
    const elapsedMs = performance.now() - this.startTime;
    const elapsedSec = elapsedMs / 1000;

    // Warmup reset: after ulFinal/2 seconds, reset accumulators to 10%
    if (!this.warmupDone && elapsedSec > ulFinal / 2) {
      this.warmupDone = true;
      this.utTotal *= 0.1;
      this.uTotal *= 0.1;
      this.nextDualReset = elapsedMs + 10000;
    }

    // Periodic dual reset every 10 seconds (up to 6 seconds before end)
    const neXTUp = this.config.ulDuration * 1000 - 6000;
    if (this.warmupDone && elapsedMs >= this.nextDualReset && this.nextDualReset < neXTUp) {
      this.nextDualReset += 10000;
      this.utTotal *= 0.1;
      this.uTotal *= 0.1;
    }

    // Delta bytes since last update
    const uLoad = this.totalLoaded <= 0 ? 0 : this.totalLoaded - this.uDiff;
    this.uDiff = this.totalLoaded;
    this.uTotal += uLoad;

    // Delta time since last update
    const utLoad = this.utDiff === 0 ? 0 : elapsedMs - this.utDiff;
    this.utDiff = elapsedMs;
    this.utTotal += utLoad;

    if (this.uTotal > 0 && this.utTotal > 0) {
      // bytes / ms  ->  Mbps: divide by 125
      const speed = (this.uTotal / this.utTotal / 125) * this.config.upAdjust;

      onProgress({
        currentSpeed: speed,
        totalLoaded: this.totalLoaded,
        elapsedSec,
      });
    }
  }
}
