// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "FixFlow — Job management for UK tradespeople",
  description: "FixFlow keeps every enquiry, job and invoice organised — from first contact to paid invoice. Built for busy UK trades. Start free.",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}