"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { attorneyMutation, getRecordsCsrfToken } from "@/lib/records/attorneyClient";
import { readRecordsSession } from "@/lib/records/clientStore";

type AcceptanceState = "preparing" | "signed_out" | "ready" | "accepted" | "error";

export default function AttorneyAccept() {
  const [state, setState] = useState<AcceptanceState>("preparing");
  const [message, setMessage] = useState("Preparing the secure invitation…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function prepare() {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const token = fragment.get("token") || "";
      window.history.replaceState(null, "", "/attorney/accept");
      if (token) {
        try {
          const csrf = await getRecordsCsrfToken();
          await fetch("/api/records/attorney/accept/prepare", {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-L2F-CSRF": csrf },
            body: JSON.stringify({ token }),
          });
        } catch {
          // Keep the response generic; final acceptance performs authoritative validation.
        }
      }
      const session = await readRecordsSession().catch(() => ({ status: "signed_out" as const }));
      if (!active) return;
      if (session.status !== "signed_in") {
        setState("signed_out");
        setMessage("Sign in with the invited email account and complete authenticator verification.");
      } else {
        setState("ready");
        setMessage("You are signed in. Accept to open this matter with read-only access.");
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, []);

  async function accept() {
    setBusy(true);
    try {
      const result = await attorneyMutation("/api/records/attorney/accept", {});
      const accessHandle = String(result.accessHandle || "");
      if (!accessHandle) throw new Error("Invitation acceptance did not return shared access.");
      window.sessionStorage.setItem("l2f.attorney.access", accessHandle);
      setState("accepted");
      setMessage("Invitation accepted. Your seven-day read-only access period has started…");
      window.location.replace("/attorney");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Invitation is invalid, expired, already used, or belongs to another account."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f6] px-4 py-10 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Attorney guest access</p>
        <h1 className="mt-2 text-2xl font-semibold">Accept a read-only invitation</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Acceptance starts seven days of read-only access, during which you may return as often as needed.
          My Custody Case organizes user provided information. It does not verify allegations, provide legal advice,
          guarantee admissibility, create representation, or automatically create attorney-client privilege.
        </p>
        <p role="status" aria-live="polite" className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {state === "signed_out" ? (
            <Link href="/records?next=/attorney/accept" className="btn-primary">Sign in and verify MFA</Link>
          ) : null}
          {state === "ready" ? (
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void accept()}>
              {busy ? "Accepting…" : "Accept read-only access"}
            </button>
          ) : null}
          {(state === "error" || state === "accepted") ? <Link href="/attorney" className="btn-secondary">Shared With Me</Link> : null}
          <Link href="/records" className="btn-secondary">My Records</Link>
        </div>
      </section>
    </main>
  );
}
