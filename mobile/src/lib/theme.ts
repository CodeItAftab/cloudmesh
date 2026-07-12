export const lightTheme = {
  dark: false,
  colors: {
    background: "#ffffff",
    surface: "#f9fafb",
    text: "#111827",
    textSecondary: "#6b7280",
    accent: "#1a73e8",
    border: "#e5e7eb",
    error: "#d32f2f",
    success: "#16a34a",
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    background: "#0f1115",
    surface: "#1a1d23",
    text: "#f3f4f6",
    textSecondary: "#9ca3af",
    accent: "#4d94ff",
    border: "#2a2e37",
    error: "#f87171",
    success: "#4ade80",
  },
};

export type AppTheme = typeof lightTheme;
