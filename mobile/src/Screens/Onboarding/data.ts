// src/screens/onboarding/data.ts
import { ImageSourcePropType } from "react-native";

export interface OnboardingPage {
  id: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  // Can accept either a standard image source or a local Lottie JSON object
  asset: {
    type: "image" | "lottie";
    source: ImageSourcePropType | any;
  };
}

export const ONBOARDING_DATA: OnboardingPage[] = [
  {
    id: "1",
    title: "Claim Your Free Terabytes",
    subtitle:
      "Combine the free tiers of Google Drive, OneDrive, Mega, and Dropbox. Turn scattered accounts into one giant storage pool.",
    backgroundColor: "#ffffff",
    asset: {
      type: "lottie",
      source: require("../../../assets/animations/one.json"), // Lottie JSON file
    },
  },
  {
    id: "2",
    title: "Unified Storage Mesh",
    subtitle:
      "Upload a file once. Our mesh system automatically distributes data blocks across your connected clouds seamlessly.",
    backgroundColor: "#ffffff",
    asset: {
      type: "lottie",
      source: require("../../../assets/animations/two.json"), // Your custom premium logo asset
    },
  },
  {
    id: "3",
    title: "Zero-Knowledge Security",
    subtitle:
      "Your files are encrypted client-side before distribution. Not even CloudMesh can see your data or master keys.",
    backgroundColor: "#ffffff",
    asset: {
      type: "lottie",
      source: require("../../../assets/animations/three.json"), // Lottie JSON file
    },
  },
];
