import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FileBrowserScreen } from "../Screens/MainTab/FileBrowserScreen";
import { FilesStackParamList } from "./types";
import { UploadsScreen } from "../Screens/MainTab/upload/UploadsScreen";

const Stack = createNativeStackNavigator<FilesStackParamList>();

export function FilesNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FileBrowser"
        options={{ headerShown: false }}
        initialParams={{ folderId: "root", folderName: "Files" }}
        component={FileBrowserScreen}
      />
      <Stack.Screen
        name="UploadsScreen"
        options={{
          title: "Uploads",
          presentation: "modal",
          headerShown: false,
        }}
        component={UploadsScreen}
      />
    </Stack.Navigator>
  );
}
