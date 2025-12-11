// src/app/listhaus/page.tsx
import Link from "next/link";

export default function ListhausPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="rounded-2xl border border-brand-border bg-black/55 px-5 py-6 text-sm text-neutral-100 shadow-xl backdrop-blur-sm">
          <h1 className="text-2xl font-semibold mb-2">Listhaus</h1>
          <p className="text-xs text-neutral-400 mb-4">
            Listhaus is a separate project from the same builder. It is a small
            online marketplace for real people who want a calmer place to buy
            and sell.
          </p>

          <h2 className="mt-2 mb-1 text-sm font-semibold text-neutral-50">
            What Listhaus is for
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            Listhaus focuses on local style listings with simple tools and a
            subscription that keeps out bots and spam. It aims to feel quieter
            than the large social media markets and to give more control back to
            individual sellers.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            Why it is linked here
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            Both Listhaus and LostToFound are built with the same approach:
            small, focused tools that try to respect people and avoid data
            mining. If you like the way LostToFound feels you may also want to
            explore Listhaus for selling items you no longer need.
          </p>

          <div className="mt-4">
            <a
              href="https://list.haus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400"
            >
              Open Listhaus in a new tab
            </a>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Listhaus runs on its own account system and billing. Your
            LostToFound login and subscription do not carry over.
          </p>
        </section>
      </div>
    </div>
  );
}