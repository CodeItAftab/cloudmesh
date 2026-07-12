import { randomBytes } from "node:crypto";

export function generateRandomState(length: number = 16): string {
  return randomBytes(length).toString("hex");
}
