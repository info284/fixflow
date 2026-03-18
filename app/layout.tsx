// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "FixFlow",
  description: "Instant quotes from trusted local trades",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}