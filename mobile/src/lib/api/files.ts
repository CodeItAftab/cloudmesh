import { apiFetch } from "./api";

export interface FolderItem {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
}

export interface FileItem {
  id: string;
  filename: string;
  sizeBytes: string;
  mimeType: string | null;
  status: string;
  createdAt: string;
}

export async function getFolderContents(
  folderId: string,
): Promise<{ folders: FolderItem[]; files: FileItem[] }> {
  const res = await apiFetch(`/folders/${folderId}/contents`);
  if (!res.ok) {
    throw new Error(`Failed to fetch folder contents: ${res.statusText}`);
  }
  const data = await res.json();
  return data;
}

export async function createFolder(
  name: string,
  parentFolderId: string | null,
): Promise<FolderItem> {
  const res = await apiFetch("/folders", {
    method: "POST",
    body: JSON.stringify({ name, parentFolderId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create folder: ${res.statusText}`);
  }

  const data = await res.json();
  return data.folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to rename folder");
}

export async function renameFile(id: string, filename: string): Promise<void> {
  const res = await apiFetch(`/files/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) throw new Error("Failed to rename file");
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await apiFetch(`/folders/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to delete folder (${res.status}): ${body}`);
  }
}

export async function deleteFile(id: string): Promise<void> {
  const res = await apiFetch(`/files/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to delete file (${res.status}): ${body}`);
  }
}

// Upload Manager

export interface UploadPlanChunk {
  chunkId: string;
  chunkIndex: number;
  byteOffset: number;
  sizeBytes: number;
  uploadUrl: string;
  authMode: "none" | "bearer";
}

export interface UploadPlanFile {
  tempId: string;
  fileId: string;
  encryptionIv: string;
  chunkSizeBytes: number;
  chunks: UploadPlanChunk[];
}

export async function initUpload(
  files: {
    tempId: string;
    filename: string;
    sizeBytes: number;
    mimeType?: string;
  }[],
  folderId: string | null,
): Promise<{
  files: UploadPlanFile[];
  failed: { tempId: string; reason: string }[];
}> {
  const res = await apiFetch("/files/upload/init", {
    method: "POST",
    body: JSON.stringify({ folderId, files }),
  });
  if (!res.ok) throw new Error(`Failed to init upload (${res.status})`);
  return res.json();
}

export async function completeChunk(
  chunkId: string,
  providerFileId: string,
  checksum: string,
): Promise<void> {
  const res = await apiFetch(`/files/chunks/${chunkId}/complete`, {
    method: "POST",
    body: JSON.stringify({ providerFileId, checksum }),
  });
  if (!res.ok) throw new Error(`Failed to complete chunk (${res.status})`);
}

export async function completeFile(
  fileId: string,
  checksum?: string,
): Promise<void> {
  const res = await apiFetch(`/files/${fileId}/complete`, {
    method: "POST",
    body: JSON.stringify({ checksum }),
  });
  if (!res.ok) throw new Error(`Failed to complete file (${res.status})`);
}
