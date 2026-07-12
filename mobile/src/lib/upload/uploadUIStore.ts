import { create } from "zustand";
import { db } from "./uploadDb";

export interface UIUploadItem {
  fileId: string;
  filename: string;
  status: "planning" | "uploading" | "completed" | "failed";
  chunkIndex: number;
  totalChunks: number;
  progressPercent: number;
  totalBytes: number;
  bytesSent: number;
}

interface UploadUIStore {
  activeUploadList: UIUploadItem[];
  syncUIStats: () => Promise<boolean>;
}

export const useUploadUIStore = create<UploadUIStore>((set, get) => ({
  activeUploadList: [],
  syncUIStats: async () => {
    if (!db) return false;

    try {
      const files = await db.getAllAsync<{
        file_id: string;
        filename: string;
        status: string;
        total_bytes: number;
      }>(
        `SELECT * FROM local_files WHERE status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
      );

      if (files.length === 0) {
        if (get().activeUploadList.length !== 0) {
          set({ activeUploadList: [] });
        }
        return false;
      }

      const freshList: UIUploadItem[] = [];
      let hasActiveUploads = false;

      for (const file of files) {
        const chunks = await db.getAllAsync<{
          status: string;
          bytes_sent: number;
          total_bytes: number;
        }>(
          `SELECT status, bytes_sent, total_bytes FROM local_chunks WHERE file_id = ?`,
          [file.file_id],
        );

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
        if (chunks.some((c) => c.status === "FAILED")) uiStatus = "failed";

        if (uiStatus === "planning" || uiStatus === "uploading") {
          hasActiveUploads = true;
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
        });
      }

      // 🔍 Structural Equality Validation: Prevents redundant state updates
      const currentListStr = JSON.stringify(get().activeUploadList);
      const freshListStr = JSON.stringify(freshList);

      if (currentListStr !== freshListStr) {
        set({ activeUploadList: freshList });
      }

      return hasActiveUploads;
    } catch (error) {
      console.error("Error updating UI statistics store:", error);
      return false;
    }
  },
}));
