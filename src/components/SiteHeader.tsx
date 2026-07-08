"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { publicPolicyLinks, recordsTagline, siteName } from "@/lib/site";

const navItems = [{ href: "/records", label: "Records" }, ...publicPolicyLinks];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/app-icons/icon-192.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-md bg-slate-950 shadow-sm"
          />
          <span>
            <span className="block text-sm font-semibold tracking-tight text-slate-950">
              {siteName}
            </span>
            <span className="block text-xs text-slate-500">
              {recordsTagline}
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 font-medium transition ${
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
