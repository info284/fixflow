// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
title: "FixFlow",
description:
"FixFlow keeps every enquiry, job and invoice organised — from first contact to paid invoice. Built for busy UK trades. Start free.",
applicationName: "FixFlow",
themeColor: "#0B2A55",
appleWebApp: {
capable: true,
title: "FixFlow",
statusBarStyle: "black-translucent",
},
icons: {
apple: "/icons/apple-touch-icon.png",
icon: [
{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
],
},
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en">
<body>{children}</body>
</html>
);
}