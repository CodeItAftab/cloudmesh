import { db } from "./db.js";

export const CHUNK_SIZE_BYTES = 8 * 1024 * 1024; //  8 MB

export interface PlannedChunk {
  chunkIndex: number;
  byteOffset: number;
  sizeBytes: number;
  accountId: string;
}

export interface FileToPlan {
  tempId: string;
  sizeBytes: number;
}

export interface PlannedFile {
  tempId: string;
  chunks: PlannedChunk[];
}

export interface FailedFile {
  tempId: string;
  reason: string;
}

export interface BatchPlanResult {
  planned: PlannedFile[];
  failed: FailedFile[];
}

export async function planChunksBatch(
  userId: string,
  files: FileToPlan[],
): Promise<BatchPlanResult> {
  const accounts = await db.connectedAccount.findMany({
    where: { userId, status: "ACTIVE" },
  });

  if (accounts.length === 0) {
    return {
      planned: [],
      failed: files.map((file) => ({
        tempId: file.tempId,
        reason: "No active connected accounts found for user",
      })),
    };
  }

  const freeSpace: Record<string, number> = {};

  for (const acc of accounts) {
    const total = acc.quotaTotalBytes
      ? Number(acc.quotaTotalBytes)
      : Number.MAX_SAFE_INTEGER;

    const userd = acc.quotaUsedBytes ? Number(acc.quotaUsedBytes) : 0;
    freeSpace[acc.id] = total - userd;
  }

  const planned: PlannedFile[] = [];
  const failed: FailedFile[] = [];

  for (const file of files) {
    const totalFreeNow = Object.values(freeSpace).reduce(
      (sum, v) => sum + v,
      0,
    );

    // Check if the file can fit in the total free space across all accounts
    if (file.sizeBytes > totalFreeNow) {
      failed.push({
        tempId: file.tempId,
        reason: "Not enough free space across all connected accounts",
      });
      continue;
    }

    // Fast clone of the scratchpad space map
    const scratch = { ...freeSpace };

    const chunkCount = Math.ceil(file.sizeBytes / CHUNK_SIZE_BYTES);
    const chunks: PlannedChunk[] = [];
    let ok = true;
    // Convert accounts to a simple array we can keep sorted dynamically
    const runningAccounts = Object.entries(scratch).map(([id, free]) => ({
      id,
      free,
    }));

    for (let i = 0; i < chunkCount; i++) {
      const byteOffset = i * CHUNK_SIZE_BYTES;
      const sizeBytes = Math.min(CHUNK_SIZE_BYTES, file.sizeBytes - byteOffset);

      //   1. Sort accoutns so the one with the hightest free space is ALWAYS at index 0
      runningAccounts.sort((a, b) => b.free - a.free);
      const bestAccount = runningAccounts[0];

      //   2. Safe Guardrail Check
      if (!bestAccount || bestAccount.free < sizeBytes) {
        ok = false;
        break;
      }

      chunks.push({
        chunkIndex: i,
        byteOffset,
        sizeBytes,
        accountId: bestAccount.id,
      });

      //   Deduct space form both our tracker array and scratchpad map
      bestAccount.free -= sizeBytes;
      scratch[bestAccount.id] = bestAccount.free;

      if (!ok) {
        failed.push({
          tempId: file.tempId,
          reason: "Not enough free space across all connected accounts",
        });
        continue;
      }

      //   Success! Commit changes from scratch back to freeSpace map
      Object.assign(freeSpace, scratch);
      planned.push({
        tempId: file.tempId,
        chunks,
      });
    }
  }

  return { planned, failed };
}
