import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import PolicyFooter from "@/components/PolicyFooter";
import {
  policyLastUpdated,
  recordsTagline,
  siteName,
} from "@/lib/site";

export type PolicySection = {
  title: string;
  body: string[];
};

type PolicyPageProps = {
  title: string;
  description: string;
  notice?: string;
  sections: PolicySection[];
  children?: ReactNode;
};

export function PolicyPage({ title, description, notice, sections, children }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/app-icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0 rounded-md bg-slate-950 shadow-sm"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-slate-950">
                {siteName}
              </span>
              <span className="block text-xs leading-4 text-slate-500">
                {recordsTagline}
              </span>
            </span>
          </Link>

          <Link
            href="/records"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Open records workspace
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="flex items-start gap-4">
              <Image
                src="/app-icons/icon-192.png"
                alt=""
                width={48}
                height={48}
                className="hidden h-12 w-12 shrink-0 rounded-md bg-slate-950 shadow-sm sm:block"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                  {siteName}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Last updated {policyLastUpdated}. {description}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {section.body.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          {children}
        </div>
      </div>

      <PolicyFooter notice={notice} />
    </main>
  );
}
