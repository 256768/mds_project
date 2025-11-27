import http from "http";
import dotenv from "dotenv";
import authRoutes from "./auth/routes.js";
import { startWebsocketServer } from "./websocket.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// api route pro auth
app.use("/api/auth", authRoutes);

// http server pro api a websocket
const server = http.createServer(app);

// cesta k hls pro websocket (hls serviruje nginx)
const hlsOutputDir = path.join(__dirname, "hls", "output");
console.log("HLS output directory (for WebSocket):", hlsOutputDir);

// websocket server
startWebsocketServer(server, hlsOutputDir);

// spuštění serveru
const PORT = 3001;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
