import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";

const MASTER_KEY_STORAGE_KEY = "cloudmesh_master_key";

async function randomHex(byteLength: number): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getLocalMasterKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(MASTER_KEY_STORAGE_KEY);
}

export async function saveMasterKeyLocally(
  masterKeyHex: string,
): Promise<void> {
  await SecureStore.setItemAsync(MASTER_KEY_STORAGE_KEY, masterKeyHex);
}

/**
 * Call this once, right after confirming login, on every device.
 * Server is the source of truth: if it already has a key, fetch and cache
 * it locally. Only generate + push a new one if the server has none at all --
 * this is what prevents two devices from generating conflicting keys.
 */

export async function syncMasterkey(
  fetchServerKey: () => Promise<string | null>,
  pushServerKey: (masterKeyHex: string) => Promise<void>,
) {
  const localKey = await getLocalMasterKey();
  if (localKey) {
    return localKey;
  }

  const serverKey = await fetchServerKey();
  if (serverKey) {
    await saveMasterKeyLocally(serverKey);
    return serverKey;
  }

  const masterKeyHex = await randomHex(32);
  await saveMasterKeyLocally(masterKeyHex);
  await pushServerKey(masterKeyHex);
  return masterKeyHex;
}

/** Derives a per-file AES key from the master key + that file's own IV. */
export function deriveFileKey(
  masterKeyHex: string,
  fileEncryptionIv: string,
): string {
  return CryptoJS.PBKDF2(masterKeyHex, fileEncryptionIv, {
    keySize: 256 / 32,
    iterations: 10_000,
  }).toString();
}

/** Derives the per-chunk AES key + IV from a file's key and that chunk's index. */
export function deriveChunkCipherParams(
  fileKeyHex: string,
  chunkIndex: number,
) {
  const material = CryptoJS.SHA256(`${fileKeyHex}:${chunkIndex}`);
  const hex = material.toString(CryptoJS.enc.Hex);
  const key = CryptoJS.enc.Hex.parse(hex.slice(0, 64));
  const iv = CryptoJS.enc.Hex.parse(hex.slice(64, 96));

  return { key, iv };
}
