"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { notifyNativeSessionInvalidated } from "@/lib/records/clientStore";
import { accountDeletionMailto } from "@/lib/site";

type SessionStatus = "checking" | "authenticated" | "unauthenticated" | "unavailable";

type RequestState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; requestId: string; requestedAt: string; message: string }
  | { status: "error"; message: string };

export function AccountDeletionRequest() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/records/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (cancelled) return;

        if (response.ok) {
          const body = (await response.json()) as { session?: { email?: string } };
          setEmail(body.session?.email || "");
          setSessionStatus("authenticated");
          return;
        }

        setSessionStatus(response.status === 401 || response.status === 403 ? "unauthenticated" : "unavailable");
      } catch {
        if (!cancelled) setSessionStatus("unavailable");
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitDeletionRequest() {
    if (!confirmed || sessionStatus !== "authenticated") return;

    setRequestState({ status: "submitting" });
    try {
      const response = await fetch("/api/records/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ confirm: true }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        requestId?: string;
        requestedAt?: string;
        clearLocalSession?: boolean;
      };

      if (body.clearLocalSession === true || (response.ok && body.requestId)) {
        notifyNativeSessionInvalidated();
      }

      if (!response.ok || !body.requestId) {
        setRequestState({
          status: "error",
          message:
            body.error ||
            "Unable to submit the account deletion request. Sign in again or contact support.",
        });
        return;
      }

      setRequestState({
        status: "success",
        requestId: body.requestId,
        requestedAt: body.requestedAt || new Date().toISOString(),
        message: body.message || "Account deletion request received.",
      });
    } catch {
      setRequestState({
        status: "error",
        message: "Unable to submit the account deletion request. Check your connection and try again.",
      });
    }
  }

  const canSubmit =
    sessionStatus === "authenticated" && confirmed && requestState.status !== "submitting";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-base font-semibold text-slate-950">Request account deletion</h2>
      <p className="mt-3">
        Submit the request while signed in. You will be signed out immediately, and we aim to
        complete verified deletion requests within 30 days.
      </p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        {sessionStatus === "checking" && <p>Checking records sign-in status...</p>}
        {sessionStatus === "authenticated" && (
          <p>
            Signed in as{" "}
            <span className="font-semibold text-slate-900">{email || "your records account"}</span>.
          </p>
        )}
        {sessionStatus === "unauthenticated" && (
          <p>
            Sign in to the records workspace first, then return to this page to submit the account
            deletion request.
          </p>
        )}
        {sessionStatus === "unavailable" && (
          <p>
            We could not verify your sign-in. Try again or contact support from the email address
            connected to your account.
          </p>
        )}
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        />
        <span>
          I understand this will permanently delete my account and associated My Custody Case
          records, except information that must be retained by law.
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submitDeletionRequest}
          disabled={!canSubmit}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {requestState.status === "submitting" ? "Submitting..." : "Request account deletion"}
        </button>
        <Link
          href="/records"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
        >
          Open records workspace
        </Link>
        <a
          href={accountDeletionMailto}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
        >
          Email support instead
        </a>
      </div>

      {requestState.status === "success" && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="font-semibold">Account deletion request submitted.</p>
          <p className="mt-1">{requestState.message}</p>
          <p className="mt-2 text-xs">Save this request number: {requestState.requestId}</p>
        </div>
      )}

      {requestState.status === "error" && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {requestState.message}
        </div>
      )}
    </section>
  );
}
