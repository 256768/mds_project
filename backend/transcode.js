// transcode.js
import { XMLParser } from 'fast-xml-parser';
import { spawn } from "child_process";
import { deepEqual } from 'fast-equals';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

let ffmpeg;
let previousUrls = [];

// --- Pomocník: zjisti, zda RTMP vstup obsahuje video/audio pomocí ffprobe
async function probeStreams(rtmpUrl) {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-select_streams", "v,a",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      rtmpUrl
    ];
    const p = spawn("ffprobe", args);
    let out = "";
    p.stdout.on("data", d => out += d.toString());
    p.on("close", () => {
      const types = out.split(/\r?\n/).filter(Boolean);
      const hasVideo = types.includes("video");
      const hasAudio = types.includes("audio");
      resolve({ hasVideo, hasAudio });
    });
    p.on("error", () => resolve({ hasVideo: false, hasAudio: false }));
  });
}

// --- Krátké čekání na skutečné video na RTMP vstupu
async function waitForVideo(rtmpUrl, timeoutMs = 8000, intervalMs = 500) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { hasVideo } = await probeStreams(rtmpUrl);
    if (hasVideo) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

// --- Načtení RTMP stats z Nginxu
async function fetchStats() {
  const res = await fetch('https://localhost/stats');
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const text = await res.text();
  const parser = new XMLParser();
  const data = await parser.parse(text);
  return data;
}

// --- Vytažení URL broadcasterů z XML
function broadcasterRtmpUrls(stats) {
  const app = stats?.rtmp?.server?.application;
  if (!app) return [];
  const broadcasters = Array.isArray(app) ? app.find(a => a.name === "broadcasters") : (app.name === "broadcasters" ? app : null);
  if (!broadcasters) return [];
  const streams = broadcasters.live?.stream;
  if (streams == undefined) return [];
  const streamsArray = Array.isArray(streams) ? streams : [streams];
  return streamsArray.map(s => `rtmp://localhost:1935/broadcasters/${s.name}`);
}

// --- Počkej na stabilní seznam URL
async function waitForStableUrls(checkInterval = 1000, stableChecks = 2, timeout = 20000) {
  let last = null;
  let stableCount = 0;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const stats = await fetchStats();
      const urls = broadcasterRtmpUrls(stats);
      if (last && deepEqual(last, urls)) {
        stableCount++;
      } else {
        stableCount = 1;
        last = urls;
      }
      if (stableCount >= stableChecks) {
        return urls;
      }
    } catch (err) {
      console.log("Chyba při načítání stats:", err.message);
    }
    await new Promise(r => setTimeout(r, checkInterval));
  }
  return last || [];
}

