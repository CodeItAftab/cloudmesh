import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
};

export type SetupStackParamList = {
  ConnectFirstAccount: undefined;
};

export type FilesStackParamList = {
  FileBrowser: { folderId: string; folderName: string } | undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  FilesTab: undefined;
  AccountsTab: undefined;
  SettingsTab: undefined;
};

export type FilesStackScreenProps<T extends keyof FilesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<FilesStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type SetupStackScreenProps<T extends keyof SetupStackParamList> =
  NativeStackScreenProps<SetupStackParamList, T>;
