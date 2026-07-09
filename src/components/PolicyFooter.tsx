import Link from "next/link";

import {
  legalDisclaimer,
  publicPolicyLinks,
  recordsTagline,
  supportEmail,
  supportMailto,
} from "@/lib/site";

type PolicyFooterProps = {
  className?: string;
  notice?: string;
  recordsNote?: string;
};

export default function PolicyFooter({ className = "", notice, recordsNote }: PolicyFooterProps) {
  return (
    <footer className={`border-t border-slate-200 bg-white/75 ${className}`}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:px-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            Policy center
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {recordsTagline}
          </p>
          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            {publicPolicyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="space-y-4 text-sm leading-6 text-slate-600">
          {notice && (
            <div>
              <p className="font-semibold text-slate-950">Page note</p>
              <p className="mt-1">{notice}</p>
            </div>
          )}

          {recordsNote && (
            <div>
              <p className="font-semibold text-slate-950">Records note</p>
              <p className="mt-1">{recordsNote}</p>
            </div>
          )}

          <div>
            <p className="font-semibold text-slate-950">Disclaimer</p>
            <p className="mt-1">{legalDisclaimer}</p>
          </div>

          <p>
            Support:{" "}
            <a href={supportMailto} className="font-mono font-semibold text-teal-700 underline underline-offset-2">
              {supportEmail}
            </a>
          </p>
        </section>
      </div>
    </footer>
  );
}
