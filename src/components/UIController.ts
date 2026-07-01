// UIController.ts
// Migrated from openSpeedtestShow (app-2.5.4.js lines 57-474).
// Manages all SVG DOM references, fade transitions, gauge animations,
// progress bars, and display updates for the OpenSpeedTest UI.

// ---------------------------------------------------------------------------
// Easing helpers (pure functions, no side effects)
// ---------------------------------------------------------------------------

function easeOutQuint(t: number, b: number, c: number, d: number): number {
  const tn = t / d - 1;
  return c * (tn * tn * tn * tn * tn + 1) + b;
}

function easeOutCubic(t: number, b: number, c: number, d: number): number {
  const tn = t / d - 1;
  return c * (tn * tn * tn + 1) + b;
}

// ---------------------------------------------------------------------------
// Gauge scale table -- maps Mbps to gauge degrees (strokeDashoffset).
// Identical to the original to preserve visual accuracy.
// ---------------------------------------------------------------------------

interface ScaleStop {
  degree: number;
  value: number;
}

const GAUGE_SCALE: ScaleStop[] = [
  { degree: 680, value: 0 },
  { degree: 570, value: 0.5 },
  { degree: 460, value: 1 },
  { degree: 337, value: 10 },
  { degree: 220, value: 100 },
  { degree: 115, value: 500 },
  { degree: 0, value: 1000 },
];

// ---------------------------------------------------------------------------
// SVG DOM reference helper
// ---------------------------------------------------------------------------

function getEl(id: string): SVGElement | HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`UIController: element #${id} not found in DOM`);
  }
  return el;
}

// ---------------------------------------------------------------------------
// UIController
// ---------------------------------------------------------------------------

export class UIController {
  // -- DOM element references (populated in init()) -------------------------

  // Text displays inside <symbol id="oDoMeter">
  private oDoLiveSpeed!: SVGTextElement;
  private oDoLiveStatus!: SVGTextElement;
  private oDoTopSpeed!: SVGTextElement;

  // IP display
  private yourIP!: SVGTextElement;
  private ipDesk!: SVGElement;
  private ipMob!: SVGElement;

  // Direction symbols
  private downSymbolDesk!: SVGElement;
  private upSymbolDesk!: SVGElement;
  private upSymbolMob!: SVGElement;
  private downSymbolMob!: SVGElement;

  // Settings / start buttons
  private settingsMob!: SVGElement;
  private settingsDesk!: SVGElement;
  private startButtonDesk!: SVGElement;
  private startButtonMob!: SVGElement;

  // Connection error overlays
  private connectErrorMob!: SVGElement;
  private connectErrorDesk!: SVGElement;

  // Result text elements
  private downResult!: SVGTextElement;
  private upRestxt!: SVGTextElement;
  private pingResult!: SVGTextElement;
  private jitterDesk!: SVGTextElement;
  private pingMobres!: SVGTextElement;
  private jitterResultMon!: SVGTextElement;

  // Containers / top-level groups
  private uiDesk!: SVGElement;
  private uiMob!: SVGElement;
  private introDesk!: SVGElement;
  private introMob!: SVGElement;
  private loader!: HTMLElement;
  private openSpeedtest!: SVGElement;

  // Gauge arcs (Desktop + Mobile)
  private mainGaugeBluDesk!: SVGElement;
  private mainGaugeWhiDesk!: SVGElement;
  private mainGaugeBluMob!: SVGElement;
  private mainGaugeWhiMob!: SVGElement;

  // Progress bar overlay lines
  private progressStatusDesk!: SVGElement;
  private progressStatusMob!: SVGElement;

  // Graph containers
  private graphc1!: SVGElement;
  private graphc2!: SVGElement;
  private graphMob1!: SVGElement;
  private graphMob2!: SVGElement;

  // Results data link
  private resultsData!: SVGElement;

  // -- Internal state -------------------------------------------------------

  private _isInitialised = false;

