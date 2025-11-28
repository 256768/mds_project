import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { verifyToken } from "./auth/verify.js";

export function startWebsocketServer(server, hlsOutputDir) {
  if (!fs.existsSync(hlsOutputDir)) {
    fs.mkdirSync(hlsOutputDir, { recursive: true });
  }

  const wss = new WebSocketServer({ server, path: "/broadcast" });

  wss.on("connection", (ws, req) => {
    console.log("📡 Připojen nový WS klient:", req.socket.remoteAddress);

    const token = new URL(req.url, "http://localhost").searchParams.get("token");
    const user = verifyToken(token);
    const name = new URL(req.url, `http://${req.headers.host}`).searchParams.get("name"); // to be displayed in six-view

    if (!user || user.role !== "broadcaster") {
      console.log("❌ Neoprávněný uživatel, zavírám WS");
      ws.close();
      return;
    }

    console.log("✅ Broadcaster připojen:", user);

    

const ffmpegArgs = [
  // input
  "-i", "pipe:0",
  "-map", "0:v", "-map", "0:a",

  // send 360p, 480p, 720p and source quality to nginx hls (using RTMP)
  "-c:v","libx264", "-c:a","aac", "-b:v", "256k", "-b:a", "32k", "-vf", "scale='640:360'",
  "-preset", "veryfast", "-f", "flv", "rtmp://localhost/hls/stream_360",
  "-c:v","libx264", "-c:a","aac", "-b:v", "384k", "-b:a", "64k", "-vf", "scale='854:480'",
  "-preset", "veryfast", "-f", "flv", "rtmp://localhost/hls/stream_480",
  "-c:v","libx264", "-c:a","aac", "-b:v", "1920k", "-b:a", "128k", "-vf", "scale='1280:720'",
  "-preset", "veryfast", "-f", "flv", "rtmp://localhost/hls/stream_720",
  "-c:v","libx264", "-c:a","aac", "-f", "flv", "rtmp://localhost:1935/hls/stream_src"

  /*"-filter_complex",
    "[0:v]split=3[v1080][v720][v480];" +
    "[v1080]scale=-2:1080[v1080out];" +
    "[v720]scale=-2:720[v720out];" +
    "[v480]scale=-2:480[v480out];" +
    "[0:a]asplit=3[a1080][a720][a480]",

  // video map
  "-map", "[v1080out]",
  "-map", "[v720out]",
  "-map", "[v480out]",

  // audio map (3 samostatné streamy)
  "-map", "[a1080]",
  "-map", "[a720]",
  "-map", "[a480]",

  // video kodeky
  "-c:v:0","libx264","-b:v:0","8000k","-preset","veryfast","-tune","zerolatency",
  "-c:v:1","libx264","-b:v:1","4000k","-preset","veryfast","-tune","zerolatency",
  "-c:v:2","libx264","-b:v:2","1500k","-preset","veryfast","-tune","zerolatency",

  // audio kodeky
  "-c:a:0", "aac", "-b:a:0", "128k",
  "-c:a:1", "aac", "-b:a:1", "128k",
  "-c:a:2", "aac", "-b:a:2", "128k",

  "-f","hls",
  "-hls_time","4",
  "-hls_playlist_type","event",
  "-hls_segment_filename", path.join(hlsOutputDir,"seg_%v_%03d.ts"),
  "-master_pl_name","master.m3u8",

  "-var_stream_map",
    "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",

  path.join(hlsOutputDir,"stream_%v.m3u8")*/
];



    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stderr.on("data", d => console.log("FFmpeg:", d.toString()));
    ffmpeg.on("close", () => console.log("FFmpeg ukončen"));

    ws.on("message", data => {
      try {
        console.log("📥 Přišla data, velikost:", data.length);
        ffmpeg.stdin.write(data);
      } catch (err) {
        console.log("❌ Chyba při zápisu do FFmpeg:", err.message);
      }
    });

    ws.on("close", () => {
      console.log("⛔ Broadcaster odpojen");
      ffmpeg.stdin.end();
    });

    ws.on("error", err => console.log("❌ WS chyba:", err));
  });
}
