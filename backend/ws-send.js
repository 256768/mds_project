import WebSocket from "ws";
import fs from "fs";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnJvYWRjYXN0ZXIiLCJpYXQiOjE3NjQxNTAwMTIsImV4cCI6MTc2NDE1NzIxMn0.JeL8CAnqBrkub5dHe3yRoz94RjZGVnuURsbb_HibaPA"; // z login endpointu
const ws = new WebSocket(`ws://localhost:3001/ws/stream?token=${TOKEN}`);

ws.on("open", () => {
  console.log("📡 WS připojen, posílám video");

  const readStream = fs.createReadStream("input.mp4");
  readStream.on("data", chunk => ws.send(chunk));
  readStream.on("end", () => ws.close());
});

ws.on("close", () => console.log("⛔ WS zavřen"));
ws.on("error", e => console.log("❌ WS error:", e));
