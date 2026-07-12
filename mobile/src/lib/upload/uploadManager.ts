import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import CryptoJS from "crypto-js";
import { initUpload } from "../api/files";
import { deriveFileKey, deriveChunkCipherParams } from "../keyManager";
import { db } from "./uploadDb";

export async function pickFiles() {
  const picked = await DocumentPicker.getDocumentAsync({
    multiple: true,
    // 🔧 Do NOT let the picker copy to its own cache dir. On Android, that
    // internal copy is sometimes not fully flushed to disk by the time the
    // promise resolves (known expo-document-picker bug, worst in Expo Go),
    // which causes "isn't readable" IOExceptions when we try to read/copy
    // it ourselves right after. Copying directly from the raw content://
    // URI below avoids that race entirely.
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

export async function queueUploads(
  assets: DocumentPicker.DocumentPickerAsset[],
  folderId: string | null,
  masterKeyHex: string,
): Promise<void> {
  if (!db) {
    throw new Error("Database not initialized yet.");
  }

  // 🔧 Copy every picked asset into durable app storage FIRST, before any
  // other await (especially before the initUpload network call). This
  // closes the async gap between the picker resolving and us touching the
  // file, and reads directly from the original content:// URI rather than
  // relying on the picker's own (flaky) internal cache copy.
  const localCopies = new Map<string, string>(); // asset.uri -> safeInternalUri
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
    tempId: `f${i}-${Date.now()}`,
    filename: a.name,
    sizeBytes: a.size ?? 0,
    mimeType: a.mimeType,
    folderId,
  }));

  const initResult = await initUpload(filesForInit);
  const { files: plannedFiles } = initResult;

  for (const plan of plannedFiles) {
    const asset = assets.find((_, i) => filesForInit[i].tempId === plan.tempId);
    if (!asset) continue;

    await db.runAsync(
      `INSERT OR IGNORE INTO local_files (file_id, filename, total_bytes, status) VALUES (?, ?, ?, 'PENDING')`,
      [plan.fileId, asset.name, asset.size ?? 0],
    );

    const fileKey = deriveFileKey(masterKeyHex, plan.encryptionIv);
    const safeInternalUri = localCopies.get(asset.uri)!; // already copied above

    try {
      // Read the securely cloned file into Base64 memory space
      const fullBase64 = await FileSystem.readAsStringAsync(safeInternalUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      for (const chunk of plan.chunks) {
        const byteOffset = Number(chunk.byteOffset);
        const sizeBytes = Number(chunk.sizeBytes);

        // Calculate string slicing boundaries (4 characters represent 3 raw bytes)
        const charOffset = Math.floor((byteOffset * 4) / 3);
        const charLength = Math.ceil((sizeBytes * 4) / 3);

        const chunkBase64 = fullBase64.substring(
          charOffset,
          charOffset + charLength,
        );

        const plaintextWords = CryptoJS.enc.Base64.parse(chunkBase64);
        const { key, iv } = deriveChunkCipherParams(fileKey, chunk.chunkIndex);

        const encrypted = CryptoJS.AES.encrypt(plaintextWords, key, {
          iv,
          mode: CryptoJS.mode.CTR,
          padding: CryptoJS.pad.NoPadding,
        });

        const cipherBytesBase64 = encrypted.ciphertext.toString(
          CryptoJS.enc.Base64,
        );
        const checksum = CryptoJS.SHA256(encrypted.ciphertext).toString(
          CryptoJS.enc.Hex,
        );

        const localChunkPath = `${FileSystem.cacheDirectory}chunk_${chunk.chunkId}.bin`;
        await FileSystem.writeAsStringAsync(localChunkPath, cipherBytesBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await db.runAsync(
          `INSERT OR IGNORE INTO local_chunks (chunk_id, file_id, upload_url, local_path, bytes_sent, total_bytes, status, checksum) 
           VALUES (?, ?, ?, ?, 0, ?, 'PENDING', ?)`,
          [
            chunk.chunkId,
            plan.fileId,
            chunk.uploadUrl,
            localChunkPath,
            sizeBytes,
            checksum,
          ],
        );
      }

      await db.runAsync(
        `UPDATE local_files SET status = 'PROCESSING' WHERE file_id = ?`,
        [plan.fileId],
      );
    } finally {
      // Clean up the temporary cloned master file to save device storage space
      await FileSystem.deleteAsync(safeInternalUri, { idempotent: true }).catch(
        () => {},
      );
    }
  }
}
