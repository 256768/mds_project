import { XMLParser } from 'fast-xml-parser';
import { spawn, spawnSync } from "child_process";
import { deepEqual } from 'fast-equals';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // nekontrolovat vydavatele certifikátu

let ffmpeg;
let previousStreams = [];

const FONTFILE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// --- fetch stats from nginx-rtmp stat endpoint
async function fetchStats() {
  const res = await fetch('https://localhost/stats');
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const text = await res.text();
  const parser = new XMLParser();
  const data = parser.parse(text);
  return data;
}

// --- extract broadcaster RTMP URLs and names from stats
function broadcasterRtmpStreams(stats) {
  if (!stats || !stats.rtmp || !stats.rtmp.server || !stats.rtmp.server.application) return [];
  const apps = Array.isArray(stats.rtmp.server.application) ? stats.rtmp.server.application : [stats.rtmp.server.application];
  const broadcastersApp = apps.find(a => a.name === "broadcasters");
  if (!broadcastersApp || !broadcastersApp.live) return [];
  const streams = broadcastersApp.live.stream;
  if (streams == undefined) return [];
  const streamsArray = Array.isArray(streams) ? streams : [streams];
  const result = [];
  streamsArray.forEach(stream => {
    if (stream && stream.name && ("active" in stream || stream.active === "1" || stream.active === 1)) {
      result.push({
        name: stream.name,
        url: `rtmp://localhost:1935/broadcasters/${stream.name}`
      });
    }
  });
  return result;
}

// --- probe helper using ffprobe (synchronous, short timeout)
function probeHasStreams(url) {
  try {
    const argsV = [
      "-v", "error",
      "-select_streams", "v",
      "-show_entries", "stream=codec_type",
      "-of", "default=noprint_wrappers=1:nokey=1",
      url
    ];
    const resV = spawnSync("ffprobe", argsV, { encoding: "utf8", timeout: 5000 });
    const hasVideo = !!(resV.stdout && resV.stdout.trim().length > 0);

    const argsA = [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=codec_type",
      "-of", "default=noprint_wrappers=1:nokey=1",
      url
    ];
    const resA = spawnSync("ffprobe", argsA, { encoding: "utf8", timeout: 5000 });
    const hasAudio = !!(resA.stdout && resA.stdout.trim().length > 0);

    return { hasVideo, hasAudio };
  } catch (e) {
    console.log("probeHasStreams error for", url, e && e.message);
    return { hasVideo: false, hasAudio: false };
  }
}

// --- main exported function to trigger transcode (call periodically)
export function transcode() {
  fetchStats()
    .then(stats => transcodeBroadcasts(stats))
    .catch(e => console.log("fetchStats error:", e && e.message));
}

