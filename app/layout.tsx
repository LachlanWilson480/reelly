import RenderDoneToast from "@/components/RenderDoneToast"
import ReferralTracker from "@/components/ReferralTracker"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.reelezy.com"),
  applicationName: "Reelezy",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  title: "Reelezy – Reels done for you, for cafés, salons and tradies",
  description: "Reelezy generates AI-powered content ideas, step-by-step filming instructions, and automatic video editing for small businesses and creators. Plan, film, and post consistently - anywhere in the world.",
  keywords: ["social media content generator", "AI video editor", "small business marketing", "content ideas generator", "video editing app", "social media scheduler"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reelezy",
  },
  openGraph: {
    title: "Reelezy – Reels done for you, for cafés, salons and tradies",
    description: "Know what to film, get a script to read, and get your reel edited with captions and music. Made for busy small-business owners in Australia.",
    url: "https://www.reelezy.com",
    siteName: "Reelezy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reelezy – Reels done for you, for cafés, salons and tradies",
    description: "Know what to film, get a script to read, and get your reel edited with captions and music.",
  },
  alternates: {
    canonical: "./",
  },
};

const themeScript = `
(function () {
  document.documentElement.classList.remove('dark');
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>

      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        {children}
      <RenderDoneToast />
      <ReferralTracker />
      <Analytics />
      <ServiceWorkerRegister />
      </body>
    </html>
  );
}
