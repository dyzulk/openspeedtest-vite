export interface ServerConfig {
  ServerName: string;
  Download: string;
  Upload: string;
  ServerIcon: string;
}

export interface SpeedTestConfig {
  openSpeedTestServerList: ServerConfig[];
  pingSamples: number;
  jitterFinalSample: number;
  setPingSamples: boolean;
  pingTimeOut: number;
  setPingTimeout: boolean;
  pingMethod: string;
  pingFile: string;
  ulDataSize: number;
  ulDelay: number;
  dlDelay: number;
  upAdjust: number;
  dlAdjust: number;
  enableClean: boolean;
  dlDuration: number;
  ulDuration: number;
  dlThreads: number;
  ulThreads: number;
  setHTTPReq: boolean;
  saveData: boolean;
  saveDataURL: string;
  stressTest: boolean;
  selectTest: boolean;
  selectServer: boolean;
  enableRun: boolean;

  // Modern state mappings
  selectTestType: 'Download' | 'Upload' | 'Ping' | 'All';
  autoRunDelay: number | null; // null if auto run is disabled, otherwise delay in seconds
}

export const DEFAULT_CONFIG: SpeedTestConfig = {
  openSpeedTestServerList: [
    { ServerName: 'Home', Download: 'downloading', Upload: 'upload', ServerIcon: 'DefaultIcon' }
  ],
  pingSamples: 10,
  jitterFinalSample: 0.5,
  setPingSamples: true,
  pingTimeOut: 5000,
  setPingTimeout: true,
  pingMethod: 'GET',
  pingFile: 'Upload',
  ulDataSize: 30,
  ulDelay: 300,
  dlDelay: 300,
  upAdjust: 1.04,
  dlAdjust: 1.04,
  enableClean: true,
  dlDuration: 12,
  ulDuration: 12,
  dlThreads: 6,
  ulThreads: 6,
  setHTTPReq: true,
  saveData: false,
  saveDataURL: '//yourDatabase.Server.com:4500/save?data=',
  stressTest: true,
  selectTest: true,
  selectServer: true,
  enableRun: true,

  selectTestType: 'All',
  autoRunDelay: null,
};

export function isValidHttpUrl(str: string): boolean {
  const regex = /(?:https?):\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
  return regex.test(str);
}

export function parseConfig(urlStr: string, defaults: SpeedTestConfig = DEFAULT_CONFIG): SpeedTestConfig {
  const config = { ...defaults };
  
  // Safely parse URL
  let searchParams: URLSearchParams;
  try {
    const urlObj = new URL(urlStr.toLowerCase());
    searchParams = urlObj.searchParams;
  } catch {
    // Fallback if urlStr is just a query string or invalid URL
    try {
      const query = urlStr.includes('?') ? urlStr.split('?')[1] : urlStr;
      searchParams = new URLSearchParams(query.toLowerCase());
    } catch {
      return config;
    }
  }

  // Helper to get case-insensitive param
  const getParam = (keys: string[]): string | null => {
    for (const key of keys) {
      const val = searchParams.get(key.toLowerCase());
      if (val !== null) return val;
    }
    return null;
  };

  // 1. Ping Samples
  if (config.setPingSamples) {
    const pingParam = getParam(['ping', 'p']);
    if (pingParam !== null) {
      const parsedPing = parseInt(pingParam, 10);
      if (!isNaN(parsedPing) && parsedPing > 0) {
        config.pingSamples = parsedPing;
      }
    }
  }

  // 2. Ping Timeout
  if (config.setPingTimeout) {
    const outParam = getParam(['out', 'o']);
    if (outParam !== null) {
      const parsedOut = parseInt(outParam, 10);
      if (!isNaN(parsedOut) && parsedOut > 1) {
        config.pingTimeOut = parsedOut;
      }
    }
  }

  // 3. HTTP XHR threads
  if (config.setHTTPReq) {
    const xhrParam = getParam(['xhr', 'x']);
    if (xhrParam !== null) {
      const parsedThreads = parseInt(xhrParam, 10);
      if (!isNaN(parsedThreads) && parsedThreads > 0 && parsedThreads <= 32) {
        config.dlThreads = parsedThreads;
        config.ulThreads = parsedThreads;
      }
    }
  }

  // 4. Custom Host Server
  if (config.selectServer) {
    const hostParam = getParam(['host', 'h']);
    if (hostParam !== null && isValidHttpUrl(hostParam)) {
      config.openSpeedTestServerList = [
        {
          ServerName: 'Home',
          Download: `${hostParam}/downloading`,
          Upload: `${hostParam}/upload`,
          ServerIcon: 'DefaultIcon',
        }
      ];
    }
  }

  // 5. Stress Test Duration
  const stressParam = getParam(['stress', 's']);
  if (stressParam !== null && config.stressTest) {
    const stressLower = stressParam.toLowerCase();
    if (stressLower === 'low' || stressLower === 'l') {
      config.dlDuration = 300;
      config.ulDuration = 300;
    } else if (stressLower === 'medium' || stressLower === 'm') {
      config.dlDuration = 600;
      config.ulDuration = 600;
    } else if (stressLower === 'high' || stressLower === 'h') {
      config.dlDuration = 900;
      config.ulDuration = 900;
    } else if (stressLower === 'veryhigh' || stressLower === 'v') {
      config.dlDuration = 1800;
      config.ulDuration = 1800;
    } else if (stressLower === 'extreme' || stressLower === 'e') {
      config.dlDuration = 3600;
      config.ulDuration = 3600;
    } else if (stressLower === 'day' || stressLower === 'd') {
      config.dlDuration = 86400;
      config.ulDuration = 86400;
    } else if (stressLower === 'year' || stressLower === 'y') {
      config.dlDuration = 31557600;
      config.ulDuration = 31557600;
    } else {
      const parsedStress = parseInt(stressParam, 10);
      if (!isNaN(parsedStress) && parsedStress > 12) {
        config.dlDuration = parsedStress;
        config.ulDuration = parsedStress;
      }
    }
  }

  // 6. Overhead compensation clean values
  if (config.enableClean) {
    const cleanParam = getParam(['clean', 'c']);
    if (cleanParam !== null) {
      const parsedClean = parseInt(cleanParam, 10);
      if (!isNaN(parsedClean) && parsedClean >= 1 && parsedClean < 5) {
        config.upAdjust = 1 + parsedClean / 100;
        config.dlAdjust = 1 + parsedClean / 100;
      } else {
        config.upAdjust = 1;
        config.dlAdjust = 1;
      }
    }
  }

  // 7. Test selection
  if (config.selectTest) {
    const testParam = getParam(['test', 't']);
    if (testParam !== null) {
      const testLower = testParam.toLowerCase();
      if (testLower === 'download' || testLower === 'd') {
        config.selectTestType = 'Download';
      } else if (testLower === 'upload' || testLower === 'u') {
        config.selectTestType = 'Upload';
      } else if (testLower === 'ping' || testLower === 'p') {
        config.selectTestType = 'Ping';
      }
    }
  }

  // 8. Auto Run
  if (config.enableRun) {
    const runParam = getParam(['run', 'r']);
    if (runParam !== null) {
      const parsedRun = parseInt(runParam, 10);
      if (!isNaN(parsedRun) && parsedRun >= 0) {
        config.autoRunDelay = parsedRun;
      } else {
        config.autoRunDelay = 0;
      }
    }
  }

  return config;
}