  // Active animation frame IDs so we can cancel them.
  private _progressRafId: number | null = null;
  private _gaugeToZeroRafId: number | null = null;

  // =========================================================================
  //  PUBLIC API
  // =========================================================================

  /**
   * Call once after the SVG has been injected into the DOM.
   * Looks up every element by ID and caches a typed reference.
   */
  init(): void {
    if (this._isInitialised) return;

    // oDoMeter texts
    this.oDoLiveSpeed = getEl('oDoLiveSpeed') as SVGTextElement;
    this.oDoLiveStatus = getEl('oDoLiveStatus') as SVGTextElement;
    this.oDoTopSpeed = getEl('oDoTopSpeed') as SVGTextElement;

    // IP
    this.yourIP = getEl('YourIP') as SVGTextElement;
    this.ipDesk = getEl('ipDesk') as SVGElement;
    this.ipMob = getEl('ipMob') as SVGElement;

    // Direction symbols
    this.downSymbolDesk = getEl('downSymbolDesk') as SVGElement;
    this.upSymbolDesk = getEl('upSymbolDesk') as SVGElement;
    this.upSymbolMob = getEl('upSymbolMob') as SVGElement;
    this.downSymbolMob = getEl('downSymbolMob') as SVGElement;

    // Settings / start
    this.settingsMob = getEl('settingsMob') as SVGElement;
    this.settingsDesk = getEl('settingsDesk') as SVGElement;
    this.startButtonDesk = getEl('startButtonDesk') as SVGElement;
    this.startButtonMob = getEl('startButtonMob') as SVGElement;

    // Errors
    this.connectErrorMob = getEl('ConnectErrorMob') as SVGElement;
    this.connectErrorDesk = getEl('ConnectErrorDesk') as SVGElement;

    // Results
    this.downResult = getEl('downResult') as SVGTextElement;
    this.upRestxt = getEl('upRestxt') as SVGTextElement;
    this.pingResult = getEl('pingResult') as SVGTextElement;
    this.jitterDesk = getEl('jitterDesk') as SVGTextElement;
    this.pingMobres = getEl('pingMobres') as SVGTextElement;
    this.jitterResultMon = getEl('JitterResultMon') as SVGTextElement;

    // UI groups
    this.uiDesk = getEl('UI-Desk') as SVGElement;
    this.uiMob = getEl('UI-Mob') as SVGElement;
    this.introDesk = getEl('intro-Desk') as SVGElement;
    this.introMob = getEl('intro-Mob') as SVGElement;
    this.loader = getEl('loading_app') as HTMLElement;
    this.openSpeedtest = getEl('OpenSpeedtest') as SVGElement;

    // Gauges
    this.mainGaugeBluDesk = getEl('mainGaugeBlue-Desk') as SVGElement;
    this.mainGaugeWhiDesk = getEl('mainGaugeWhite-Desk') as SVGElement;
    this.mainGaugeBluMob = getEl('mainGaugeBlue-Mob') as SVGElement;
    this.mainGaugeWhiMob = getEl('mainGaugeWhite-Mob') as SVGElement;

    // Progress bars
    this.progressStatusDesk = getEl('progressStatus-Desk') as SVGElement;
    this.progressStatusMob = getEl('progressStatus-Mob') as SVGElement;

    // Graphs
    this.graphc1 = getEl('graphc1') as SVGElement;
    this.graphc2 = getEl('graphc2') as SVGElement;
    this.graphMob1 = getEl('graphMob1') as SVGElement;
    this.graphMob2 = getEl('graphMob2') as SVGElement;

    // Results data link
    this.resultsData = getEl('resultsData') as SVGElement;

    this._isInitialised = true;
  }

  // ---- Element accessors for external event binding -----------------------

  getStartButtonDesk(): SVGElement { return this.startButtonDesk; }
  getStartButtonMob(): SVGElement { return this.startButtonMob; }
  getSettingsDesk(): SVGElement { return this.settingsDesk; }
  getSettingsMob(): SVGElement { return this.settingsMob; }
  getResultsData(): SVGElement { return this.resultsData; }

