import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { db } from "./uploadDb";
import { completeChunk, completeFile } from "../api/files";
import { useUploadUIStore } from "./uploadUIStore";

let isProcessing = false;

export async function processUploadQueue() {
  // 🛑 The check ensures db is not null, narrowing the type for the rest of the function!
  if (!db || isProcessing) return;
  isProcessing = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      isProcessing = false;
      return;
    }

    // Use db! to explicitly tell TypeScript it is safe to query
    const pendingChunks = await db!.getAllAsync<{
      chunk_id: string;
      file_id: string;
      upload_url: string;
      local_path: string;
      bytes_sent: number;
      total_bytes: number;
      checksum: string;
    }>(
      `SELECT * FROM local_chunks WHERE status IN ('PENDING', 'UPLOADING', 'FAILED')`,
    );

    for (const chunk of pendingChunks) {
      const activeNet = await NetInfo.fetch();
      if (!activeNet.isConnected) break;

      try {
        const statusCheck = await fetch(chunk.upload_url, {
          method: "PUT",
          headers: { "Content-Range": "bytes */*" },
        });

        let startByte = 0;
        if (statusCheck.status === 308) {
          const rangeHeader = statusCheck.headers.get("Range");
          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=0-(\d+)/);
            if (match) startByte = parseInt(match[1], 10) + 1;
          }
        }

        if (startByte >= chunk.total_bytes) {
          await markChunkComplete(
            chunk.chunk_id,
            chunk.file_id,
            chunk.checksum,
          );
          continue;
        }

        const uploadTask = FileSystem.createUploadTask(
          chunk.upload_url,
          chunk.local_path,
          {
            httpMethod: "PUT",
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          },
          async (data) => {
            // Added non-null assertion db!
            await db!.runAsync(
              `UPDATE local_chunks SET bytes_sent = ?, status = 'UPLOADING' WHERE chunk_id = ?`,
              [data.totalBytesSent + startByte, chunk.chunk_id],
            );
            await useUploadUIStore.getState().syncUIStats();
          },
        );

        const result = await uploadTask.uploadAsync();

        if (
          result &&
          (result.status === 200 ||
            result.status === 201 ||
            result.status === 308)
        ) {
          const driveData = JSON.parse(result.body);
          await markChunkComplete(
            chunk.chunk_id,
            chunk.file_id,
            chunk.checksum,
            driveData.id,
          );
        } else {
          throw new Error(`Invalid network provider status: ${result?.status}`);
        }
      } catch (chunkError) {
        console.error(
          `Error processing chunk ID ${chunk.chunk_id}:`,
          chunkError,
        );
        // Added non-null assertion db!
        await db!.runAsync(
          `UPDATE local_chunks SET status = 'FAILED' WHERE chunk_id = ?`,
          [chunk.chunk_id],
        );
        await useUploadUIStore.getState().syncUIStats();
      }
    }
  } finally {
    isProcessing = false;
  }
}

async function markChunkComplete(
  chunkId: string,
  fileId: string,
  checksum: string,
  providerFileId?: string,
) {
  if (!db) return; // Quick safety guard

  await db.runAsync(
    `UPDATE local_chunks SET status = 'COMPLETED', bytes_sent = total_bytes WHERE chunk_id = ?`,
    [chunkId],
  );

  if (providerFileId) {
    await completeChunk(chunkId, providerFileId, checksum);
  }

  const remaining = await db.getAllAsync(
    `SELECT chunk_id FROM local_chunks WHERE file_id = ? AND status != 'COMPLETED'`,
    [fileId],
  );

  if (remaining.length === 0) {
    await completeFile(fileId);
    await db.runAsync(
      `UPDATE local_files SET status = 'COMPLETED' WHERE file_id = ?`,
      [fileId],
    );

    const chunksToDelete = await db.getAllAsync<{ local_path: string }>(
      `SELECT local_path FROM local_chunks WHERE file_id = ?`,
      [fileId],
    );
    for (const c of chunksToDelete) {
      await FileSystem.deleteAsync(c.local_path, {
        idempotent: true,
      } as any).catch(() => {});
    }
  }

  await useUploadUIStore.getState().syncUIStats();
}
