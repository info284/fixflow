export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://thefixflowapp.com";

export const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${APP_URL}/api/calendar/callback`;