// --- core transcode logic
async function transcodeBroadcasts(stats) {
  const streams = broadcasterRtmpStreams(stats);

  // pokud se nezměnily, nic nedělej
  if (deepEqual(previousStreams, streams)) return null;
  previousStreams = streams;

  // stop previous ffmpeg if running
  if (ffmpeg) {
    try { ffmpeg.stdin.end(); } catch (e) {}
    try { ffmpeg.kill("SIGTERM"); } catch (e) {}
    ffmpeg = undefined;
  }

  if (!streams || streams.length === 0) {
    console.log("Žádné zdroje pro transkódování.");
    return null;
  }

  console.log("Spouštím transkódování pro:", streams.map(s => s.name));

  // base ffmpeg args
  const ffmpegArgs = ["-loglevel", "info", "-probesize", "10M", "-analyzeduration", "20M"];
  const videoRefs = [];
  const audioRefs = [];
  const labelFilters = []; // drawtext filtry pro každý vstup
  let inputIndex = 0;
  let realInputs = 0;

  // Pro každý stream: probe a přidání vstupů + placeholderů + drawtext
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    let hasVideo = false, hasAudio = false;
    try {
      const probe = probeHasStreams(s.url);
      hasVideo = probe.hasVideo;
      hasAudio = probe.hasAudio;
    } catch (e) {
      console.log("probe error:", e && e.message);
    }

    // přidej RTMP vstup
    ffmpegArgs.push("-f", "flv", "-i", s.url);
    const rtmpIndex = inputIndex;
    inputIndex++;
    realInputs++;

    // video ref: pokud má video, použij jeho :v, jinak přidej color lavfi
    if (hasVideo) {
      // před drawtext chceme video upravit (scale) a přidat popisek; ale drawtext bude aplikován později
      videoRefs.push(`[${rtmpIndex}:v]`);
    } else {
      ffmpegArgs.push("-f", "lavfi", "-i", "color=size=1280x720:rate=30:color=black");
      videoRefs.push(`[${inputIndex}:v]`);
      inputIndex++;
    }

    // audio ref: pokud má audio, použij jeho :a, jinak přidej anullsrc
    if (hasAudio) {
      audioRefs.push(`[${rtmpIndex}:a]`);
    } else {
      ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      audioRefs.push(`[${inputIndex}:a]`);
      inputIndex++;
    }
    const safeName = s.name.replace(/[:'"]/g, "");

    labelFilters.push({
      inputRefIndex: videoRefs.length - 1,
      text: safeName
    });
  }

  const streamsInGrid = Math.min(6, Math.max(1, realInputs));

  while (videoRefs.length < streamsInGrid) {
    ffmpegArgs.push("-f", "lavfi", "-i", "color=size=1280x720:rate=30:color=black");
    videoRefs.push(`[${inputIndex}:v]`);
    inputIndex++;
    ffmpegArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    audioRefs.push(`[${inputIndex}:a]`);
    inputIndex++;
  }

  console.log("DEBUG videoRefs:", videoRefs);
  console.log("DEBUG audioRefs:", audioRefs);

  // layout map 
  const layoutMap = {
    2: "0_0|w0_0",
    3: "0_0|0_h0|w0_0",
    4: "0_0|w0_0|0_h0|w0_h0",
    5: "0_0|w0_0|2*w0_0|0_h0|w0_h0",
    6: "0_0|w0_0|2*w0_0|0_h0|w0_h0|2*w0_h0"
  };
  const layout = layoutMap[streamsInGrid] || layoutMap[6];

 
  const perInputFilters = [];
  const cellW = 640;
  const cellH = 360;

  for (let i = 0; i < streamsInGrid; i++) {
    const vin = videoRefs[i]; // např. [0:v]
    const name = (streams[i] && streams[i].name) ? streams[i].name.replace(/[:'"]/g, "") : "";
    const escapedName = name.replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/"/g, '\\"');
    const outLabel = `[v${i}]`;
    const filter = `${vin}scale=${cellW}:${cellH},drawtext=fontfile='${FONTFILE}':text='${escapedName}':fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=5:x=10:y=${cellH - 40}${outLabel}`;
    perInputFilters.push(filter);
  }

  const perInputsStr = perInputFilters.join(";");

  const xstackInputs = [];
  for (let i = 0; i < streamsInGrid; i++) xstackInputs.push(`[v${i}]`);
  const xstackInputsStr = xstackInputs.join('');

  let audioPart = "";
  if (audioRefs.length > 1) {
    const amixInputs = audioRefs.join('');
    audioPart = `${amixInputs}amix=inputs=${audioRefs.length}:dropout_transition=0[a];[a]asplit=3[a360p][a480p][a720p]`;
  } else {
    audioPart = `${audioRefs[0]}asplit=3[a360p][a480p][a720p]`;
  }

  let filterComplex = "";
  if (streamsInGrid === 1) {
    filterComplex = `${perInputsStr};[v0]split=3[v1][v2][v3];[v1]scale=640:360[360p];[v2]scale=854:480[480p];[v3]scale=1280:720[720p];${audioPart}`;
  } else {
    filterComplex = `${perInputsStr};${xstackInputsStr}xstack=inputs=${streamsInGrid}:layout=${layout}:fill=black:shortest=1[vgrid];[vgrid]split=3[v1][v2][v3];` +
                    `[v1]scale=640:360[360p];[v2]scale=854:480[480p];[v3]scale=1280:720[720p];` +
                    `${audioPart}`;
  }

  ffmpegArgs.push("-filter_complex", filterComplex);

  // map outputs (360p, 480p, 720p) to RTMP (Nginx HLS app)
  ffmpegArgs.push(
    // 360p
    "-map", "[360p]", "-map", "[a360p]",
    "-c:v", "libx264", "-b:v", "256k", "-preset", "veryfast",
    "-c:a", "aac", "-b:a", "32k", "-ac", "2",
    "-r", "30", "-f", "flv", "rtmp://localhost:1935/hls/stream_360",

    // 480p
    "-map", "[480p]", "-map", "[a480p]",
    "-c:v", "libx264", "-b:v", "384k", "-preset", "veryfast",
    "-c:a", "aac", "-b:a", "64k", "-ac", "2",
    "-r", "30", "-f", "flv", "rtmp://localhost:1935/hls/stream_480",

    // 720p
    "-map", "[720p]", "-map", "[a720p]",
    "-c:v", "libx264", "-b:v", "1920k", "-preset", "veryfast",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    "-r", "30", "-f", "flv", "rtmp://localhost:1935/hls/stream_720"
  );

  console.log("FFmpeg args:", ffmpegArgs.join(' '));
  console.log("Filter complex:", filterComplex);

  ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });

  ffmpeg.stderr.on("data", d => console.log("Transkódovací FFmpeg:", d.toString()));
  ffmpeg.on("close", (code, signal) => {
    console.log("Transkódování ukončeno, code=", code, "signal=", signal);
    ffmpeg = undefined;
  });
  ffmpeg.on("error", err => {
    console.log("FFmpeg error:", err);
    ffmpeg = undefined;
  });

  return { ffmpeg };
}

// --- stop transcode
export function stopTranscode() {
  if (ffmpeg) {
    try { ffmpeg.stdin.end(); } catch (e) {}
    try { ffmpeg.kill("SIGTERM"); } catch (e) {}
    ffmpeg = undefined;
    console.log("FFmpeg proces zastaven.");
  }
}
