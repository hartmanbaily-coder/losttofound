"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { attorneyMutation } from "@/lib/records/attorneyClient";

type Invitation = {
  handle: string;
  email: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  caseId: string;
  accessExpiresAt: string | null;
  accessActive: boolean;
};

type Grant = {
  handle: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  leftAt: string | null;
  active: boolean;
};

type AccessEvent = {
  type: string;
  createdAt: string;
  metadata: Record<string, string>;
};

type AttorneyAccessState = {
  invitations: Invitation[];
  grants: Grant[];
  events: AccessEvent[];
  delivery: "development_link" | "not_configured";
  featureEnabled: boolean;
};

function eventLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function AttorneyAccessPanel({
  caseId,
  cloudStorageEnabled,
}: {
  caseId: string;
  cloudStorageEnabled: boolean;
}) {
  const [state, setState] = useState<AttorneyAccessState | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [developmentUrl, setDevelopmentUrl] = useState("");

  const load = useCallback(async () => {
    if (!cloudStorageEnabled) return;
    try {
      const response = await fetch("/api/records/attorney/invitations", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => ({}))) as AttorneyAccessState & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load attorney access.");
      setState(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load attorney access.");
    }
  }, [cloudStorageEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const nextExpiry = state?.grants
      .filter((grant) => grant.active)
      .map((grant) => new Date(grant.expiresAt).getTime())
      .filter((value) => value > Date.now())
      .sort((left, right) => left - right)[0];
    if (!nextExpiry) return;
    const timer = window.setTimeout(() => void load(), Math.max(0, nextExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [load, state?.grants]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("attorneyEmail") || "");
    setBusy("create");
    setMessage("");
    setDevelopmentUrl("");
    try {
      const result = await attorneyMutation("/api/records/attorney/invitations", { email, caseId });
      setDevelopmentUrl(String(result.developmentInvitationUrl || ""));
      setMessage("Invitation created. The link expires in seven days; acceptance starts seven days of read-only access.");
      form.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    } finally {
      setBusy("");
    }
  }

  async function reinvite(invitation: Invitation) {
    setBusy(invitation.handle);
    setMessage("");
    setDevelopmentUrl("");
    try {
      const result = await attorneyMutation("/api/records/attorney/invitations", {
        email: invitation.email,
        caseId: invitation.caseId,
      });
      setDevelopmentUrl(String(result.developmentInvitationUrl || ""));
      setMessage("A new seven-day invitation was created. The prior access remains expired.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create a new invitation.");
    } finally {
      setBusy("");
    }
  }

  async function invitationAction(invitation: Invitation, action: "resend" | "revoke") {
    setBusy(invitation.handle);
    setMessage("");
    setDevelopmentUrl("");
    try {
      const result = await attorneyMutation("/api/records/attorney/invitations/action", {
        handle: invitation.handle,
        action,
      });
      setDevelopmentUrl(String(result.developmentInvitationUrl || ""));
      setMessage(action === "revoke" ? "Attorney access revoked immediately." : "A new invitation replaced the prior link.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update invitation.");
    } finally {
      setBusy("");
    }
  }

  if (!cloudStorageEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">Attorney access</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in to private cloud storage to invite an attorney to a read-only shared matter.
        </p>
      </section>
    );
  }

  const activeGrant = state?.grants.some((grant) => grant.active) || false;
  const pending = state?.invitations.find((invitation) => invitation.status === "pending");
  const newInvitationsEnabled = state?.featureEnabled === true;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="attorney-access-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="attorney-access-heading" className="font-semibold text-slate-950">Attorney read-only access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            One invited adult attorney account can view this case and download reports and evidence for seven days after accepting.
            This does not establish representation or attorney-client privilege.
          </p>
        </div>
        <Link href="/attorney" className="btn-secondary">Shared With Me</Link>
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        Revocation blocks future requests immediately, but My Custody Case cannot recall copies already downloaded.
        Access activity is logged without record contents. Case or account deletion invalidates access; retention language still requires qualified legal review.
      </div>

      {state?.delivery === "not_configured" ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Production invitation sending is disabled until custom SMTP is configured. This readiness blocker remains open.
        </p>
      ) : null}
      {!newInvitationsEnabled ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          New attorney invitations are not enabled for this deployment. Existing access can still be reviewed or revoked.
        </p>
      ) : null}

      <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Attorney email
          <input name="attorneyEmail" type="email" autoComplete="email" className="input" required maxLength={254} disabled={!newInvitationsEnabled || activeGrant || Boolean(pending)} />
        </label>
        <button type="submit" className="btn-primary self-end" disabled={!newInvitationsEnabled || busy === "create" || activeGrant || Boolean(pending)}>
          {busy === "create" ? "Creating…" : "Create invitation"}
        </button>
      </form>

      {developmentUrl ? (
        <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">Development/testing link only</p>
          <p className="mt-1 break-all text-xs text-teal-950">{developmentUrl}</p>
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => void navigator.clipboard.writeText(developmentUrl).then(() => setMessage("Development invitation link copied."))}
          >
            Copy testing link
          </button>
        </div>
      ) : null}

      {message ? <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700">{message}</p> : null}

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Invitations and grants</h3>
        {state?.invitations.length ? state.invitations.map((invitation) => (
          <div key={invitation.handle} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium text-slate-900">{invitation.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {eventLabel(invitation.status)} · created {new Date(invitation.createdAt).toLocaleString()}
                  {invitation.acceptedAt ? ` · granted ${new Date(invitation.acceptedAt).toLocaleString()}` : ""}
                  {invitation.accessExpiresAt ? ` · access ends ${new Date(invitation.accessExpiresAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(invitation.status === "pending" || invitation.status === "expired") ? (
                  <button type="button" className="btn-secondary" disabled={busy === invitation.handle} onClick={() => void invitationAction(invitation, "resend")}>Resend with new link</button>
                ) : null}
                {invitation.status === "accepted" && invitation.accessExpiresAt && !invitation.accessActive ? (
                  <button type="button" className="btn-secondary" disabled={busy === invitation.handle || !newInvitationsEnabled || Boolean(pending)} onClick={() => void reinvite(invitation)}>Invite again for 7 days</button>
                ) : null}
                {(invitation.status === "pending" || (invitation.status === "accepted" && invitation.accessActive)) ? (
                  <button type="button" className="btn-secondary text-red-700" disabled={busy === invitation.handle} onClick={() => void invitationAction(invitation, "revoke")}>Revoke access</button>
                ) : null}
              </div>
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">No attorney invitations yet.</p>}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900">Privacy-safe access history</h3>
        <ul className="mt-2 space-y-2 text-xs text-slate-600">
          {state?.events.length ? state.events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="rounded border border-slate-200 px-3 py-2">
              {eventLabel(event.type)} · {new Date(event.createdAt).toLocaleString()}
              {event.metadata.reportType ? ` · ${eventLabel(event.metadata.reportType)}` : ""}
            </li>
          )) : <li>No access activity recorded.</li>}
        </ul>
      </div>
    </section>
  );
}
