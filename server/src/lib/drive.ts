const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

/**
 * Creates our app's dedicated storage folder inside a connected Drive account.
 * Called once, right after a user connects a new account.
 */

export async function createAppFolder(accessToken: string): Promise<string> {
  const res = await fetch(`${DRIVE_API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "CloudMesh",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to create app folder in Google Drive: ${res.status} ${res.statusText} - ${errorText}`,
    );
  }

  const data = await res.json();
  return data.id; // Return the ID of the created folder
}

/**
 * Fetches how much storage is used/available in this Drive account.
 * Used both right after connecting, and later by a periodic quota-sync worker.
 */

export async function getDriveQuota(
  accessToken: string,
): Promise<{ total: bigint; used: bigint }> {
  const res = await fetch(`${DRIVE_API_BASE}/about?fields=storageQuota`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to fetch Drive quota: ${res.status} ${res.statusText} - ${errorText}`,
    );
  }

  const data = (await res.json()) as {
    storageQuota: { limit: string; usage: string };
  };

  return {
    total: data.storageQuota.limit ? BigInt(data.storageQuota.limit) : 0n,
    used: data.storageQuota.usage ? BigInt(data.storageQuota.usage) : 0n,
  };
}

/**
 * Starts a Google Drive resumable upload session for one chunk.
 * Returns the session URL the client will PUT the actual bytes to directly.
 * Google's resumable session URL itself acts as the credential for the
 * subsequent PUTs -- no Authorization header needed on those (authMode: "none").
 */

export async function initResumableUploadSession(
  accessToken: string,
  parentFolderId: string,
  chunkFileName: string,
  sizeBytes: number,
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": sizeBytes.toString(),
        "X-Upload-Content-Type": "application/octet-stream",
      },
      body: JSON.stringify({
        name: chunkFileName,
        parents: [parentFolderId],
      }),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to initiate resumable upload session: ${res.status} ${res.statusText} - ${errorText}`,
    );
  }

  const location = res.headers.get("Location");
  if (!location) {
    throw new Error(
      `Failed to initiate resumable upload session: No 'Location' header in response.`,
    );
  }

  return location; // Return the session URL for the client to PUT the chunk bytes
}

/**
 * Builds a direct download URL for a chunk already stored in Drive.
 * The caller (client) must attach `Authorization: Bearer <accessToken>`
 * itself -- this is why our manifest format carries authMode: "bearer" here.
 */

export function buildDownloadUrl(providerFileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${providerFileId}?alt=media`;
}
