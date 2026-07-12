// src/Components/Files/UploadActionFAB.tsx
// import React, { useState, useRef } from "react";
// import {
//   StyleSheet,
//   View,
//   Text,
//   TouchableOpacity,
//   Animated,
//   Pressable,
//   TouchableNativeFeedback,
//   Platform,
// } from "react-native";
// import { Ionicons } from "@expo/vector-icons";

// interface UploadActionFABProps {
//   onUploadFile: () => void;
//   onCreateFolder: () => void;
// }

// const SHEET_HEIGHT = 200;

// export function UploadActionFAB({
//   onUploadFile,
//   onCreateFolder,
// }: UploadActionFABProps) {
//   const [isOpen, setIsOpen] = useState(false);

//   const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
//   const fadeAnim = useRef(new Animated.Value(0)).current;

//   const handleOpenSheet = () => {
//     setIsOpen(true);
//     Animated.parallel([
//       Animated.timing(fadeAnim, {
//         toValue: 1,
//         duration: 140,
//         useNativeDriver: true,
//       }),
//       Animated.spring(slideAnim, {
//         toValue: 0,
//         tension: 110, // Fast, sharp engagement
//         friction: 12, // Stops bounce micro-movements
//         useNativeDriver: true,
//       }),
//     ]).start();
//   };

//   const handleCloseSheet = () => {
//     Animated.parallel([
//       Animated.timing(fadeAnim, {
//         toValue: 0,
//         duration: 110,
//         useNativeDriver: true,
//       }),
//       Animated.timing(slideAnim, {
//         toValue: SHEET_HEIGHT,
//         duration: 130,
//         useNativeDriver: true,
//       }),
//     ]).start(() => setIsOpen(false));
//   };

//   return (
//     <>
//       {/* FAB ACCENT BUTTON */}
//       <TouchableOpacity
//         style={styles.fabButton}
//         activeOpacity={0.85}
//         onPress={handleOpenSheet}
//       >
//         <Ionicons name="add" size={24} color="#FFFFFF" />
//       </TouchableOpacity>

//       {/* 🟢 HARDWARE LAYER GUARD:
//         We use an inline dynamic array structure to shift the zIndex and dimensions.
//         When closed, height/width are 0 so it's impossible to accidentally click,
//         but Android keeps it fully pre-compiled in background memory.
//       */}
//       <View
//         style={[
//           styles.absoluteLayerWrapper,
//           isOpen ? styles.layerActive : styles.layerHidden,
//         ]}
//       >
//         {/* Dismiss Backing Scrim */}
//         <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSheet}>
//           <Animated.View
//             style={[styles.scrimBackground, { opacity: fadeAnim }]}
//           />
//         </Pressable>

//         {/* THE FIXED LOCKED PANEL CONTAINER SHEET */}
//         <Animated.View
//           style={[
//             styles.driveSheetChassis,
//             {
//               opacity: fadeAnim,
//               transform: [{ translateY: slideAnim }],
//             },
//           ]}
//         >
//           {/* Top Center Drag Indicator Handle */}
//           <View style={styles.sheetDragHandle} />

//           <Text style={styles.sheetSectionTitleText}>Create new</Text>

//           {/* 3-COLUMN RIPPLE GRID MATRIX */}
//           <View style={styles.actionGridMatrix}>
//             {/* ITEM 1: CREATE FOLDER */}
//             <View style={styles.gridActionItemNode}>
//               <View style={styles.rippleCardOverflowContainer}>
//                 <TouchableNativeFeedback
//                   onPress={() => {
//                     handleCloseSheet();
//                     onCreateFolder();
//                   }}
//                   background={TouchableNativeFeedback.Ripple(
//                     "rgba(0, 0, 0, 0.06)",
//                     false,
//                   )}
//                 >
//                   <View
//                     style={[
//                       styles.circleIconPill,
//                       { backgroundColor: "#FEF3C7" },
//                     ]}
//                   >
//                     <Ionicons name="folder" size={20} color="#D97706" />
//                   </View>
//                 </TouchableNativeFeedback>
//               </View>
//               <Text style={styles.actionLabelString}>Folder</Text>
//             </View>

//             {/* ITEM 2: UPLOAD FILE */}
//             <View style={styles.gridActionItemNode}>
//               <View style={styles.rippleCardOverflowContainer}>
//                 <TouchableNativeFeedback
//                   onPress={() => {
//                     handleCloseSheet();
//                     onUploadFile();
//                   }}
//                   background={TouchableNativeFeedback.Ripple(
//                     "rgba(0, 0, 0, 0.06)",
//                     false,
//                   )}
//                 >
//                   <View
//                     style={[
//                       styles.circleIconPill,
//                       { backgroundColor: "#EFF6FF" },
//                     ]}
//                   >
//                     <Ionicons name="cloud-upload" size={18} color="#0066FF" />
//                   </View>
//                 </TouchableNativeFeedback>
//               </View>
//               <Text style={styles.actionLabelString}>Upload</Text>
//             </View>

