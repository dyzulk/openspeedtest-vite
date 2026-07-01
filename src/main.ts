// main.ts
// Phase 5: Main Orchestrator & Application Entry Point
// Bootstraps the OpenSpeedTest application, injects the SVG UI, and
// orchestrates the Ping -> Download -> Upload -> Results test flow.

import './style.css';
import appSvgRaw from './assets/images/app.svg?raw';
import { parseConfig } from './utils/config.ts';
import type { SpeedTestConfig, ServerConfig } from './utils/config.ts';
import { AvgSpeedTracker, generateRandomBlob } from './utils/speedMath.ts';
import { UIController } from './components/UIController.ts';
import { ChartPlotter } from './components/ChartPlotter.ts';
import { LatencyEngine } from './components/NetworkEngine/LatencyEngine.ts';
import { DownloadEngine } from './components/NetworkEngine/DownloadEngine.ts';
import { UploadEngine } from './components/NetworkEngine/UploadEngine.ts';

// ---------------------------------------------------------------------------
// Application bootstrap
// ---------------------------------------------------------------------------

const appRoot = document.getElementById('app') as HTMLDivElement;
appRoot.innerHTML = appSvgRaw;

const config: SpeedTestConfig = parseConfig(window.location.href);
const ui = new UIController();
ui.init();

// Show the app (fade out loader, fade in SVG)
ui.showApp();

console.log('OpenSpeedTest.com V3.0 (Vite + TypeScript) Loaded!');
console.log('Now Press the Start Button or HIT Enter.');

// ---------------------------------------------------------------------------
// Speed Test Engine (state machine)
// ---------------------------------------------------------------------------

let isRunning = false;

async function runSpeedTest(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  // Remove event listeners to prevent double-start
  ui.getStartButtonDesk().removeEventListener('click', onStartClick);
  ui.getStartButtonMob().removeEventListener('click', onStartClick);
  document.removeEventListener('keypress', onEnterPress);

  // Transition to test UI
  await ui.showUI();

  // --- Phase: Ping ---
  ui.showStatus('Milliseconds');
  const latencyEngine = new LatencyEngine(config);
  const latencyResult = await latencyEngine.selectBestServer(
    config.openSpeedTestServerList,
    (ping, jitter) => {
      ui.showLiveSpeed(ping, 'Ping');
      ui.showPingResult(ping);
      ui.showJitterResult(jitter);
    },
  );

  if (!latencyResult) {
    ui.showStatus('Check your network connection status.');
    ui.showConnectionError();
    ui.setLiveSpeedText('Network Error');
    isRunning = false;
    return;
  }

  const bestServer: ServerConfig = latencyResult.server;
  ui.showLiveSpeed(latencyResult.ping, 'Ping');
  ui.showPingResult(latencyResult.ping);
  ui.showJitterResult(latencyResult.jitter);

  // If only ping test was selected, stop here
  if (config.selectTestType === 'Ping') {
    finishTest(0, 0, latencyResult.ping, latencyResult.jitter, 0, 0);
    return;
  }

  // --- Phase: Download ---
  let downloadSpeed = 0;
  let dataUsedForDl = 0;

  if (config.selectTestType === 'All' || config.selectTestType === 'Download') {
    ui.showStatus('Initializing..');
    ui.setSymbol('download');

    const dlAvgTracker = new AvgSpeedTracker();
    const dlChart = new ChartPlotter();
    const downloadEngine = new DownloadEngine(config);

    const dlFinal = Math.min(config.dlDuration * 0.6, 7);
    let dlStarted = false;
    let dlExtraTime = 0;
    const dlStartTime = performance.now();

    // Wrap download in a promise that resolves after dlDuration
    downloadSpeed = await new Promise<number>((resolve) => {
      downloadEngine.start(bestServer.Download, (p) => {
        if (!dlStarted) {
          dlStarted = true;
          dlExtraTime = (performance.now() - dlStartTime) / 1000;
          ui.startProgress(true, config.dlDuration + 2.5);
        }

        ui.showStatus('Mbps download');
        ui.mainGaugeProgress(p.currentSpeed);
        ui.showLiveSpeed(p.currentSpeed);
        dlChart.addDataPoint(p.currentSpeed);
        dlChart.render(ui.getGraphc1(), 'line');

        // Show graph on mobile
        ui.getGraphMob2().style.display = 'none';
        ui.getGraphMob1().style.display = 'block';

        const avgSpeed = dlAvgTracker.calculate(
          p.currentSpeed,
          dlFinal,
          config.dlDuration + dlExtraTime,
        );

        // Check if duration exceeded
        if (p.elapsedSec >= config.dlDuration + dlExtraTime) {
          downloadEngine.stop();
          dataUsedForDl = downloadEngine.getTotalLoaded();
          ui.showDownloadResult(avgSpeed);
          resolve(avgSpeed);
        }
      });

      // Safety timeout in case no progress events fire
      setTimeout(() => {
        downloadEngine.stop();
        dataUsedForDl = downloadEngine.getTotalLoaded();
        const finalSpeed = dlAvgTracker.calculate(0, dlFinal, config.dlDuration);
        ui.showDownloadResult(finalSpeed);
        resolve(finalSpeed);
      }, (config.dlDuration + 10) * 1000);
    });

    // Animate gauge back to zero
    if (config.selectTestType === 'Download') {
      await ui.gaugeProgressToZero(downloadSpeed);
      ui.setSymbol('none');
      finishTest(downloadSpeed, 0, latencyResult.ping, latencyResult.jitter, dataUsedForDl, 0);
      return;
    }

    await ui.gaugeProgressToZero(downloadSpeed);
  }

  // --- Phase: Upload ---
  let uploadSpeed = 0;
  let dataUsedForUl = 0;

  if (config.selectTestType === 'All' || config.selectTestType === 'Upload') {
    ui.setSymbol('upload');
    ui.showStatus('Initializing..');
    ui.setLiveSpeedText('...');

    // Generate random data blob for upload
    const blob = generateRandomBlob(config.ulDataSize);

    const ulAvgTracker = new AvgSpeedTracker();
    const ulChart = new ChartPlotter();
    const uploadEngine = new UploadEngine(config);

    const ulFinal = Math.min(config.ulDuration * 0.6, 7);
    let ulStarted = false;
    let ulExtraTime = 0;
    const ulStartTime = performance.now();

    uploadSpeed = await new Promise<number>((resolve) => {
      uploadEngine.start(bestServer.Upload, blob, (p) => {
        if (!ulStarted) {
          ulStarted = true;
          ulExtraTime = (performance.now() - ulStartTime) / 1000;
          ulAvgTracker.reset();
          ui.startProgress(false, config.ulDuration + 2.5);
        }

        ui.showStatus('Mbps upload');
        ui.mainGaugeProgress(p.currentSpeed);
        ui.showLiveSpeed(p.currentSpeed);
        ulChart.addDataPoint(p.currentSpeed);
        ulChart.render(ui.getGraphc2(), 'line2');

        // Show graph on mobile
        ui.getGraphMob1().style.display = 'none';
        ui.getGraphMob2().style.display = 'block';

        const avgSpeed = ulAvgTracker.calculate(
          p.currentSpeed,
          ulFinal,
          config.ulDuration + ulExtraTime,
        );

        if (p.elapsedSec >= config.ulDuration + ulExtraTime) {
          uploadEngine.stop();
          dataUsedForUl = uploadEngine.getTotalLoaded();
          ui.showUploadResult(avgSpeed);
          resolve(avgSpeed);
        }
      });

      // Safety timeout
      setTimeout(() => {
        uploadEngine.stop();
        dataUsedForUl = uploadEngine.getTotalLoaded();
        const finalSpeed = ulAvgTracker.calculate(0, ulFinal, config.ulDuration);
        ui.showUploadResult(finalSpeed);
        resolve(finalSpeed);
      }, (config.ulDuration + 10) * 1000);
    });

    await ui.gaugeProgressToZero(uploadSpeed);
    ui.setSymbol('none');
  }

  finishTest(
    downloadSpeed,
    uploadSpeed,
    latencyResult.ping,
    latencyResult.jitter,
    dataUsedForDl,
    dataUsedForUl,
  );
}