  // ---- Graph container accessors ------------------------------------------

  getGraphc1(): SVGElement { return this.graphc1; }
  getGraphc2(): SVGElement { return this.graphc2; }
  getGraphMob1(): SVGElement { return this.graphMob1; }
  getGraphMob2(): SVGElement { return this.graphMob2; }

  // ---- Fade transitions ---------------------------------------------------

  /**
   * Animate an element's opacity using requestAnimationFrame.
   * Resolves when the animation completes.
   */
  fadeElement(
    el: HTMLElement | SVGElement,
    direction: 'in' | 'out',
    durationMs: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const isIn = direction === 'in';
      let opacity = isIn ? 0 : 1;
      const style = (el as HTMLElement).style ?? (el as SVGElement).style;

      if (isIn) {
        style.display = 'block';
        style.opacity = '0';
      }

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        opacity = isIn ? progress : 1 - progress;
        style.opacity = String(opacity);

        if (opacity <= 0) {
          style.display = 'none';
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }

  // ---- App lifecycle transitions ------------------------------------------

  /**
   * Initial app reveal: fade out loader, fade in SVG app.
   */
  async showApp(): Promise<void> {
    await this.fadeElement(this.loader, 'out', 500);
    await this.fadeElement(this.openSpeedtest, 'in', 1000);
  }

  /**
   * Transition from intro screen to the test UI.
   */
  async showUI(): Promise<void> {
    await Promise.all([
      this.fadeElement(this.introDesk, 'out', 1000),
      this.fadeElement(this.introMob, 'out', 1000),
    ]);
    await Promise.all([
      this.fadeElement(this.uiDesk, 'in', 1000),
      this.fadeElement(this.uiMob, 'in', 1000),
    ]);
  }

  // ---- IP display ---------------------------------------------------------

  toggleIpDisplay(): void {
    const isVisible = this.ipDesk.style.display === 'block';
    const next = isVisible ? 'none' : 'block';
    this.ipDesk.style.display = next;
    this.ipMob.style.display = next;
  }

  setIpText(text: string): void {
    this.yourIP.textContent = text;
  }

  // ---- Direction symbols --------------------------------------------------

  setSymbol(direction: 'download' | 'upload' | 'none'): void {
    const showDl = direction === 'download';
    const showUl = direction === 'upload';
    this.downSymbolMob.style.display = showDl ? 'block' : 'none';
    this.downSymbolDesk.style.display = showDl ? 'block' : 'none';
    this.upSymbolMob.style.display = showUl ? 'block' : 'none';
    this.upSymbolDesk.style.display = showUl ? 'block' : 'none';
  }

  // ---- Status text --------------------------------------------------------

  showStatus(text: string): void {
    this.oDoLiveStatus.textContent = text;
  }

  // ---- Connection error ---------------------------------------------------

  showConnectionError(): void {
    this.connectErrorMob.style.display = 'block';
    this.connectErrorDesk.style.display = 'block';
  }

  // ---- Live speed display -------------------------------------------------

  showLiveSpeed(data: number, display?: 'countDown' | 'speedToZero' | 'Ping'): void {
    if (display === 'countDown') {
      this.oDoLiveSpeed.textContent = data.toFixed(0);
      return;
    }

    if (display === 'speedToZero') {
      let show: string;
      if (typeof data === 'number') {
        show = data.toFixed(1);
      } else {
        show = String(data);
      }
      if (data <= 0) show = '0';
      this.oDoLiveSpeed.textContent = show;
      this.oDoTopSpeed.textContent = '1000+';
      this.oDoTopSpeed.style.fontSize = '16.9px';
      this.oDoTopSpeed.style.fill = 'gray';
      return;
    }

    if (display === 'Ping') {
      if (data >= 1 && data < 10000) {
        this.oDoLiveSpeed.textContent = String(Math.floor(data));
      } else if (data >= 0 && data < 1) {
        this.oDoLiveSpeed.textContent = String(data === 0 ? 0 : data);
      }
      return;
    }

    // Default speed display
    if (data === 0) {
      this.oDoLiveSpeed.textContent = data.toFixed(0);
    } else if (data <= 1 && data > 0) {
      this.oDoLiveSpeed.textContent = data.toFixed(3);
    } else if (data > 1) {
      this.oDoLiveSpeed.textContent = data.toFixed(1);
    }

    if (data <= 1000) {
      this.oDoTopSpeed.textContent = '1000+';
      this.oDoTopSpeed.style.fontSize = '16.9px';
      this.oDoTopSpeed.style.fill = 'gray';
    }
    if (data >= 1010) {
      this.oDoTopSpeed.textContent = Math.floor(data / 1010) * 1000 + '+';
      this.oDoTopSpeed.style.fill = 'gray';
      this.oDoTopSpeed.style.fontSize = '17.2px';
    }
  }

  setLiveSpeedText(text: string): void {
    this.oDoLiveSpeed.textContent = text;
  }

  // ---- Result cards -------------------------------------------------------

  showDownloadResult(speed: number): void {
    if (speed < 1) {
      this.downResult.textContent = speed.toFixed(3);
    } else if (speed < 9999) {
      this.downResult.textContent = speed.toFixed(1);
    } else if (speed < 99999) {
      this.downResult.textContent = speed.toFixed(1);
      this.downResult.style.fontSize = '20px';
    } else {
      this.downResult.textContent = speed.toFixed(1);
      this.downResult.style.fontSize = '18px';
    }
  }

  showUploadResult(speed: number): void {
    if (speed < 1) {
      this.upRestxt.textContent = speed.toFixed(3);
    } else if (speed < 9999) {
      this.upRestxt.textContent = speed.toFixed(1);
    } else if (speed < 99999) {
      this.upRestxt.textContent = speed.toFixed(1);
      this.upRestxt.style.fontSize = '20px';
    } else {
      this.upRestxt.textContent = speed.toFixed(1);
      this.upRestxt.style.fontSize = '18px';
    }
  }

  showPingResult(value: number): void {
    if (value >= 1 && value < 10000) {
      this.pingResult.textContent = String(Math.floor(value));
      this.pingMobres.textContent = String(Math.floor(value));
    } else if (value >= 0 && value < 1) {
      const display = value === 0 ? '0' : String(value);
      this.pingResult.textContent = display;
      this.pingMobres.textContent = display;
    }
  }

  showJitterResult(value: number): void {
    if (value >= 1 && value < 10000) {
      this.jitterDesk.textContent = String(Math.floor(value));
      if (value >= 1 && value < 100) {
        this.jitterResultMon.textContent = String(Math.floor(value));
      } else if (value >= 100) {
        const kData = (value / 1000).toFixed(1);
        this.jitterResultMon.textContent = kData + 'k';
      }
    } else if (value >= 0 && value < 1) {
      const display = value === 0 ? '0' : String(value);
      this.jitterDesk.textContent = display;
      this.jitterResultMon.textContent = display;
    }
  }

  showPingError(text: string): void {
    this.oDoLiveSpeed.textContent = text;
  }

  // ---- Gauge --------------------------------------------------------------

  getNonlinearDegree(megaBps: number): number {
    if (megaBps <= 0 || isNaN(megaBps)) {
      return 0;
    }

    for (let i = 0; i < GAUGE_SCALE.length; i++) {
      if (megaBps <= GAUGE_SCALE[i].value) {
        const prev = GAUGE_SCALE[i - 1];
        const curr = GAUGE_SCALE[i];
        return prev.degree +
          (megaBps - prev.value) *
          (curr.degree - prev.degree) /
          (curr.value - prev.value);
      }
    }

    return GAUGE_SCALE[GAUGE_SCALE.length - 1].degree;
  }

  mainGaugeProgress(speedMbps: number): void {
    const speed = Math.max(speedMbps, 0);
    const offset = this.getNonlinearDegree(speed);

    if (speedMbps > 0) {
      this.mainGaugeBluDesk.style.strokeOpacity = '1';
      this.mainGaugeWhiDesk.style.strokeOpacity = '1';
      this.mainGaugeBluMob.style.strokeOpacity = '1';
      this.mainGaugeWhiMob.style.strokeOpacity = '1';

      this.mainGaugeBluDesk.style.strokeDashoffset = String(offset);
      this.mainGaugeWhiDesk.style.strokeDashoffset = String(offset === 0 ? 1 : offset + 1);
      this.mainGaugeBluMob.style.strokeDashoffset = String(offset);
      this.mainGaugeWhiMob.style.strokeDashoffset = String(offset === 0 ? 1 : offset + 1);
    }

    if (offset === 0 && speed > 1000) {
      const capped = Math.min(offset, 681);
      this.mainGaugeBluMob.style.strokeDashoffset = String(capped);
      this.mainGaugeWhiMob.style.strokeDashoffset = String(offset === 0 ? 1 : offset + 1);
      this.mainGaugeWhiDesk.style.strokeDashoffset = String(offset === 0 ? 1 : offset + 1);
      this.mainGaugeBluDesk.style.strokeDashoffset = String(capped);
    } else if (offset === 0 && speed <= 0) {
      this.mainGaugeBluMob.style.strokeDashoffset = '681.1';
      this.mainGaugeWhiMob.style.strokeDashoffset = '0.1';
      this.mainGaugeWhiDesk.style.strokeDashoffset = '0.1';
      this.mainGaugeBluDesk.style.strokeDashoffset = '681.1';
    }
  }

  gaugeProgressToZero(currentSpeed: number): Promise<void> {
    return new Promise((resolve) => {
      if (this._gaugeToZeroRafId !== null) {
        cancelAnimationFrame(this._gaugeToZeroRafId);
      }

      const duration = 3; // seconds
      const startTime = performance.now();
      const startSpeed = currentSpeed;

      const step = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        const speedToZero = easeOutQuint(
          Math.min(elapsed, duration),
          startSpeed,
          -startSpeed,
          duration,
        );

        this.showLiveSpeed(speedToZero, 'speedToZero');
        this.mainGaugeProgress(speedToZero);

        if (elapsed >= duration || speedToZero <= 0) {
          this.showLiveSpeed(0, 'speedToZero');
          this.mainGaugeProgress(0);
          this._gaugeToZeroRafId = null;
          resolve();
        } else {
          this._gaugeToZeroRafId = requestAnimationFrame(step);
        }
      };

      this._gaugeToZeroRafId = requestAnimationFrame(step);
    });
  }

