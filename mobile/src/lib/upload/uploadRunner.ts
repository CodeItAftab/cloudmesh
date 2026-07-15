import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { db } from "./uploadDb";
import { completeChunk, completeFile } from "../api/files";
import { useUploadUIStore } from "./uploadUIStore";
import { throttle } from "./throttle";
import {
  isFileCancelled,
  clearFileCancelled,
  registerUploadTask,
  unregisterUploadTask,
} from "./uploadCancellation";

let isProcessing = false;
const MAX_CONCURRENT_UPLOADS = 3;

const throttledSyncUIStats = throttle(() => {
  useUploadUIStore.getState().syncUIStats();
}, 250);

function categorizeError(error: unknown, statusCode?: number): string {
  if (statusCode === 401 || statusCode === 403) {
    return "Session expired — please reconnect your account";
  }
  if (statusCode === 404) {
    return "Destination folder no longer exists";
  }
  if (statusCode === 507 || statusCode === 413) {
    return "Storage quota exceeded";
  }
  if (statusCode && statusCode >= 500) {
    return "Cloud provider error — try again later";
  }
  if (error instanceof Error) {
    if (error.message.includes("Network request failed")) {
      return "Connection lost";
    }
    if (error.message.toLowerCase().includes("quota")) {
      return "Storage quota exceeded";
    }
  }
  return "Upload failed";
}

