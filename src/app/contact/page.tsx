export default function ContactPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Contact
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Send feedback about the private custody records workspace, evidence
          handling, report exports, privacy, security, or app bugs.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Email</h2>
        <p className="mt-2">
          For questions about the site, bugs, or ideas for the custody records
          workspace, email:
        </p>
        <p className="mt-3">
          <a
            href="mailto:listhaushelp@outlook.com"
            className="font-mono font-semibold text-emerald-700 underline underline-offset-2"
          >
            listhaushelp@outlook.com
          </a>
        </p>
      </section>
    </div>
  );
}
