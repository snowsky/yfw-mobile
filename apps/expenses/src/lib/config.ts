const fallbackApiUrl = "http://localhost:8000/api/v1";
const fallbackExpenseAppId = "yfw-expense-demo";

if (process.env.NODE_ENV === "production") {
  if (!process.env.EXPO_PUBLIC_API_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is required for production builds (would fall back to localhost)."
    );
  }
  if (!process.env.EXPO_PUBLIC_EXPENSE_APP_ID) {
    throw new Error(
      "EXPO_PUBLIC_EXPENSE_APP_ID is required for production builds (would fall back to demo id)."
    );
  }
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl;

export const EXPENSE_APP_ID =
  process.env.EXPO_PUBLIC_EXPENSE_APP_ID ?? fallbackExpenseAppId;