//             {/* ITEM 3: SCANNER NODE */}
//             <View style={styles.gridActionItemNode}>
//               <View style={styles.rippleCardOverflowContainer}>
//                 <TouchableNativeFeedback
//                   onPress={() => {
//                     handleCloseSheet();
//                     console.log("Scan Document executed");
//                   }}
//                   background={TouchableNativeFeedback.Ripple(
//                     "rgba(0, 0, 0, 0.06)",
//                     false,
//                   )}
//                 >
//                   <View
//                     style={[
//                       styles.circleIconPill,
//                       { backgroundColor: "#E1F5FE" },
//                     ]}
//                   >
//                     <Ionicons name="scan" size={18} color="#0284C7" />
//                   </View>
//                 </TouchableNativeFeedback>
//               </View>
//               <Text style={styles.actionLabelString}>Scan</Text>
//             </View>
//           </View>
//         </Animated.View>
//       </View>
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   fabButton: {
//     position: "absolute",
//     bottom: 24,
//     right: 20,
//     width: 52,
//     height: 52,
//     borderRadius: 26,
//     backgroundColor: "#0066FF",
//     justifyContent: "center",
//     alignItems: "center",
//     elevation: 6,
//     zIndex: 99,
//   },

//   /* 🟢 LAYOUT ENGINE STABILIZATION RULES */
//   absoluteLayerWrapper: {
//     position: "absolute",
//     top: 0,
//     left: 0,
//   },
//   layerActive: {
//     width: "100%",
//     height: "100%",
//     zIndex: 999,
//   },
//   layerHidden: {
//     width: 0,
//     height: 0,
//     zIndex: -1, // Pushes it backward beneath everything immediately when closed
//   },

//   scrimBackground: {
//     ...StyleSheet.absoluteFill,
//     backgroundColor: "rgba(15, 23, 42, 0.3)",
//   },
//   driveSheetChassis: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: SHEET_HEIGHT,
//     backgroundColor: "#FFFFFF",
//     borderTopLeftRadius: 28,
//     borderTopRightRadius: 28,
//     paddingHorizontal: 24,
//     paddingTop: 12,
//     paddingBottom: 24,
//     elevation: 24,
//   },
//   sheetDragHandle: {
//     width: 36,
//     height: 4,
//     backgroundColor: "#E2E8F0",
//     borderRadius: 2,
//     alignSelf: "center",
//     marginBottom: 18,
//   },
//   sheetSectionTitleText: {
//     fontSize: 12,
//     fontWeight: "700",
//     color: "#64748B",
//     marginBottom: 20,
//     letterSpacing: 0.6,
//     textTransform: "uppercase",
//   },
//   actionGridMatrix: {
//     flexDirection: "row",
//     justifyContent: "flex-start",
//     alignItems: "center",
//     gap: 32,
//   },
//   gridActionItemNode: {
//     alignItems: "center",
//     width: 56,
//   },
//   rippleCardOverflowContainer: {
//     borderRadius: 26,
//     overflow: "hidden",
//     marginBottom: 8,
//   },
//   circleIconPill: {
//     width: 52,
//     height: 52,
//     borderRadius: 26,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   actionLabelString: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#334155",
//   },
// });

// src/Components/Files/UploadActionFAB.tsx
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Pressable,
  TouchableNativeFeedback,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface UploadActionFABProps {
  onUploadFile: () => void;
  onCreateFolder: (folderName: string) => void; // 🟢 Updated to pass the name string back
}

const SHEET_HEIGHT = 200;

export function UploadActionFAB({
  onUploadFile,
  onCreateFolder,
}: UploadActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isInputModalVisible, setIsInputModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleOpenSheet = () => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 110,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCloseSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const handleCreateSubmit = () => {
    const trimmedName = newFolderName.trim();
    if (trimmedName) {
      onCreateFolder(trimmedName);
      setNewFolderName("");
      setIsInputModalVisible(false);
    }
  };

  return (
    <>
      {/* FAB ACCENT BUTTON */}
      <TouchableOpacity
        style={styles.fabButton}
        activeOpacity={0.85}
        onPress={handleOpenSheet}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* HARDWARE LAYER GUARD SHEET CONTROL */}
      <View
        style={[
          styles.absoluteLayerWrapper,
          isOpen ? styles.layerActive : styles.layerHidden,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => handleCloseSheet()}
        >
          <Animated.View
            style={[styles.scrimBackground, { opacity: fadeAnim }]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.driveSheetChassis,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.sheetDragHandle} />
          <Text style={styles.sheetSectionTitleText}>Create new</Text>

          <View style={styles.actionGridMatrix}>
            {/* ITEM 1: CREATE FOLDER */}
            <View style={styles.gridActionItemNode}>
              <View style={styles.rippleCardOverflowContainer}>
                <TouchableNativeFeedback
                  onPress={() =>
                    handleCloseSheet(() => setIsInputModalVisible(true))
                  }
                  background={TouchableNativeFeedback.Ripple(
                    "rgba(0, 0, 0, 0.06)",
                    false,
                  )}
                >
                  <View
                    style={[
                      styles.circleIconPill,
                      { backgroundColor: "#FEF3C7" },
                    ]}
                  >
                    <Ionicons name="folder" size={20} color="#D97706" />
                  </View>
                </TouchableNativeFeedback>
              </View>
              <Text style={styles.actionLabelString}>Folder</Text>
            </View>

            {/* ITEM 2: UPLOAD FILE */}
            <View style={styles.gridActionItemNode}>
              <View style={styles.rippleCardOverflowContainer}>
                <TouchableNativeFeedback
                  onPress={() => handleCloseSheet(() => onUploadFile())}
                  background={TouchableNativeFeedback.Ripple(
                    "rgba(0, 0, 0, 0.06)",
                    false,
                  )}
                >
                  <View
                    style={[
                      styles.circleIconPill,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Ionicons name="cloud-upload" size={18} color="#0066FF" />
                  </View>
                </TouchableNativeFeedback>
              </View>
              <Text style={styles.actionLabelString}>Upload</Text>
            </View>

            {/* ITEM 3: SCANNER NODE */}
            <View style={styles.gridActionItemNode}>
              <View style={styles.rippleCardOverflowContainer}>
                <TouchableNativeFeedback
                  onPress={() =>
                    handleCloseSheet(() =>
                      console.log("Scan Document executed"),
                    )
                  }
                  background={TouchableNativeFeedback.Ripple(
                    "rgba(0, 0, 0, 0.06)",
                    false,
                  )}
                >
                  <View
                    style={[
                      styles.circleIconPill,
                      { backgroundColor: "#E1F5FE" },
                    ]}
                  >
                    <Ionicons name="scan" size={18} color="#0284C7" />
                  </View>
                </TouchableNativeFeedback>
              </View>
              <Text style={styles.actionLabelString}>Scan</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* 🟢 NEW FOLDER INPUT DIALOGUE BOX */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isInputModalVisible}
        onRequestClose={() => setIsInputModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.dialogOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsInputModalVisible(false)}
          />

          <View style={styles.dialogChassis}>
            <Text style={styles.dialogTitle}>New folder</Text>

            <TextInput
              style={styles.dialogInput}
              placeholder="Folder name"
              placeholderTextColor="#94A3B8"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateSubmit}
            />

            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={styles.dialogButton}
                onPress={() => {
                  setIsInputModalVisible(false);
                  setNewFolderName("");
                }}
              >
                <Text style={[styles.dialogButtonText, { color: "#64748B" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogButton}
                onPress={handleCreateSubmit}
                disabled={!newFolderName.trim()}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: "#0066FF" },
                    !newFolderName.trim() && { opacity: 0.4 },
                  ]}
                >
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabButton: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0066FF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    zIndex: 99,
  },
  absoluteLayerWrapper: { position: "absolute", top: 0, left: 0 },
  layerActive: { width: "100%", height: "100%", zIndex: 999 },
  layerHidden: { width: 0, height: 0, zIndex: -1 },
  scrimBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },
  driveSheetChassis: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    elevation: 24,
  },
  sheetDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetSectionTitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 20,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  actionGridMatrix: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 32,
  },
  gridActionItemNode: { alignItems: "center", width: 56 },
  rippleCardOverflowContainer: {
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 8,
  },
  circleIconPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabelString: { fontSize: 12, fontWeight: "600", color: "#334155" },

  /* 🟢 DIALOG MODAL LAYOUT STYLES */
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  dialogChassis: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    elevation: 24,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  dialogInput: {
    width: "100%",
    height: 44,
    borderBottomWidth: 2,
    borderBottomColor: "#0066FF",
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  dialogActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  dialogButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  dialogButtonText: { fontSize: 14, fontWeight: "700" },
});
