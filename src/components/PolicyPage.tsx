import Link from "next/link";
import type { ReactNode } from "react";

import { policyLastUpdated, publicPolicyLinks, siteName, supportEmail, supportMailto } from "@/lib/site";

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
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <Link href="/records" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-sm font-bold text-white">
              L2F
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950">
                {siteName}
              </span>
              <span className="block text-xs text-slate-500">Policy center</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {publicPolicyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Last updated {policyLastUpdated}. {description}
          </p>
        </section>

        {notice && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            {notice}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-5">
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

        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
          <h2 className="text-base font-semibold text-slate-950">Contact</h2>
          <p className="mt-2">
            For privacy, security, accessibility, account, or policy questions, email{" "}
            <a href={supportMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
              {supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
