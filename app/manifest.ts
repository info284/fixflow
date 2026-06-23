import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
return {
name: "FixFlow",
short_name: "FixFlow",
description: "Enquiry, quote and job management for busy trade businesses.",
start_url: "/",
scope: "/",
display: "standalone",
background_color: "#0B1320",
theme_color: "#0B2A55",
icons: [
{
src: "/icons/icon-192.png",
sizes: "192x192",
type: "image/png",
},
{
src: "/icons/icon-512.png",
sizes: "512x512",
type: "image/png",
},
],
};
}