import type { NextConfig } from "next";

const nextConfig = {
  serverExternalPackages: ["pdfkit"],
} satisfies NextConfig;

export default nextConfig;