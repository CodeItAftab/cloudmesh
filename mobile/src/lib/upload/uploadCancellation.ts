import * as FileSystem from "expo-file-system/legacy";

const cancelledFileIds = new Set<string>();
const activeUploadTasks = new Map<string, FileSystem.UploadTask>(); // keyed by chunk_id

export function isFileCancelled(fileId: string): boolean {
  return cancelledFileIds.has(fileId);
}

export function markFileCancelled(fileId: string) {
  cancelledFileIds.add(fileId);
}

export function clearFileCancelled(fileId: string) {
  cancelledFileIds.delete(fileId);
}

export function registerUploadTask(
  chunkId: string,
  task: FileSystem.UploadTask,
) {
  activeUploadTasks.set(chunkId, task);
}

export function unregisterUploadTask(chunkId: string) {
  activeUploadTasks.delete(chunkId);
}

export async function cancelActiveTasksForFile(chunkIds: string[]) {
  for (const chunkId of chunkIds) {
    const task = activeUploadTasks.get(chunkId);
    if (task) {
      try {
        await task.cancelAsync();
      } catch {
        // task may have already finished/failed on its own — fine to ignore
      }
      activeUploadTasks.delete(chunkId);
    }
  }
}
