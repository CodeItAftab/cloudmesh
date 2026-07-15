import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy"; // still used for the picker-safe-copy step
import { File, Paths } from "expo-file-system"; // new byte-level API for chunk read/write
import { createCipheriv, createHash } from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { initUpload } from "../api/files";
import { deriveFileKey, deriveChunkCipherParams } from "../keyManager";
import { db } from "./uploadDb";
import { processUploadQueue } from "./uploadRunner";

export async function pickFiles() {
  const picked = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: false,
  });
  if (picked.canceled) return [];
  return picked.assets;
}

async function copyWithRetry(
  fromUri: string,
  toUri: string,
  retries = 2,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await FileSystem.copyAsync({ from: fromUri, to: toUri });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

const CHUNK_ENCRYPT_CONCURRENCY = 3;

/**
 * Encrypts a single chunk: reads its exact byte range from the source file
 * (no full-file read, no Base64), encrypts with native AES-256-CTR, writes
 * raw ciphertext bytes to a local chunk file, and inserts the DB row as
 * PENDING — making it immediately eligible for the upload runner to pick
 * up, even while sibling chunks are still being encrypted.
 */
async function encryptAndStoreChunk(
  sourceFile: File,
  fileKey: string,
  fileId: string,
  chunk: {
    chunkId: string;
    chunkIndex: number;
    byteOffset: number;
    sizeBytes: number;
    uploadUrl: string;
  },
): Promise<void> {
  if (!db) throw new Error("Database not initialized yet.");

  const byteOffset = Number(chunk.byteOffset);
  const sizeBytes = Number(chunk.sizeBytes);

  // Read only this chunk's byte range directly from disk.
  const handle = sourceFile.open();
  handle.offset = byteOffset;
  const plaintextBytes = await handle.readBytes(sizeBytes); // Uint8Array
  handle.close();

  const { key, iv } = deriveChunkCipherParams(fileKey, chunk.chunkIndex);

  const cipher = createCipheriv("aes-256-ctr", key, iv);
  const encryptedChunks: Uint8Array[] = [];
  encryptedChunks.push(cipher.update(plaintextBytes));
  encryptedChunks.push(cipher.final());

  const cipherBytes = Buffer.concat(encryptedChunks);
  const checksum = createHash("sha256").update(cipherBytes).digest("hex");

  const localChunkPath = `${Paths.cache.uri}/chunk_${chunk.chunkId}.bin`;
  const chunkFile = new File(localChunkPath);
  chunkFile.write(new Uint8Array(cipherBytes));

  await db.runAsync(
    `INSERT OR IGNORE INTO local_chunks (chunk_id, file_id, upload_url, local_path, bytes_sent, total_bytes, status, checksum) 
     VALUES (?, ?, ?, ?, 0, ?, 'PENDING', ?)`,
    [
      chunk.chunkId,
      fileId,
      chunk.uploadUrl,
      localChunkPath,
      sizeBytes,
      checksum,
    ],
  );

  // 🔧 Kick the upload runner as soon as this one chunk is ready — it
  // doesn't need to wait for the rest of this file, or other files, to
  // finish encrypting. processUploadQueue() is idempotent/guarded against
  // concurrent runs internally, so calling it repeatedly here is safe.
  processUploadQueue();
}

export async function queueUploads(
  assets: DocumentPicker.DocumentPickerAsset[],
  folderId: string | null,
  masterKeyHex: string,
  options?: {
    tempIds?: string[];
    onFileQueued?: (
      tempId: string,
      fileId: string,
      totalChunks: number,
    ) => void;
  },
): Promise<void> {
  if (!db) {
    throw new Error("Database not initialized yet.");
  }

  const localCopies = new Map<string, string>();
  const failedAssets: string[] = [];

  for (const asset of assets) {
    const safeInternalUri = `${FileSystem.documentDirectory}${Date.now()}_${asset.name}`;
    try {
      await copyWithRetry(asset.uri, safeInternalUri);
      localCopies.set(asset.uri, safeInternalUri);
    } catch (err) {
      console.warn(`Failed to copy ${asset.name} after retries:`, err);
      failedAssets.push(asset.name);
    }
  }

  if (failedAssets.length > 0) {
    throw new Error(
      `Could not access these files (try selecting them one at a time): ${failedAssets.join(", ")}`,
    );
  }

  const filesForInit = assets.map((a, i) => ({
    tempId: options?.tempIds?.[i] ?? `f${i}-${Date.now()}`,
    filename: a.name,
    sizeBytes: a.size ?? 0,
    mimeType: a.mimeType,
  }));

  const initResult = await initUpload(filesForInit, folderId);
  const { files: plannedFiles } = initResult;

  for (const plan of plannedFiles) {
    const asset = assets.find((_, i) => filesForInit[i].tempId === plan.tempId);
    if (!asset) continue;

    options?.onFileQueued?.(plan.tempId, plan.fileId, plan.chunks.length);

    await db.runAsync(
      `INSERT OR IGNORE INTO local_files (file_id, filename, total_bytes, status) VALUES (?, ?, ?, 'PENDING')`,
      [plan.fileId, asset.name, asset.size ?? 0],
    );

    const fileKey = deriveFileKey(masterKeyHex, plan.encryptionIv);
    const safeInternalUri = localCopies.get(asset.uri)!;
    const sourceFile = new File(safeInternalUri);

    try {
      // 🔧 Bounded worker pool: multiple chunks encrypt+write "in flight"
      // rather than strictly one after another. Since native encrypt calls
      // are fast, this mainly overlaps disk I/O (reading/writing) across
      // chunks rather than giving true CPU parallelism — but it still
      // shortens wall-clock time for the whole file meaningfully.
      let cursor = 0;
      const chunkList = plan.chunks;

      async function worker() {
        while (cursor < chunkList.length) {
          const chunk = chunkList[cursor++];
          await encryptAndStoreChunk(sourceFile, fileKey, plan.fileId, chunk);
        }
      }

      const workers = Array.from(
        { length: Math.min(CHUNK_ENCRYPT_CONCURRENCY, chunkList.length) },
        () => worker(),
      );
      await Promise.all(workers);

      await db.runAsync(
        `UPDATE local_files SET status = 'PROCESSING' WHERE file_id = ?`,
        [plan.fileId],
      );
    } finally {
      await FileSystem.deleteAsync(safeInternalUri, { idempotent: true }).catch(
        () => {},
      );
    }
  }
}
