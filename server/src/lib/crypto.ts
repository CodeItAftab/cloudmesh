// How encryption and decryption works:

// 1. The `encryptToken` function takes a plaintext string as input and performs the following steps:
//    - Generates a random 12-byte initialization vector (IV) using `randomBytes`.
//    - Creates a cipher instance using the AES-256-GCM algorithm, the provided key, and the generated IV.
//    - Encrypts the plaintext string using the cipher instance and concatenates the resulting encrypted data.
//    - Retrieves the authentication tag from the cipher instance.
//    - Returns a Buffer that concatenates the IV, authentication tag, and encrypted data.

// 2. The `decryptToken` function takes a Buffer containing the stored encrypted data as input and performs the following steps:
//    - Extracts the IV (first 12 bytes), authentication tag (next 16 bytes), and encrypted data (remaining bytes) from the input Buffer.
//    - Creates a decipher instance using the AES-256-GCM algorithm, the provided key, and the extracted IV.
//    - Sets the authentication tag on the decipher instance.
//    - Decrypts the encrypted data using the decipher instance and concatenates the resulting decrypted data.
//    - Returns the decrypted plaintext string.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(config.TOKEN_ENCRYPTION_KEY, "base64");

if (key.length !== 32) {
  throw new Error(
    "Invalid encryption key length. Expected 32 bytes for AES-256-GCM.",
  );
}

export function encryptToken(plaintext: string): Buffer {
  const iv = randomBytes(12); // AES-GCM standard IV length is 12 bytes
  const cipher = createCipheriv(ALGORITHM, key, iv); // Create cipher instance
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]); // Encrypt the plaintext

  const authTag = cipher.getAuthTag(); // Get the authentication tag
  return Buffer.concat([iv, authTag, encrypted]); // Return IV + Auth Tag + Encrypted Data
}

export function decryptToken(stored: Buffer): string {
  const iv = stored.subarray(0, 12); // Extract the IV (first 12 bytes)
  const authTag = stored.subarray(12, 28); // Extract the Auth Tag (next 16 bytes)
  const encrypted = stored.subarray(28); // Extract the Encrypted Data (remaining bytes)

  const decipher = createDecipheriv(ALGORITHM, key, iv); // Create decipher instance
  decipher.setAuthTag(authTag); // Set the authentication tag
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]); // Decrypt the data

  return decrypted.toString("utf-8"); // Return the decrypted plaintext
}
