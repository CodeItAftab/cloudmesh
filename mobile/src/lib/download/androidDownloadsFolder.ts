import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const CLOUDMESH_FOLDER_URI_KEY = "cloudmesh_downloads_folder_uri";

// Points the Android SAF picker directly at the Downloads directory so the
// user only has to tap "Use this folder" instead of navigating there.
const DOWNLOADS_INITIAL_URI =
  "content://com.android.externalstorage.documents/document/primary:Download";

async function getPersistedCloudMeshFolderUri(): Promise<string | null> {
  return await SecureStore.getItemAsync(CLOUDMESH_FOLDER_URI_KEY);
}

async function persistCloudMeshFolderUri(uri: string): Promise<void> {
  await SecureStore.setItemAsync(CLOUDMESH_FOLDER_URI_KEY, uri);
}

async function findOrCreateCloudMeshSubfolder(
  parentDirUri: string,
): Promise<string> {
  const { StorageAccessFramework: SAF } = FileSystem;

  const existingEntries = await SAF.readDirectoryAsync(parentDirUri);
  const existing = existingEntries.find((uri) =>
    uri.toLowerCase().includes("cloudmesh"),
  );
  if (existing) return existing;

  return await SAF.makeDirectoryAsync(parentDirUri, "cloudmesh");
}

/**
 * Returns a persisted, reusable SAF directory URI pointing at
 * Download/cloudmesh. Prompts the user exactly once, ever (per app
 * install) — every call after the first reuses the stored permission with
 * no UI interaction.
 */
export async function getCloudMeshDownloadsFolderUri(): Promise<string> {
  const persisted = await getPersistedCloudMeshFolderUri();
  if (persisted) {
    // Verify the permission is still valid — the user could have revoked
    // it manually in system settings. A cheap way to check: try listing it.
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(persisted);
      return persisted;
    } catch {
      // Permission revoked or folder gone — fall through and re-request.
      await SecureStore.deleteItemAsync(CLOUDMESH_FOLDER_URI_KEY);
    }
  }

  const { StorageAccessFramework: SAF } = FileSystem;
  const permission = await SAF.requestDirectoryPermissionsAsync(
    DOWNLOADS_INITIAL_URI,
  );

  if (!permission.granted) {
    throw new Error(
      "Storage permission was not granted — cannot save downloads.",
    );
  }

  const cloudMeshUri = await findOrCreateCloudMeshSubfolder(
    permission.directoryUri,
  );
  await persistCloudMeshFolderUri(cloudMeshUri);
  return cloudMeshUri;
}
