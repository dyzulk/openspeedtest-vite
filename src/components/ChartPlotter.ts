// ChartPlotter.ts
// Migrated from openSpeedtestShow.prototype.Graph (app-2.5.4.js lines 179-253).
// Standalone class for rendering real-time SVG polygon charts.

const SVG_NS = 'http://www.w3.org/2000/svg';

export class ChartPlotter {
  private values: number[] = [];
  private maxValue = 0;
  private width: number;
  private height: number;

  /**
   * @param width  - Horizontal span of the chart in SVG user units.
   * @param height - Vertical span of the chart in SVG user units.
   */
  constructor(width: number = 130, height: number = 50) {
    this.width = width;
    this.height = height;
  }

  /**
   * Push a new data point.
   * Non-numeric values are silently ignored.
   */
  addDataPoint(speed: number): void {
    if (!isNaN(speed)) {
      this.values.push(speed);
    }
  }

  /**
   * Re-render the polygon inside `container`, replacing any existing
   * polygon of the same `cssClass`.
   *
   * @param container - The SVG element to append the polygon to (e.g. graphc1 or graphc2).
   * @param cssClass  - CSS class applied to the polygon (e.g. "line" or "line2").
   *                    Used to find and remove the previous polygon on each render.
   */
  render(container: SVGElement, cssClass: string): void {
    if (this.values.length <= 1) return;

    this.calcMaxValue();
    const pointsAttr = this.calcPoints();

    // Remove existing polygons of this class
    const existing = container.getElementsByClassName(cssClass);
    while (existing.length > 0) {
      existing[0].remove();
    }

    // Create new polygon
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsAttr);
    polygon.setAttribute('class', cssClass);
    container.appendChild(polygon);
  }

  /**
   * Clear all accumulated data and reset internal state.
   */
  reset(): void {
    this.values = [];
    this.maxValue = 0;
  }

  // ---- Internal helpers ---------------------------------------------------

  private calcMaxValue(): void {
    this.maxValue = 0;
    for (const v of this.values) {
      if (v > this.maxValue) {
        this.maxValue = v;
      }
    }
    this.maxValue = Math.ceil(this.maxValue);
  }

  private calcPoints(): string {
    const len = this.values.length;
    if (len <= 1) return '';

    const steps = this.width / (len - 1);
    let points = `0,${this.height} `;

    for (let x = 0; x < len; x++) {
      const perc = this.values[x] / this.maxValue;
      const px = (steps * x).toFixed(2);
      const py = (this.height - this.height * perc).toFixed(2);
      points += `${px},${py} `;
    }

    points += `${this.width},${this.height}`;
    return points;
  }
}
