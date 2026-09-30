import RenderDoneToast from "@/components/RenderDoneToast"
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.reelezy.com"),
  title: "Reelezy - Social Media Generator and Editor",
  description: "Reelezy generates AI-powered content ideas, step-by-step filming instructions, and automatic video editing for small businesses and creators. Plan, film, and post consistently - anywhere in the world.",
  keywords: ["social media content generator", "AI video editor", "small business marketing", "content ideas generator", "video editing app", "social media scheduler"],
  openGraph: {
    title: "Reelezy - Social Media Generator and Editor",
    description: "AI-powered content ideas, filming instructions, and automatic video editing for small businesses and creators. Plan, film, and post consistently - anywhere in the world.",
    url: "https://www.reelezy.com",
    siteName: "Reelezy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reelezy - Social Media Generator and Editor",
    description: "AI-powered content ideas, filming instructions, and automatic video editing for small businesses and creators.",
  },
  alternates: {
    canonical: "https://www.reelezy.com",
  },
};

const themeScript = `
(function () {
  document.documentElement.classList.add('dark');
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
      </body>
    </html>
  );
}
