import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { UploadActionFAB } from "../../components/Files/UploadActionFAB";
import { UploadMiniBar } from "../../components/Upload/UploadMiniBar";
import {
  FolderItem,
  getFolderContents,
  FileItem,
  createFolder,
} from "../../lib/api/files";
import { FilesStackScreenProps } from "../../navigation/types";

import { pickFiles, queueUploads } from "../../lib/upload/uploadManager";
import { processUploadQueue } from "../../lib/upload/uploadRunner";
import { useUploadUIStore } from "../../lib/upload/uploadUIStore";
import { getLocalMasterKey } from "../../lib/keyManager";
import { downloadAndDecryptFile } from "../../lib/download/downloadManager";

type Row =
  | { type: "folder"; data: FolderItem & { isCreating: boolean } }
  | {
      type: "file";
      data: FileItem & { ext: "pdf" | "xlsx" | "png" | undefined };
    };

function rowKey(row: Row) {
  return `${row.type}-${row.data.id}`;
}

function formatSize(bytes: string): string {
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIconConfig(ext: "pdf" | "xlsx" | "png" | undefined) {
  switch (ext) {
    case "pdf":
      return { name: "document-text" as const, color: "#EF4444" };
    case "xlsx":
      return { name: "stats-chart" as const, color: "#10B981" };
    case "png":
      return { name: "image" as const, color: "#3B82F6" };
    default:
      return { name: "document-outline" as const, color: "#64748B" };
  }
}

export function FileBrowserScreen({
  route,
  navigation,
}: FilesStackScreenProps<"FileBrowser">) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const folderId = route.params?.folderId ?? "root";
  const folderName = route.params?.folderName ?? "Files";

  const [rows, setRows] = useState<Row[]>([]);

  const activeUploadList = useUploadUIStore((state) => state.activeUploadList);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null,
  );
  const [downloadProgressPercent, setDownloadProgressPercent] =
    useState<number>(0);

  // 🔧 silent param — lets background refreshes skip the full-screen spinner
  const loadFolderContents = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsLoading(true);
        const { folders, files } = await getFolderContents(folderId);

        const combinedRows: Row[] = [
          ...folders.map(
            (f) =>
              ({ type: "folder", data: { ...f, isCreating: false } }) as Row,
          ),
          ...files.map((f) => {
            const filenameLower = f.filename.toLowerCase();
            let ext: "pdf" | "xlsx" | "png" | undefined;
            if (filenameLower.endsWith(".pdf")) ext = "pdf";
            else if (
              filenameLower.endsWith(".xlsx") ||
              filenameLower.endsWith(".xls")
            )
              ext = "xlsx";
            else if (filenameLower.endsWith(".png")) ext = "png";

            return { type: "file", data: { ...f, ext } } as Row;
          }),
        ];

        setRows(combinedRows);
      } catch (error) {
        console.log("Error loading folder contents:", error);
      } finally {
        if (!silent) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [folderId],
  );

  useEffect(() => {
    navigation.setOptions({ title: folderName });
    loadFolderContents(); // initial load — show spinner
  }, [folderId]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadFolderContents(); // pull-to-refresh — show spinner briefly
  }, [loadFolderContents]);

  // 🔧 Silently refresh the folder once any upload transitions to "completed",
  // so the new file appears without a jarring full-screen reload.
  const prevCompletedCountRef = useRef(0);
  useEffect(() => {
    if (activeUploadList.length === 0) return; // skip work when nothing's active
    const completedCount = activeUploadList.filter(
      (u) => u.status === "completed",
    ).length;
    if (completedCount > prevCompletedCountRef.current) {
      loadFolderContents(true); // silent
    }
    prevCompletedCountRef.current = completedCount;
  }, [activeUploadList, loadFolderContents]);

  const handleUploadFile = async () => {
    const masterKeyHex = await getLocalMasterKey();
    if (!masterKeyHex) {
      Alert.alert(
        "Encryption Error",
        "Master key is not ready or missing on this device.",
      );
      return;
    }

    const assets = await pickFiles();
    if (assets.length === 0) return;

    const store = useUploadUIStore.getState();
    const tempIds = assets.map((a, i) => `planning-${Date.now()}-${i}`);
    assets.forEach((asset, i) =>
      store.addPlanningItem(tempIds[i], asset.name, asset.size ?? 0),
    );

    try {
      await queueUploads(
        assets,
        folderId === "root" ? null : folderId,
        masterKeyHex,
        {
          tempIds,
          onFileQueued: (tempId) => store.clearPlanningItem(tempId),
        },
      );

      await store.syncUIStats();
      processUploadQueue();
      loadFolderContents(true); // 🔧 silent — the file shows once the upload finishes anyway
    } catch (error) {
      tempIds.forEach((tempId) => store.clearPlanningItem(tempId));
      Alert.alert(
        "Upload Failed",
        error instanceof Error
          ? error.message
          : "An unexpected execution error occurred.",
      );
    }
  };

  const handleDownloadFile = async (
    fileId: string,
    filename: string,
    totalBytes: number,
  ) => {
    console.log("🔍 handleDownloadFile called for:", filename);
    if (downloadingFileId) return; // one at a time for now, keep it simple

    const masterKeyHex = await getLocalMasterKey();
    console.log("🔍 masterKeyHex present:", !!masterKeyHex);
    if (!masterKeyHex) {
      Alert.alert(
        "Decryption Error",
        "Master key is not ready or missing on this device.",
      );
      return;
    }

    setDownloadingFileId(fileId);
    setDownloadProgressPercent(0);

    try {
      console.log("🔍 Calling downloadAndDecryptFile...");
      const destPath = await downloadAndDecryptFile(
        fileId,
        masterKeyHex,
        (progress) => {
          const pct =
            progress.totalBytes > 0
              ? Math.round(
                  (progress.bytesDownloaded / progress.totalBytes) * 100,
                )
              : 0;
          console.log("🔍 progress:", progress.stage, pct + "%");
          setDownloadProgressPercent(pct);
        },
      );

      console.log("🔍 Download succeeded, destPath:", destPath);

      Alert.alert(
        "Download Complete",
        `"${filename}" saved to Download/cloudmesh`,
      );
    } catch (error) {
      console.log("🔍 Download threw error:", error);
      Alert.alert(
        "Download Failed",
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setDownloadingFileId(null);
      setDownloadProgressPercent(0);
    }
  };

  const handleCreateFolder = async (name: string) => {
    const tempId = `temp-dir-${Date.now()}`;
    const optimisticFolder: Row = {
      type: "folder",
      data: {
        id: tempId,
        name,
        parentFolderId: folderId,
        createdAt: new Date().toISOString(),
        isCreating: true,
      },
    };

    setRows((prev) => [optimisticFolder, ...prev]);

    try {
      const real = await createFolder(
        name,
        folderId === "root" ? null : folderId,
      );
      setRows((prev) =>
        prev.map((row) =>
          row.type === "folder" && row.data.id === tempId
            ? { type: "folder", data: { ...real, isCreating: false } }
            : row,
        ),
      );
    } catch (error) {
      setRows((prev) =>
        prev.filter((r) => !(r.type === "folder" && r.data.id === tempId)),
      );
      console.log("Error creating folder:", error);
    }
  };

  const handleConfirmDeleteMock = (row: Row) => {
    if (row.type === "folder" && row.data.isCreating) return;
    const name = row.type === "folder" ? row.data.name : row.data.filename;
    Alert.alert("Delete", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          setRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(row))),
      },
    ]);
  };

  const filteredRows = rows.filter((row) => {
    const name = row.type === "folder" ? row.data.name : row.data.filename;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
      <View style={[styles.searchOuterBox, { marginTop: insets.top + 16 }]}>
        <View style={styles.searchBarLayout}>
          <Ionicons
            name="search-outline"
            size={18}
            color="#94A3B8"
            style={{ marginRight: 12 }}
          />
          <TextInput
            style={styles.searchInputText}
            placeholder="Search documents..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CONTENT STREAM */}
      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={{ marginTop: 12, color: "#64748B" }}>
            Getting your files ready...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={rowKey}
          contentContainerStyle={styles.listContainerOffset}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#0066FF"
              colors={["#0066FF"]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyLayoutTitle}>
              No items found matching criteria
            </Text>
          }
          renderItem={({ item }) => {
            const isFolder = item.type === "folder";
            const isCreating = (isFolder && item.data?.isCreating) ?? false;

            const liveUpload = !isFolder
              ? activeUploadList.find((u) => u.fileId === item.data.id)
              : undefined;

            const status = liveUpload
              ? liveUpload.status.toUpperCase()
              : isFolder
                ? "COMPLETE"
                : item.data.status;
            const progress = liveUpload ? liveUpload.progressPercent : 0;

            const iconConfig = !isFolder
              ? getFileIconConfig(item.data.ext)
              : {
                  name: "folder" as const,
                  color: isCreating ? "#94A3B8" : "#0066FF",
                };

            return (
              <TouchableOpacity
                style={[
                  styles.directoryRowItem,
                  isCreating && styles.rowDisabledState,
                ]}
                activeOpacity={isCreating ? 1 : 0.6}
                onPress={() => {
                  if (!isCreating && isFolder) {
                    navigation.push("FileBrowser", {
                      folderId: item.data.id,
                      folderName: item.data.name,
                    });
                  } else if (!isFolder && status === "COMPLETED") {
                    handleDownloadFile(
                      item.data.id,
                      item.data.filename,
                      Number(item.data.sizeBytes),
                    );
                  }
                }}
              >
                <View style={styles.metaLeftFlex}>
                  <View
                    style={[
                      styles.iconCanvasContainer,
                      { backgroundColor: `${iconConfig.color}0D` },
                    ]}
                  >
                    <Ionicons
                      name={iconConfig.name}
                      size={20}
                      color={iconConfig.color}
                    />
                  </View>

                  <View style={styles.labelTextBlock}>
                    <Text
                      style={[
                        styles.mainTitleString,
                        isCreating && { color: "#64748B" },
                      ]}
                      numberOfLines={1}
                    >
                      {isFolder ? item.data.name : item.data.filename}
                    </Text>

                    {!isFolder &&
                      (status === "UPLOADING" || status === "PLANNING") && (
                        <Text style={styles.progressTrackerText}>
                          Syncing to cloud • {progress}%
                        </Text>
                      )}
                    {!isFolder && status === "FAILED" && (
                      <Text
                        style={[
                          styles.progressTrackerText,
                          { color: "#EF4444" },
                        ]}
                      >
                        Upload interrupted / failed
                      </Text>
                    )}
                    {!isFolder && status === "COMPLETED" && (
                      <Text style={styles.subtextMetaString}>
                        {downloadingFileId === item.data.id
                          ? `Downloading • ${downloadProgressPercent}%`
                          : `${formatSize(item.data.sizeBytes)} • Tap to download`}
                      </Text>
                    )}
                    {isFolder && (
                      <Text
                        style={[
                          styles.subtextMetaString,
                          isCreating && { color: "#0066FF", fontWeight: "600" },
                        ]}
                      >
                        {isCreating
                          ? "Creating directory..."
                          : item.data.createdAt}
                      </Text>
                    )}
                  </View>
                </View>

                {isCreating ? (
                  <View style={styles.spinnerWrapper}>
                    <ActivityIndicator size="small" color="#0066FF" />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.optionsActionAnchor}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => handleConfirmDeleteMock(item)}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={14}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Multi-file panel tracking stats container overlays */}
      <UploadMiniBar />

      <UploadActionFAB
        onUploadFile={handleUploadFile}
        onCreateFolder={handleCreateFolder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  searchOuterBox: { paddingHorizontal: 20, marginBottom: 16 },
  searchBarLayout: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInputText: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  listContainerOffset: { paddingHorizontal: 20, paddingBottom: 110 },
  emptyLayoutTitle: {
    textAlign: "center",
    marginTop: 60,
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: -0.1,
  },
  directoryRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowDisabledState: {
    backgroundColor: "rgba(241, 245, 249, 0.4)",
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  metaLeftFlex: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 16,
  },
  iconCanvasContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  labelTextBlock: { flex: 1 },
  mainTitleString: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.15,
  },
  subtextMetaString: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  progressTrackerText: {
    color: "#0066FF",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
  },
  optionsActionAnchor: { padding: 4 },
  spinnerWrapper: {
    paddingRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
