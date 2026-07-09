import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  policyLastUpdated,
  publicPolicyLinks,
  recordsTagline,
  siteLogoPath,
  siteName,
  supportEmail,
  supportMailto,
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

function isActivePolicyLink(title: string, label: string) {
  return (
    title.toLowerCase().includes(label.toLowerCase()) ||
    (title === "Privacy Policy" && label === "Privacy") ||
    (title === "Accessibility Statement" && label === "Accessibility")
  );
}

export function PolicyPage({ title, description, notice, sections, children }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <Image
                src={siteLogoPath}
                alt=""
                width={40}
                height={40}
                priority
                className="h-10 w-10 shrink-0 shadow-sm"
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

          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm">
            {publicPolicyLinks.map((item) => {
              const isActive = isActivePolicyLink(title, item.label);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-md px-3 py-2 font-medium transition ${
                    isActive
                      ? "bg-teal-700 text-white"
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              Policy center
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {recordsTagline}
            </p>
            <div className="mt-4 grid gap-1">
              {publicPolicyLinks.map((item) => {
                const isActive = isActivePolicyLink(title, item.label);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-teal-50 text-teal-800"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="flex items-start gap-4">
              <Image
                src={siteLogoPath}
                alt=""
                width={48}
                height={48}
                className="hidden h-12 w-12 shrink-0 shadow-sm sm:block"
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

          {notice && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {notice}
            </section>
          )}

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

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-base font-semibold text-slate-950">Contact</h2>
            <p className="mt-2">
              For privacy, security, accessibility, account, or policy questions, email{" "}
              <a href={supportMailto} className="font-mono font-semibold text-teal-700 underline underline-offset-2">
                {supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
