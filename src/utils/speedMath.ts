export function arraySum(arr: number[]): number {
  if (!arr) return 0;
  return arr.reduce((sum, val) => {
    if (typeof val === 'number') {
      return sum + val;
    }
    return sum;
  }, 0);
}

export class AvgSpeedTracker {
  private speedSamples: number[] = [];
  private overallTimeAvg: number = typeof window !== 'undefined' ? window.performance.now() : performance.now();
  private finalSpeed: number = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.overallTimeAvg = typeof window !== 'undefined' ? window.performance.now() : performance.now();
    this.speedSamples = [];
    this.finalSpeed = 0;
  }

  calculate(liveSpeed: number, startDelaySeconds: number, totalDurationSeconds: number): number {
    const now = typeof window !== 'undefined' ? window.performance.now() : performance.now();
    const timeNowSeconds = (now - this.overallTimeAvg) / 1000;
    const startRecordingThreshold = totalDurationSeconds - startDelaySeconds;

    if (timeNowSeconds >= startRecordingThreshold) {
      if (liveSpeed > 0) {
        this.speedSamples.push(liveSpeed);
      }
      const sum = arraySum(this.speedSamples);
      this.finalSpeed = sum / (this.speedSamples.length || 1);
    }
    return this.finalSpeed;
  }

  getSamples(): number[] {
    return this.speedSamples;
  }
}

export function generateRandomBlob(sizeMB: number): Blob {
  // 1 MB buffer of random Uint32 numbers (262144 * 4 bytes = 1,048,576 bytes = 1 MB)
  const randomValue = new Uint32Array(262144);
  const n = randomValue.length;
  for (let i = 0; i < n; i++) {
    randomValue[i] = Math.floor(Math.random() * 4294967296);
  }

  const chunks: ArrayBuffer[] = [];
  for (let i = 0; i < sizeMB; i++) {
    chunks.push(randomValue.slice().buffer as ArrayBuffer);
  }
  return new Blob(chunks, { type: 'application/octet-stream' });
}
