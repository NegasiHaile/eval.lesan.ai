import crypto from "crypto";

export function generateResetToken() {
  return crypto.randomBytes(128).toString("hex");
}