function finishTest(
  dlSpeed: number,
  ulSpeed: number,
  ping: number,
  jitter: number,
  dlData: number,
  ulData: number,
): void {
  ui.showStatus('All done');
  ui.setLiveSpeedText('OpenSpeedTest\u2122');

  // Build results link
  const userAgent = navigator.userAgent || 'Not Found';
  const resultsUrl =
    `https://openspeedtest.com/results/show.php?` +
    `&d=${dlSpeed.toFixed(3)}&u=${ulSpeed.toFixed(3)}` +
    `&p=${ping}&j=${jitter}` +
    `&dd=${(dlData / 1048576).toFixed(3)}&ud=${(ulData / 1048576).toFixed(3)}` +
    `&ua=${userAgent}`;
  ui.setResultsLink(encodeURI(resultsUrl));

  // Save data if configured
  if (config.saveData && config.saveDataURL) {
    const saveXhr = new XMLHttpRequest();
    saveXhr.open('POST', config.saveDataURL, true);
    saveXhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    saveXhr.send(encodeURI(resultsUrl));
  }

  isRunning = false;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onStartClick(): void {
  runSpeedTest();
}

function onEnterPress(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    runSpeedTest();
  }
}

// Bind start events
ui.getStartButtonDesk().addEventListener('click', onStartClick);
ui.getStartButtonMob().addEventListener('click', onStartClick);
document.addEventListener('keypress', onEnterPress);

// Auto-run support
if (config.autoRunDelay !== null) {
  const delay = config.autoRunDelay;
  if (delay > 0) {
    ui.showUI().then(() => {
      ui.showStatus('Automatic Test Starts in ...');
      let remaining = Math.ceil(Math.abs(delay));
      const countdown = setInterval(() => {
        remaining -= 1;
        ui.showLiveSpeed(remaining, 'countDown');
        if (remaining <= 0) {
          clearInterval(countdown);
          runSpeedTest();
        }
      }, 1000);
    });
  } else {
    runSpeedTest();
  }
}
