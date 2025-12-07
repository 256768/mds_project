import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import fs from "fs";
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

    if (!name || name == "") {
      console.log("❌ Nelze streamovat beze jména");
      ws.close();
      return;
    }

    if (!user || user.role !== "broadcaster") {
      console.log("❌ Neoprávněný uživatel, zavírám WS");
      ws.close();
      return;
    }

    console.log("✅ Broadcaster připojen:", user);

    const ffmpegArgs = [
      "-i", "pipe:0",
      "-preset", "veryfast",
      "-c:v", "libx264", "-c:a", "aac", "-r", "30",
      "-vf", "drawtext=fontfile=arial.ttf:text='"+name+"':fontcolor=white:fontsize=72:box=1:boxcolor=black@0.5:boxborderw=5:x=20:y=20, scale=1280:720",
      "-f", "flv", "rtmp://localhost:1935/broadcasters/"+name
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs, {stdio: ["pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe", "pipe"]});

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
