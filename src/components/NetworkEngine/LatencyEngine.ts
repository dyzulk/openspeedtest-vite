// LatencyEngine.ts
// Migrated from sendPingRequest + readServerList (app-2.5.4.js lines 1226-1368).
// Measures ping latency and jitter to one or more servers, selecting the best.

import type { ServerConfig, SpeedTestConfig } from '../../utils/config.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LatencyResult {
  /** Minimum round-trip time in ms across all samples. */
  ping: number;
  /** Average jitter in ms (bottom 50% of absolute deltas). */
  jitter: number;
  /** The server that was measured. */
  server: ServerConfig;
}

/** Callback fired after each individual ping sample completes. */
export type PingSampleCallback = (ping: number, jitter: number) => void;

// ---------------------------------------------------------------------------
// LatencyEngine
// ---------------------------------------------------------------------------

export class LatencyEngine {
  private config: SpeedTestConfig;
  private aborted = false;

  constructor(config: SpeedTestConfig) {
    this.config = config;
  }

  /**
   * Abort any running measurement.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Measure latency to a single server.
   * Sends `config.pingSamples` sequential XHR requests and calculates
   * min ping and average jitter (using the lowest `jitterFinalSample` fraction).
   */
  async measureServer(
    server: ServerConfig,
    onSample?: PingSampleCallback,
  ): Promise<LatencyResult | null> {
    this.aborted = false;
    const pingResults: number[] = [];
    const jitterResults: number[] = [];

    // Determine the ping URL based on config.pingFile
    const pingUrl = this.config.pingFile === 'Upload' ? server.Upload : server.Download;

    for (let i = 0; i < this.config.pingSamples; i++) {
      if (this.aborted) return null;

      const rtt = await this.sendSinglePing(pingUrl);
      if (rtt === null) {
        // Timeout or error -- count as a failed sample, continue
        continue;
      }

      const clampedRtt = rtt <= 0 ? 0.1 : rtt;
      pingResults.push(clampedRtt);

      // Calculate jitter (absolute difference between consecutive samples)
      if (pingResults.length > 1) {
        const delta = Math.abs(
          pingResults[pingResults.length - 1] - pingResults[pingResults.length - 2],
        );
        jitterResults.push(parseFloat(delta.toFixed(1)));

        if (onSample) {
          onSample(clampedRtt, parseFloat(delta.toFixed(1)));
        }
      }
    }

    if (pingResults.length <= 1) {
      return null;
    }

    // Calculate final jitter: sort, take bottom fraction, average
    jitterResults.sort((a, b) => a - b);
    const sampleCount = Math.max(
      1,
      Math.floor(jitterResults.length * this.config.jitterFinalSample),
    );
    const trimmed = jitterResults.slice(0, sampleCount);
    const avgJitter = trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;

    const minPing = Math.min(...pingResults);

    return {
      ping: parseFloat(minPing.toFixed(1)),
      jitter: parseFloat(avgJitter.toFixed(1)),
      server,
    };
  }

  /**
   * Measure all servers in the list and return the one with the lowest ping.
   */
  async selectBestServer(
    servers: ServerConfig[],
    onSample?: PingSampleCallback,
  ): Promise<LatencyResult | null> {
    this.aborted = false;
    const results: LatencyResult[] = [];

    for (const server of servers) {
      if (this.aborted) return null;

      const result = await this.measureServer(server, onSample);
      if (result) {
        results.push(result);
      }
    }

    if (results.length === 0) return null;

    // Find the one with the lowest ping
    let best = results[0];
    for (let i = 1; i < results.length; i++) {
      if (results[i].ping < best.ping) {
        best = results[i];
      }
    }

    return best;
  }

  // ---- Internal -----------------------------------------------------------

  /**
   * Send a single XHR ping and return the round-trip time in ms.
   * Returns null on timeout or error.
   */
  private sendSinglePing(url: string): Promise<number | null> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open(this.config.pingMethod, `${url}?n=${Math.random()}`, true);
      xhr.timeout = this.config.pingTimeOut;

      const startTime = performance.now();

      xhr.onload = () => {
        if (xhr.status === 200 && xhr.readyState === 4) {
          // Try to use Resource Timing API for more accurate measurement
          const entries = performance.getEntries();
          const lastEntry = entries[entries.length - 1];

          let rtt: number;
          if (
            lastEntry &&
            'initiatorType' in lastEntry &&
            (lastEntry as PerformanceResourceTiming).initiatorType === 'xmlhttprequest'
          ) {
            rtt = parseFloat(lastEntry.duration.toFixed(1));
          } else {
            rtt = Math.floor(performance.now() - startTime);
          }

          resolve(rtt);
        } else {
          resolve(null);
        }
      };

      xhr.onerror = () => resolve(null);
      xhr.ontimeout = () => resolve(null);
      xhr.send();
    });
  }
}
