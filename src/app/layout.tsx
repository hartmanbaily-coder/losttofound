import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegistration from "@/components/PwaRegistration";
import { recordsTagline, siteName } from "@/lib/site";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  applicationName: siteName,
  title: siteName,
  description: recordsTagline,
  metadataBase: new URL("https://losttofound.org"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app-icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lost to Found",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-950 antialiased overflow-x-hidden">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
