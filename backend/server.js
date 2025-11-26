import express from "express";
import http from "http";
import dotenv from "dotenv";
import authRoutes from "./auth/routes.js";
import { startWebsocketServer } from "./websocket.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// API route
app.use("/api/auth", authRoutes);

// HLS vystup
const hlsOutputDir = path.join(__dirname, "hls", "output");
console.log("Serving HLS from:", hlsOutputDir);
app.use("/hls", express.static(hlsOutputDir));

// HTTP server
const server = http.createServer(app);

// WebSocket server pro broadcaster
startWebsocketServer(server, hlsOutputDir);

const PORT = 3001;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
