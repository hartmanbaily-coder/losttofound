import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegistration from "@/components/PwaRegistration";
import { siteDescription, siteName } from "@/lib/site";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  applicationName: siteName,
  title: {
    default: "My Custody Case | Custody Logs and Evidence",
    template: "%s | My Custody Case",
  },
  description: siteDescription,
  metadataBase: new URL("https://losttofound.org"),
  alternates: {
    canonical: "/",
  },
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
    title: "My Custody Case",
  },
  openGraph: {
    type: "website",
    url: "https://losttofound.org",
    siteName,
    title: "My Custody Case",
    description: siteDescription,
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
  const websiteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: "https://losttofound.org/",
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
      </head>
      <body className="min-h-screen bg-slate-100 text-slate-950 antialiased overflow-x-hidden">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
