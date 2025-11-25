import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Auth backend running on port ${PORT}`);
});
