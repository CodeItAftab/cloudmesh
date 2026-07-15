import { File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { createDecipheriv, createHash } from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { apiFetch } from "../api/api";
import { deriveFileKey, deriveChunkCipherParams } from "../keyManager";
import { getCloudMeshDownloadsFolderUri } from "./androidDownloadsFolder";

interface DownloadManifestChunk {
  chunkIndex: number;
  byteOffset: number;
  url: string;
  authMode: "bearer";
  accessToken: string;
  checksum: string;
  sizeBytes: number;
}

interface DownloadManifest {
  fileId: string;
  filename: string;
  encryptionIv: string;
  checksum?: string;
  chunks: DownloadManifestChunk[];
}

export interface DownloadProgress {
  fileId: string;
  bytesDownloaded: number;
  totalBytes: number;
  stage: "downloading" | "saving";
}

const CHUNK_DOWNLOAD_CONCURRENCY = 3;

function createMutex() {
  let chain = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = chain.then(fn, fn);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

export async function downloadAndDecryptFile(
  fileId: string,
  masterKeyHex: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  const res = await apiFetch(`/files/${fileId}/download`);
  if (!res.ok)
    throw new Error(`Failed to fetch download manifest (${res.status})`);
  const manifest: DownloadManifest = await res.json();

  const fileKey = deriveFileKey(masterKeyHex, manifest.encryptionIv);
  const totalBytes = manifest.chunks.reduce((sum, c) => sum + c.sizeBytes, 0);
  let bytesDownloaded = 0;

  const stagingPath = `${Paths.cache.uri}/staging_${Date.now()}_${manifest.filename}`;
  const stagingFile = new File(stagingPath);
  if (!stagingFile.exists) stagingFile.create();

  const sortedChunks = [...manifest.chunks].sort(
    (a, b) => a.chunkIndex - b.chunkIndex,
  );
  const withWriteLock = createMutex();

  let cursor = 0;
  const errors: string[] = [];

  async function worker() {
    while (cursor < sortedChunks.length) {
      const chunk = sortedChunks[cursor++];

      try {
        const chunkRes = await fetch(chunk.url, {
          headers: { Authorization: `Bearer ${chunk.accessToken}` },
        });
        if (!chunkRes.ok) {
          throw new Error(
            `Chunk ${chunk.chunkIndex} download failed (${chunkRes.status})`,
          );
        }

        const arrayBuffer = await chunkRes.arrayBuffer();
        const cipherBytes = Buffer.from(new Uint8Array(arrayBuffer));

        const actualChecksum = createHash("sha256")
          .update(cipherBytes)
          .digest("hex");
        if (actualChecksum !== chunk.checksum) {
          throw new Error(`Checksum mismatch on chunk ${chunk.chunkIndex}`);
        }

        const { key, iv } = deriveChunkCipherParams(fileKey, chunk.chunkIndex);
        const decipher = createDecipheriv("aes-256-ctr", key, iv);
        const plaintextBytes = Buffer.concat([
          decipher.update(cipherBytes),
          decipher.final(),
        ]);

        await withWriteLock(async () => {
          const handle = stagingFile.open();
          handle.offset = Number(chunk.byteOffset);
          await handle.writeBytes(new Uint8Array(plaintextBytes));
          handle.close();
        });

        bytesDownloaded += chunk.sizeBytes;
        onProgress?.({
          fileId,
          bytesDownloaded,
          totalBytes,
          stage: "downloading",
        });
      } catch (err) {
        console.error(`Error downloading chunk ${chunk.chunkIndex}:`, err);
        errors.push(
          `Chunk ${chunk.chunkIndex}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CHUNK_DOWNLOAD_CONCURRENCY, sortedChunks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  if (errors.length > 0) {
    await FileSystem.deleteAsync(stagingPath, { idempotent: true }).catch(
      () => {},
    );
    throw new Error(
      `Download failed for ${errors.length} chunk(s): ${errors.join("; ")}`,
    );
  }

  onProgress?.({
    fileId,
    bytesDownloaded: totalBytes,
    totalBytes,
    stage: "saving",
  });

  const cloudMeshFolderUri = await getCloudMeshDownloadsFolderUri();

  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    cloudMeshFolderUri,
    manifest.filename,
    guessMimeType(manifest.filename),
  );

  // Stream the staging file to the SAF destination in small chunks —
  // copyAsync doesn't support content:// destinations on Android, and a
  // single full-file readAsStringAsync/writeAsStringAsync OOMs on large
  // files. This keeps peak memory to one chunk (a few MB) at a time.
  const stagingInfo = await FileSystem.getInfoAsync(stagingPath);
  const stagingSize = stagingInfo.exists ? stagingInfo.size : 0;
  const SAVE_CHUNK_SIZE = 4 * 1024 * 1024;

  let savedBytes = 0;
  let isFirstWrite = true;

  while (savedBytes < stagingSize) {
    const length = Math.min(SAVE_CHUNK_SIZE, stagingSize - savedBytes);

    const base64Chunk = await FileSystem.readAsStringAsync(stagingPath, {
      encoding: FileSystem.EncodingType.Base64,
      position: savedBytes,
      length,
    });

    await FileSystem.writeAsStringAsync(destUri, base64Chunk, {
      encoding: FileSystem.EncodingType.Base64,
      append: !isFirstWrite,
    });

    isFirstWrite = false;
    savedBytes += length;
    onProgress?.({
      fileId,
      bytesDownloaded: savedBytes,
      totalBytes: stagingSize,
      stage: "saving",
    });
  }

  await FileSystem.deleteAsync(stagingPath, { idempotent: true }).catch(
    () => {},
  );
  return destUri;
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mp4: "video/mp4",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}
