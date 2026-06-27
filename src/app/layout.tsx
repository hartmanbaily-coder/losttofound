import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lost to Found Records",
  description:
    "A privacy-first custody, parenting-time, child support, expense, evidence, and court-ready records workspace.",
  metadataBase: new URL("https://losttofound.org"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-950 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
