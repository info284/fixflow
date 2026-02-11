export const runtime = "nodejs";

import QRCode from "qrcode";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
const { searchParams } = new URL(req.url);
const slug = searchParams.get("slug");

if (!slug) return new Response("Missing slug", { status: 400 });

const url = `https://thefixflowapp.com/${slug}`;

const png = await QRCode.toBuffer(url, {
type: "png",
width: 512,
margin: 2,
errorCorrectionLevel: "M",
color: {
dark: "#0B1C2D", // Deep Navy
light: "#FFFFFF",
},
});

return new Response(png, {
headers: {
"Content-Type": "image/png",
"Cache-Control": "public, max-age=86400",
},
});
}