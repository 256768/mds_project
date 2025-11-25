import crypto from "crypto";

export function generateStreamKey(userId) {
  return `${userId}-${crypto.randomBytes(12).toString("hex")}`;
}
