import { create } from "zustand";
import * as FileSystem from "expo-file-system/legacy";
import { db } from "./uploadDb";
import {
  cancelActiveTasksForFile,
  markFileCancelled,
} from "./uploadCancellation";
import { recordProgress, clearFileSpeed } from "./speedTracker";

export interface UIUploadItem {
  fileId: string;
  filename: string;
  status: "planning" | "uploading" | "completed" | "failed" | "cancelled";
  chunkIndex: number;
  totalChunks: number;
  progressPercent: number;
  totalBytes: number;
  bytesSent: number;
  failureReason?: string | null;
}

interface OptimisticPlanningItem {
  tempId: string;
  filename: string;
  totalBytes: number;
}

interface UploadUIStore {
  activeUploadList: UIUploadItem[];
  optimisticPlanningItems: OptimisticPlanningItem[];

  addPlanningItem: (
    tempId: string,
    filename: string,
    totalBytes: number,
  ) => void;
  clearPlanningItem: (tempId: string) => void;
  cancelItem: (fileId: string) => Promise<void>;
  retryItem: (fileId: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  syncUIStats: () => Promise<boolean>;
}

export const useUploadUIStore = create<UploadUIStore>((set, get) => ({
  activeUploadList: [],
  optimisticPlanningItems: [],

  addPlanningItem: (tempId, filename, totalBytes) => {
    set((state) => ({
      optimisticPlanningItems: [
        { tempId, filename, totalBytes },
        ...state.optimisticPlanningItems,
      ],
    }));
  },

  clearPlanningItem: (tempId) => {
    set((state) => ({
      optimisticPlanningItems: state.optimisticPlanningItems.filter(
        (p) => p.tempId !== tempId,
      ),
    }));
  },

  cancelItem: async (fileId) => {
    if (!db) return;

    set((state) => ({
      activeUploadList: state.activeUploadList.map((item) =>
        item.fileId === fileId ? { ...item, status: "cancelled" } : item,
      ),
    }));

    markFileCancelled(fileId);

    try {
      const chunkRows = await db.getAllAsync<{
        chunk_id: string;
        local_path: string;
      }>(
        `SELECT chunk_id, local_path FROM local_chunks WHERE file_id = ? AND status NOT IN ('COMPLETED')`,
        [fileId],
      );

      await cancelActiveTasksForFile(chunkRows.map((c) => c.chunk_id));

      await db.runAsync(
        `UPDATE local_chunks SET status = 'CANCELLED' WHERE file_id = ? AND status NOT IN ('COMPLETED')`,
        [fileId],
      );
      await db.runAsync(
        `UPDATE local_files SET status = 'CANCELLED' WHERE file_id = ?`,
        [fileId],
      );

      for (const c of chunkRows) {
        await FileSystem.deleteAsync(c.local_path, {
          idempotent: true,
        } as any).catch(() => {});
      }
    } catch (error) {
      console.error("Error cancelling upload:", error);
    }

    clearFileSpeed(fileId);
    await get().syncUIStats();
  },

  retryItem: async (fileId) => {
    if (!db) return;

    try {
      // Reset failed chunks back to PENDING — the already-encrypted local
      // chunk files are still on disk, so this re-uploads existing
      // ciphertext rather than re-reading/re-encrypting the source file.
      await db.runAsync(
        `UPDATE local_chunks SET status = 'PENDING', last_error = NULL WHERE file_id = ? AND status = 'FAILED'`,
        [fileId],
      );
      await db.runAsync(
        `UPDATE local_files SET status = 'PROCESSING', failure_reason = NULL WHERE file_id = ?`,
        [fileId],
      );

      clearFileSpeed(fileId); // start speed/ETA calculation fresh
      await get().syncUIStats();
    } catch (error) {
      console.error("Error retrying upload:", error);
    }
  },

  clearFinished: async () => {
    if (!db) return;
    try {
      await db.runAsync(
        `DELETE FROM local_chunks WHERE file_id IN (SELECT file_id FROM local_files WHERE status IN ('COMPLETED', 'CANCELLED'))`,
      );
      await db.runAsync(
        `DELETE FROM local_files WHERE status IN ('COMPLETED', 'CANCELLED')`,
      );
      set((state) => ({
        activeUploadList: state.activeUploadList.filter(
          (item) => item.status !== "completed" && item.status !== "cancelled",
        ),
      }));
    } catch (error) {
      console.error("Error clearing finished uploads:", error);
    }
  },

  syncUIStats: async () => {
    if (!db) return false;

    try {
      const files = await db.getAllAsync<{
        file_id: string;
        filename: string;
        status: string;
        total_bytes: number;
        failure_reason: string | null;
      }>(
        `SELECT * FROM local_files WHERE status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')`,
      );

      if (files.length === 0) {
        if (get().activeUploadList.length !== 0) {
          set({ activeUploadList: [] });
        }
        return get().optimisticPlanningItems.length > 0;
      }

      const fileIds = files.map((f) => f.file_id);
      const placeholders = fileIds.map(() => "?").join(",");
      const allChunks = await db.getAllAsync<{
        file_id: string;
        status: string;
        bytes_sent: number;
      }>(
        `SELECT file_id, status, bytes_sent FROM local_chunks WHERE file_id IN (${placeholders})`,
        fileIds,
      );

      const chunksByFile = new Map<string, typeof allChunks>();
      for (const c of allChunks) {
        const arr = chunksByFile.get(c.file_id) ?? [];
        arr.push(c);
        chunksByFile.set(c.file_id, arr);
      }

      const freshList: UIUploadItem[] = [];
      let hasActiveUploads = false;

      for (const file of files) {
        const chunks = chunksByFile.get(file.file_id) ?? [];

        const totalChunks = chunks.length;
        const completedChunks = chunks.filter(
          (c) => c.status === "COMPLETED",
        ).length;
        const totalBytesSent = chunks.reduce((sum, c) => sum + c.bytes_sent, 0);

        const progressPercent =
          file.total_bytes > 0
            ? Math.round((totalBytesSent / file.total_bytes) * 100)
            : 0;

        let uiStatus: UIUploadItem["status"] = "uploading";
        if (file.status === "PENDING") uiStatus = "planning";
        if (file.status === "COMPLETED") uiStatus = "completed";
        if (file.status === "CANCELLED") uiStatus = "cancelled";
        if (file.status === "FAILED") uiStatus = "failed";

        if (uiStatus === "planning" || uiStatus === "uploading") {
          hasActiveUploads = true;
          recordProgress(file.file_id, totalBytesSent); // feed the speed/ETA tracker
        }

        freshList.push({
          fileId: file.file_id,
          filename: file.filename,
          status: uiStatus,
          chunkIndex: Math.min(completedChunks + 1, totalChunks),
          totalChunks,
          progressPercent: Math.min(progressPercent, 100),
          totalBytes: file.total_bytes,
          bytesSent: totalBytesSent,
          failureReason: file.failure_reason,
        });
      }

      const currentListStr = JSON.stringify(get().activeUploadList);
      const freshListStr = JSON.stringify(freshList);

      if (currentListStr !== freshListStr) {
        set({ activeUploadList: freshList });
      }

      return hasActiveUploads || get().optimisticPlanningItems.length > 0;
    } catch (error) {
      // A torn-down connection from a mid-upload reload surfaces here
      // repeatedly on a throttled timer — log once, not on every tick.
      if (!(error as Error)?.message?.includes("has been rejected")) {
        console.error("Error updating UI statistics store:", error);
      }
      return false;
    }
  },
}));

export function useCombinedUploadList(): UIUploadItem[] {
  const activeUploadList = useUploadUIStore((s) => s.activeUploadList);
  const optimisticPlanningItems = useUploadUIStore(
    (s) => s.optimisticPlanningItems,
  );

  const optimisticAsItems: UIUploadItem[] = optimisticPlanningItems.map(
    (p) => ({
      fileId: p.tempId,
      filename: p.filename,
      status: "planning",
      chunkIndex: 0,
      totalChunks: 0,
      progressPercent: 0,
      totalBytes: p.totalBytes,
      bytesSent: 0,
    }),
  );

  return [...optimisticAsItems, ...activeUploadList];
}