export async function processUploadQueue() {
  if (!db || isProcessing) return;
  isProcessing = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      isProcessing = false;
      return;
    }

    const pendingChunks = await db!.getAllAsync<{
      chunk_id: string;
      file_id: string;
      upload_url: string;
      local_path: string;
      bytes_sent: number;
      total_bytes: number;
      checksum: string;
    }>(
      `SELECT * FROM local_chunks WHERE status IN ('PENDING', 'UPLOADING')`,
      // 🔧 Note: 'FAILED' removed from this query — failed chunks now stay
      // failed until the user explicitly retries (per manual-retry-only decision).
    );

    let cursor = 0;

    async function worker() {
      while (cursor < pendingChunks.length) {
        const chunk = pendingChunks[cursor++];

        const activeNet = await NetInfo.fetch();
        if (!activeNet.isConnected) return;

        if (isFileCancelled(chunk.file_id)) {
          await db!.runAsync(
            `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
            [chunk.chunk_id],
          );
          continue;
        }

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
          } else if (!statusCheck.ok && statusCheck.status !== 308) {
            throw Object.assign(new Error(`Status check failed`), {
              statusCode: statusCheck.status,
            });
          }

          if (startByte >= chunk.total_bytes) {
            await markChunkComplete(
              chunk.chunk_id,
              chunk.file_id,
              chunk.checksum,
            );
            continue;
          }

          if (isFileCancelled(chunk.file_id)) {
            await db!.runAsync(
              `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
              [chunk.chunk_id],
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
              db!
                .runAsync(
                  `UPDATE local_chunks SET bytes_sent = ?, status = 'UPLOADING' WHERE chunk_id = ?`,
                  [data.totalBytesSent + startByte, chunk.chunk_id],
                )
                .catch((e) => console.warn("progress write failed", e));
              throttledSyncUIStats();
            },
          );

          registerUploadTask(chunk.chunk_id, uploadTask);

          let result;
          try {
            result = await uploadTask.uploadAsync();
          } finally {
            unregisterUploadTask(chunk.chunk_id);
          }

          if (isFileCancelled(chunk.file_id)) {
            await db!.runAsync(
              `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
              [chunk.chunk_id],
            );
            continue;
          }

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
            throw Object.assign(
              new Error(`Invalid network provider status: ${result?.status}`),
              { statusCode: result?.status },
            );
          }
        } catch (chunkError: any) {
          if (isFileCancelled(chunk.file_id)) {
            await db!.runAsync(
              `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
              [chunk.chunk_id],
            );
          } else {
            const reason = categorizeError(chunkError, chunkError?.statusCode);
            console.error(
              `Error processing chunk ID ${chunk.chunk_id}:`,
              chunkError,
            );
            await db!.runAsync(
              `UPDATE local_chunks SET status = 'FAILED', last_error = ? WHERE chunk_id = ?`,
              [reason, chunk.chunk_id],
            );
          }
          throttledSyncUIStats();
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT_UPLOADS, pendingChunks.length) },
      () => worker(),
    );
    await Promise.all(workers);

    // 🔧 Finalize files: if a PROCESSING file has FAILED chunks and nothing
    // left PENDING/UPLOADING, mark the file itself FAILED so the UI can
    // surface a retry action instead of leaving it stuck at "Processing".
    const filesInFlight = await db!.getAllAsync<{ file_id: string }>(
      `SELECT DISTINCT file_id FROM local_files WHERE status = 'PROCESSING'`,
    );

    for (const f of filesInFlight) {
      if (isFileCancelled(f.file_id)) {
        const remaining = await db!.getAllAsync(
          `SELECT chunk_id FROM local_chunks WHERE file_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED')`,
          [f.file_id],
        );
        if (remaining.length === 0) {
          await db!.runAsync(
            `UPDATE local_files SET status = 'CANCELLED' WHERE file_id = ?`,
            [f.file_id],
          );
          clearFileCancelled(f.file_id);
        }
        continue;
      }

      const chunks = await db!.getAllAsync<{
        status: string;
        last_error: string | null;
      }>(`SELECT status, last_error FROM local_chunks WHERE file_id = ?`, [
        f.file_id,
      ]);

      const hasFailed = chunks.some((c) => c.status === "FAILED");
      const stillActive = chunks.some(
        (c) => c.status === "PENDING" || c.status === "UPLOADING",
      );

      if (hasFailed && !stillActive) {
        const firstFailure = chunks.find((c) => c.status === "FAILED");
        await db!.runAsync(
          `UPDATE local_files SET status = 'FAILED', failure_reason = ? WHERE file_id = ?`,
          [firstFailure?.last_error ?? "Upload failed", f.file_id],
        );
      }
    }

    await useUploadUIStore.getState().syncUIStats();
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
  if (!db) return;

  await db.runAsync(
    `UPDATE local_chunks SET status = 'COMPLETED', bytes_sent = total_bytes, last_error = NULL WHERE chunk_id = ?`,
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
      `UPDATE local_files SET status = 'COMPLETED', failure_reason = NULL WHERE file_id = ?`,
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

// ---------------------------------------------------------------------- old --------------------------------------------------------------

// import * as FileSystem from "expo-file-system/legacy";
// import NetInfo from "@react-native-community/netinfo";
// import { db } from "./uploadDb";
// import { completeChunk, completeFile } from "../api/files";
// import { useUploadUIStore } from "./uploadUIStore";
// import {
//   isFileCancelled,
//   clearFileCancelled,
//   registerUploadTask,
//   unregisterUploadTask,
// } from "./uploadCancellation";

// import { throttle } from "./throttle";

// let isProcessing = false;

// // Shared across all chunks — DB write + full store resync is throttled
// // to at most ~4x/sec instead of firing on every network buffer flush.
// const throttledSyncUIStats = throttle(() => {
//   useUploadUIStore.getState().syncUIStats();
// }, 250);

// export async function processUploadQueue() {
//   if (!db || isProcessing) return;
//   isProcessing = true;

//   try {
//     const netState = await NetInfo.fetch();
//     if (!netState.isConnected) {
//       isProcessing = false;
//       return;
//     }

//     const pendingChunks = await db!.getAllAsync<{
//       chunk_id: string;
//       file_id: string;
//       upload_url: string;
//       local_path: string;
//       bytes_sent: number;
//       total_bytes: number;
//       checksum: string;
//     }>(
//       `SELECT * FROM local_chunks WHERE status IN ('PENDING', 'UPLOADING', 'FAILED')`,
//     );

//     for (const chunk of pendingChunks) {
//       const activeNet = await NetInfo.fetch();
//       if (!activeNet.isConnected) break;

//       // 🔧 Skip (and mark) chunks belonging to a file the user cancelled
//       if (isFileCancelled(chunk.file_id)) {
//         await db!.runAsync(
//           `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
//           [chunk.chunk_id],
//         );
//         continue;
//       }

//       try {
//         const statusCheck = await fetch(chunk.upload_url, {
//           method: "PUT",
//           headers: { "Content-Range": "bytes */*" },
//         });

//         let startByte = 0;
//         if (statusCheck.status === 308) {
//           const rangeHeader = statusCheck.headers.get("Range");
//           if (rangeHeader) {
//             const match = rangeHeader.match(/bytes=0-(\d+)/);
//             if (match) startByte = parseInt(match[1], 10) + 1;
//           }
//         }

//         if (startByte >= chunk.total_bytes) {
//           await markChunkComplete(
//             chunk.chunk_id,
//             chunk.file_id,
//             chunk.checksum,
//           );
//           continue;
//         }

//         // 🔧 Re-check right before starting the actual transfer — the user
//         // may have hit cancel while the status-check request was in flight.
//         if (isFileCancelled(chunk.file_id)) {
//           await db!.runAsync(
//             `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
//             [chunk.chunk_id],
//           );
//           continue;
//         }

//         const uploadTask = FileSystem.createUploadTask(
//           chunk.upload_url,
//           chunk.local_path,
//           {
//             httpMethod: "PUT",
//             uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
//             sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
//           },
//           async (data) => {
//             // Fire-and-forget the DB write, throttle the expensive UI resync
//             db!
//               .runAsync(
//                 `UPDATE local_chunks SET bytes_sent = ?, status = 'UPLOADING' WHERE chunk_id = ?`,
//                 [data.totalBytesSent + startByte, chunk.chunk_id],
//               )
//               .catch((e) => console.warn("progress write failed", e));
//             throttledSyncUIStats();
//           },
//         );

//         registerUploadTask(chunk.chunk_id, uploadTask); // 🔧 new

//         let result;
//         try {
//           result = await uploadTask.uploadAsync();
//         } finally {
//           unregisterUploadTask(chunk.chunk_id); // 🔧 new
//         }

//         // 🔧 If cancelled mid-flight, the task resolves/throws oddly —
//         // treat it as cancelled rather than failed.
//         if (isFileCancelled(chunk.file_id)) {
//           await db!.runAsync(
//             `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
//             [chunk.chunk_id],
//           );
//           continue;
//         }

//         if (
//           result &&
//           (result.status === 200 ||
//             result.status === 201 ||
//             result.status === 308)
//         ) {
//           const driveData = JSON.parse(result.body);
//           await markChunkComplete(
//             chunk.chunk_id,
//             chunk.file_id,
//             chunk.checksum,
//             driveData.id,
//           );
//         } else {
//           throw new Error(`Invalid network provider status: ${result?.status}`);
//         }
//       } catch (chunkError) {
//         // 🔧 Don't mark as FAILED if this was actually a user cancellation
//         if (isFileCancelled(chunk.file_id)) {
//           await db!.runAsync(
//             `UPDATE local_chunks SET status = 'CANCELLED' WHERE chunk_id = ?`,
//             [chunk.chunk_id],
//           );
//         } else {
//           console.error(
//             `Error processing chunk ID ${chunk.chunk_id}:`,
//             chunkError,
//           );
//           await db!.runAsync(
//             `UPDATE local_chunks SET status = 'FAILED' WHERE chunk_id = ?`,
//             [chunk.chunk_id],
//           );
//         }
//         await useUploadUIStore.getState().syncUIStats();
//       }
//     }

//     // 🔧 Finalize any files whose chunks are all cancelled/completed and
//     // clean up cancellation bookkeeping.
//     const filesInFlight = await db!.getAllAsync<{ file_id: string }>(
//       `SELECT DISTINCT file_id FROM local_files WHERE status = 'PROCESSING'`,
//     );
//     for (const f of filesInFlight) {
//       if (!isFileCancelled(f.file_id)) continue;
//       const remaining = await db!.getAllAsync(
//         `SELECT chunk_id FROM local_chunks WHERE file_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED')`,
//         [f.file_id],
//       );
//       if (remaining.length === 0) {
//         await db!.runAsync(
//           `UPDATE local_files SET status = 'CANCELLED' WHERE file_id = ?`,
//           [f.file_id],
//         );
//         clearFileCancelled(f.file_id);
//       }
//     }
//   } finally {
//     isProcessing = false;
//   }
// }

// async function markChunkComplete(
//   chunkId: string,
//   fileId: string,
//   checksum: string,
//   providerFileId?: string,
// ) {
//   if (!db) return;

//   await db.runAsync(
//     `UPDATE local_chunks SET status = 'COMPLETED', bytes_sent = total_bytes WHERE chunk_id = ?`,
//     [chunkId],
//   );

//   if (providerFileId) {
//     await completeChunk(chunkId, providerFileId, checksum);
//   }

//   const remaining = await db.getAllAsync(
//     `SELECT chunk_id FROM local_chunks WHERE file_id = ? AND status != 'COMPLETED'`,
//     [fileId],
//   );

//   if (remaining.length === 0) {
//     await completeFile(fileId);
//     await db.runAsync(
//       `UPDATE local_files SET status = 'COMPLETED' WHERE file_id = ?`,
//       [fileId],
//     );

//     const chunksToDelete = await db.getAllAsync<{ local_path: string }>(
//       `SELECT local_path FROM local_chunks WHERE file_id = ?`,
//       [fileId],
//     );
//     for (const c of chunksToDelete) {
//       await FileSystem.deleteAsync(c.local_path, {
//         idempotent: true,
//       } as any).catch(() => {});
//     }
//   }

//   await useUploadUIStore.getState().syncUIStats();
// }