  // ---- Progress bar -------------------------------------------------------

  startProgress(isForward: boolean, durationSec: number): Promise<void> {
    return new Promise((resolve) => {
      if (this._progressRafId !== null) {
        cancelAnimationFrame(this._progressRafId);
      }

      const startTime = performance.now();
      const backward = 0 - 400;

      const step = (now: number) => {
        const elapsed = (now - startTime) / 1000;

        let value: number;
        if (isForward) {
          value = easeOutCubic(
            Math.min(elapsed, durationSec),
            400, 400, durationSec,
          );
        } else {
          value = easeOutCubic(
            Math.min(elapsed, durationSec),
            400, backward, durationSec,
          );
        }

        this.progressStatusDesk.style.strokeDashoffset = String(value);
        this.progressStatusMob.style.strokeDashoffset = String(value);

        if (elapsed >= durationSec) {
          this.progressStatusDesk.style.strokeDashoffset = '800';
          this.progressStatusMob.style.strokeDashoffset = '800';
          this._progressRafId = null;
          resolve();
        } else {
          this._progressRafId = requestAnimationFrame(step);
        }
      };

      this._progressRafId = requestAnimationFrame(step);
    });
  }

  // ---- Results data link --------------------------------------------------

  setResultsLink(url: string): void {
    this.resultsData.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      url,
    );
    this.resultsData.setAttribute('target', '_blank');
  }
}
