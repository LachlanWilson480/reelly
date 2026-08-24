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
  title: "Reelly — AI Content Ideas & Video Editing for Social Media",
  description: "Reelly generates AI-powered content ideas, step-by-step filming instructions, and automatic video editing for small businesses. Plan, film, and post consistently — built for Sydney and beyond.",
};

const themeScript = `
(function () {
  try {
    var savedTheme = localStorage.getItem('reelly-theme');

    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      var hour = new Date().getHours();
      var isDark = hour >= 18 || hour < 6;

      document.documentElement.classList.toggle('dark', isDark);
    }
  } catch (e) {
    var hour = new Date().getHours();
    var isDark = hour >= 18 || hour < 6;

    document.documentElement.classList.toggle('dark', isDark);
  }
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
      </body>
    </html>
  );
}
