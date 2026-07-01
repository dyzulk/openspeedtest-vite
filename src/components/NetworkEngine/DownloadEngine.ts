// DownloadEngine.ts
// Migrated from SendReQ + download loop (app-2.5.4.js lines 1033-1164).
// Parallel XHR GET download speed test engine.

import type { SpeedTestConfig } from '../../utils/config.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SpeedProgress {
  /** Current calculated speed in Mbps. */
  currentSpeed: number;
  /** Total bytes downloaded so far. */
  totalLoaded: number;
  /** Elapsed time in seconds since the download started. */
  elapsedSec: number;
}

// ---------------------------------------------------------------------------
// DownloadEngine
// ---------------------------------------------------------------------------

export class DownloadEngine {
  private config: SpeedTestConfig;
  private stopped = false;

  // Active XHR references for cleanup
  private requests: (XMLHttpRequest | null)[] = [];

  // Cumulative byte counters
  private totalLoaded = 0;

  // Speed calculation accumulators (with periodic warmup reset)
  private dTotal = 0;
  private dtTotal = 0;
  private dDiff = 0;
  private dtDiff = 0;

  // Warmup reset state
  private warmupDone = false;
  private nextDualReset = 0;

  // Timing
  private startTime = 0;

  constructor(config: SpeedTestConfig) {
    this.config = config;
  }

  /**
   * Begin the download speed test.
   * Opens `config.dlThreads` parallel XHR connections to `downloadUrl`.
   * Calls `onProgress` approximately every time new data arrives.
   * The caller is responsible for stopping after `config.dlDuration` seconds.
   */
  start(downloadUrl: string, onProgress: (p: SpeedProgress) => void): void {
    this.stopped = false;
    this.totalLoaded = 0;
    this.dTotal = 0;
    this.dtTotal = 0;
    this.dDiff = 0;
    this.dtDiff = 0;
    this.warmupDone = false;
    this.nextDualReset = 0;
    this.startTime = performance.now();
    this.requests = [];

    // Calculate warmup threshold: dlFinal/2 seconds after start
    const dlFinal = Math.min(this.config.dlDuration * 0.6, 7);

    for (let i = 0; i < this.config.dlThreads; i++) {
      setTimeout(() => {
        if (!this.stopped) {
          this.sendRequest(i, downloadUrl, dlFinal, onProgress);
        }
      }, this.config.dlDelay * i);
    }
  }

  /**
   * Stop all active downloads.
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

  /** Returns total bytes downloaded. */
  getTotalLoaded(): number {
    return this.totalLoaded;
  }

  // ---- Internal -----------------------------------------------------------

  private sendRequest(
    index: number,
    downloadUrl: string,
    dlFinal: number,
    onProgress: (p: SpeedProgress) => void,
  ): void {
    if (this.stopped) return;

    let lastLoaded = 0;
    const xhr = new XMLHttpRequest();
    this.requests[index] = xhr;

    xhr.open('GET', `${downloadUrl}?n=${Math.random()}`, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = (e: ProgressEvent) => {
      if (this.stopped) {
        xhr.abort();
        this.requests[index] = null;
        return;
      }

      const delta = e.loaded <= 0 ? 0 : e.loaded - lastLoaded;
      if (isNaN(delta) || !isFinite(delta) || delta < 0) return;

      this.totalLoaded += delta;
      lastLoaded = e.loaded;

      this.updateSpeed(dlFinal, onProgress);
    };

    xhr.onload = () => {
      if (lastLoaded === 0 && xhr.response) {
        this.totalLoaded += (xhr.response as ArrayBuffer).byteLength;
      }

      this.requests[index] = null;

      // Immediately start a new request on this slot (loop)
      if (!this.stopped) {
        this.sendRequest(index, downloadUrl, dlFinal, onProgress);
      }
    };

    xhr.onerror = () => {
      this.requests[index] = null;
      if (!this.stopped) {
        this.sendRequest(index, downloadUrl, dlFinal, onProgress);
      }
    };

    xhr.send();
  }

  private updateSpeed(
    dlFinal: number,
    onProgress: (p: SpeedProgress) => void,
  ): void {
    const elapsedMs = performance.now() - this.startTime;
    const elapsedSec = elapsedMs / 1000;

    // Warmup reset: after dlFinal/2 seconds, reset accumulators to 1%
    // to discard initial connection setup data
    if (!this.warmupDone && elapsedSec > dlFinal / 2) {
      this.warmupDone = true;
      this.dtTotal *= 0.01;
      this.dTotal *= 0.01;
      this.nextDualReset = elapsedMs + 10000;
    }

    // Periodic dual reset every 10 seconds (up to 6 seconds before end)
    const neXT = this.config.dlDuration * 1000 - 6000;
    if (this.warmupDone && elapsedMs >= this.nextDualReset && this.nextDualReset < neXT) {
      this.nextDualReset += 10000;
      this.dtTotal *= 0.01;
      this.dTotal *= 0.01;
    }

    // Delta bytes since last update
    const dLoad = this.totalLoaded <= 0 ? 0 : this.totalLoaded - this.dDiff;
    this.dDiff = this.totalLoaded;
    this.dTotal += dLoad;

    // Delta time since last update
    const dtLoad = elapsedMs - this.dtDiff;
    this.dtDiff = elapsedMs;
    this.dtTotal += dtLoad;

    if (this.dTotal > 0 && this.dtTotal > 0) {
      // bytes / ms  ->  Mbps: divide by 125 (1000/8 = 125 to convert bytes/ms to Mbps)
      const speed = (this.dTotal / this.dtTotal / 125) * this.config.dlAdjust;

      onProgress({
        currentSpeed: speed,
        totalLoaded: this.totalLoaded,
        elapsedSec,
      });
    }
  }
}
