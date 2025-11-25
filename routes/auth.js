import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { generateStreamKey } from "../utils/streamKey.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Fake user databáze — můžeš nahradit DB
const USERS = [
  {
    id: 1,
    username: "streamer",
    passwordHash: bcrypt.hashSync("heslo123", 10)
  }
];

// --------------------------
//        /login
// --------------------------
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = USERS.find(u => u.username === username);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
  );

  res.json({ token });
});

// --------------------------
//        /start-stream
// --------------------------
router.post("/start-stream", authMiddleware, (req, res) => {
  const userId = req.user.id;

  // Vygenerujeme unikátní stream key pro uživatele
  const key = generateStreamKey(userId);

  res.json({
    streamKey: key,
    message: "Stream can be started"
  });
});

export default router;
