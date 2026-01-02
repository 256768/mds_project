import http from "http";
import dotenv from "dotenv";
import authRoutes from "./auth/routes.js";
import { startWebsocketServer } from "./websocket.js";
import express from "express";
import cors from "cors";
import { transcode } from "./transcode.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// api route pro auth
app.use("/auth", authRoutes);

// http server pro api a websocket
const server = http.createServer(app);

// websocket server
startWebsocketServer(server);

// start transkódování s periodickou kontrolou
setInterval(transcode, 5000);

// spuštění serveru
const PORT = 3000;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
