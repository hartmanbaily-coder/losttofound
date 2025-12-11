// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "LostToFound.org: emergency management for lost pets",
  description: "Quick, privacy focused pet profiles linked to QR tags.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-50 antialiased overflow-x-hidden">
        <div
          className="
            mx-auto flex min-h-screen w-full flex-col
            px-3 sm:px-4 lg:px-6
            max-w-screen-lg xl:max-w-screen-xl
          "
        >
          {/* Header */}
          <SiteHeader />

          {/* Page content */}
          <main className="flex-1 py-4">{children}</main>

          {/* Footer */}
          <footer className="border-t border-neutral-900 py-3 text-[11px] text-neutral-500">
            LostToFound • Built for quick reunion, not data mining.
          </footer>
        </div>
      </body>
    </html>
  );
}
