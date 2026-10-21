import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reelezy",
    short_name: "Reelezy",
    description: "Plan, film and edit social media videos for your business.",
    start_url: "/dashboard/overview",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16151c",
    theme_color: "#16151c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
