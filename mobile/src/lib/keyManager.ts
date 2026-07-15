import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { pbkdf2Sync, createHash } from "react-native-quick-crypto";
import { Buffer } from "buffer";

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

/**
 * Derives a per-file AES key from the master key + that file's own IV.
 *
 * Ported from CryptoJS.PBKDF2 to quick-crypto's pbkdf2Sync.
 * "sha1" matches CryptoJS.PBKDF2's default hasher (it defaults to SHA1
 * when no `hasher` option is passed, which the original code never set).
 * keySize 256/32 (CryptoJS "words", 4 bytes each) = 32 bytes = 256 bits.
 */
export function deriveFileKey(
  masterKeyHex: string,
  fileEncryptionIv: string,
): string {
  const derived = pbkdf2Sync(
    masterKeyHex,
    fileEncryptionIv,
    10_000,
    32,
    "sha1",
  );
  return Buffer.from(derived).toString("hex");
}

/**
 * Derives the per-chunk AES key + IV from a file's key and that chunk's index.
 *
 * FIXED from the original: a single SHA256 digest is only 32 bytes, exactly
 * enough for the AES key, leaving nothing to slice a 16-byte IV from — the
 * original silently produced an empty/invalid IV past the string's end.
 * This version derives key and IV from two domain-separated SHA256 hashes
 * instead. This is a scheme change: ciphertext from the old derivation
 * cannot be decrypted with this version.
 */
export function deriveChunkCipherParams(
  fileKeyHex: string,
  chunkIndex: number,
): { key: Buffer; iv: Buffer } {
  const keyMaterial = createHash("sha256")
    .update(`${fileKeyHex}:${chunkIndex}:key`)
    .digest();

  const ivMaterial = createHash("sha256")
    .update(`${fileKeyHex}:${chunkIndex}:iv`)
    .digest();

  const key = Buffer.from(keyMaterial);
  const iv = Buffer.from(ivMaterial.subarray(0, 16));

  return { key, iv };
}