// --- Hlavní funkce: transkodování s audio mapováním z prvního dostupného RTMP s audio
async function transcodeBroadcasts(urls){
  if (deepEqual(previousUrls, urls)) return null;
  previousUrls = urls;

  if (urls.length === 0) {
    console.log("Žádné zdroje pro transkódování.");
    return null;
  }

  console.log("Spouštím transkódování pro:", urls);

  const streamsInGrid = 6;

  // ukončíme předchozí ffmpeg pokud běží
  if (ffmpeg) {
    try { ffmpeg.stdin.end(); } catch(e){}
    try { ffmpeg.kill("SIGTERM"); } catch(e){}
    ffmpeg = undefined;
  }

  const ffmpegArgs = [];
  const videoRefs = []; // např. [0:v][2:v]...
  let audioMapInputIndex = null; // index vstupu, ze kterého budeme mapovat audio (např. "3:a")
  let inputIdx = 0;

  // nejprve přidáme RTMP vstupy a případné placeholdery
  for (const url of urls) {
    await waitForVideo(url, 8000, 500);
    const { hasVideo, hasAudio } = await probeStreams(url);

    // přidej RTMP vstup jako "-f flv -i url"
    ffmpegArgs.push("-f", "flv", "-i", url);
    const rtmpIndex = inputIdx;
    inputIdx++; // po přidání "-i" se index zvyšuje

    // video reference
    if (hasVideo) {
      videoRefs.push(`[${rtmpIndex}:v]`);
    } else {
      // přidej nullsrc jako další "-i"
      ffmpegArgs.push("-f", "lavfi", "-i", "nullsrc=size=640x480:rate=25");
      videoRefs.push(`[${inputIdx}:v]`);
      inputIdx++;
    }

    // audio: pokud má tento RTMP audio a ještě nemáme audioMapInputIndex, použij ho
    if (hasAudio && audioMapInputIndex === null) {
      audioMapInputIndex = rtmpIndex; // mapujeme audio z tohoto RTMP vstupu
    }
    // pokud nemá audio, přidáme anullsrc jako další "-i" a použijeme ho jen pokud audioMapInputIndex není nastaven
    if (!hasAudio) {
      ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      // pokud audioMapInputIndex ještě není nastaven, použij tento placeholder
      if (audioMapInputIndex === null) {
        audioMapInputIndex = inputIdx;
      }
      inputIdx++;
    }
  }

  // doplnění placeholderů tak, aby bylo streamsInGrid vstupů (video + audio placeholdery)
  const pads = Math.max(0, streamsInGrid - urls.length);
  for (let i = 0; i < pads; i++) {
    ffmpegArgs.push("-f", "lavfi", "-i", "nullsrc=size=640x480:rate=25");
    videoRefs.push(`[${inputIdx}:v]`);
    inputIdx++;
    ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    // pokud audioMapInputIndex ještě není nastaven, použij tento placeholder
    if (audioMapInputIndex === null) audioMapInputIndex = inputIdx;
    inputIdx++;
  }

  // kontrola: videoRefs musí mít streamsInGrid položek
  if (videoRefs.length !== streamsInGrid) {
    console.log("Chyba: neočekávaný počet videoRefs", videoRefs.length);
    return null;
  }

  // pokud audioMapInputIndex stále null (teoreticky by neměl být), přidej anullsrc a nastav ho
  if (audioMapInputIndex === null) {
    ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    audioMapInputIndex = inputIdx;
    inputIdx++;
  }

  // sestavení filtergraph pouze pro video (xstack) a scale; audio mapujeme přímo z audioMapInputIndex
  const layout = "0_0|0_h0|w0_0|w0_h0|w0+w3_0|w0+w3_h0";
  const xstackInputs = videoRefs.join('');
  const xstack = `${xstackInputs}xstack=inputs=${streamsInGrid}:layout=${layout}:fill=black:shortest=1[v]`;
  const filterComplex = `${xstack};[v]scale=640:360[360p];[v]scale=854:480[480p];[v]scale=1280:720[720p]`;

  ffmpegArgs.push("-filter_complex", filterComplex);

  // mapování výstupů: video z [360p]/[480p]/[720p], audio z audioMapInputIndex (např. "3:a")
  const audioMap = `${audioMapInputIndex}:a`;
  ffmpegArgs.push(
    "-map","[360p]","-map",audioMap,"-c:v","libx264","-c:a","aac","-b:v","256k","-b:a","32k","-ac","2","-preset","veryfast","-f","flv","rtmp://localhost:1935/hls/stream_360",
    "-map","[480p]","-map",audioMap,"-c:v","libx264","-c:a","aac","-b:v","384k","-b:a","64k","-ac","2","-preset","veryfast","-f","flv","rtmp://localhost:1935/hls/stream_480",
    "-map","[720p]","-map",audioMap,"-c:v","libx264","-c:a","aac","-b:v","1920k","-b:a","128k","-ac","2","-preset","veryfast","-f","flv","rtmp://localhost:1935/hls/stream_720"
  );

  console.log("FFmpeg args:", ffmpegArgs.join(' '));

  ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });

  const readyPromise = new Promise((resolve, reject) => {
    let resolved = false;

    ffmpeg.stderr.on("data", d => {
      const s = d.toString();
      console.log("Transkódovací FFmpeg:", s);
      if (!resolved && s.includes("Press [q] to stop")) {
        resolved = true;
        resolve();
      }
    });

    ffmpeg.on("close", (code, signal) => {
      ffmpeg = undefined;
      if (!resolved) reject(new Error(`FFmpeg ukončen před startem, code=${code} signal=${signal}`));
    });

    ffmpeg.on("error", err => {
      ffmpeg = undefined;
      if (!resolved) reject(err);
    });

    // safety timeout: pokud se nic neobjeví do 10s, resolve i tak (neblokovat)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 10000);
  });

  return { ffmpeg, readyPromise };
}

// --- Periodická kontrola
export async function transcode() {
  try {
    const urls = await waitForStableUrls(1000, 2, 20000);
    const res = await transcodeBroadcasts(urls);
    if (res && res.readyPromise) {
      res.readyPromise
        .then(() => console.log("Transcode: FFmpeg je připraven"))
        .catch(e => console.log("Transcode ready error:", e.message));
    }
  } catch (err) {
    console.log("Transcode error:", err);
  }
}

// --- Spuštění jednou a čekání na start FFmpegu
export async function startTranscodeAndWait(opts = { checkInterval: 1000, stableChecks: 2, timeout: 20000 }) {
  const urls = await waitForStableUrls(opts.checkInterval, opts.stableChecks, opts.timeout);
  const res = await transcodeBroadcasts(urls);
  if (res && res.readyPromise) {
    await res.readyPromise;
  }
  return urls;
}

// --- Zastavení FFmpegu
export function stopTranscode() {
  if (ffmpeg) {
    try { ffmpeg.stdin.end(); } catch(e){}
    try { ffmpeg.kill("SIGTERM"); } catch(e){}
    ffmpeg = undefined;
    console.log("FFmpeg proces zastaven.");
  }
}
