// src/components/FinderContactForm.tsx
"use client";

import { useState, FormEvent } from "react";

interface FinderContactFormProps {
  petId: string;
  petName?: string; // optional name for nicer copy
}

type ReportType = "have" | "saw";

export default function FinderContactForm({
  petId,
  petName,
}: FinderContactFormProps) {
  const [reportType, setReportType] = useState<ReportType>("have");
  const [message, setMessage] = useState("");
  const [generalLocation, setGeneralLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeholderName = petName || "your pet";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!message.trim()) {
      setError("Please add a short message.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finder-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          petId,
          type: reportType, // 'have' | 'saw' – backend will map this to DB column
          message,
          generalLocation,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        throw new Error(
          (body as any).error || "Something went wrong. Please try again."
        );
      }

      setSuccess("Your message has been sent to the owner.");
      setMessage("");
      setGeneralLocation("");
      setReportType("have"); // reset toggle after a successful submit
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type selector */}
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-neutral-200">
          How are you helping?
        </p>
        <div className="inline-flex rounded-full bg-neutral-900 p-1 border border-neutral-700 text-[11px]">
          <button
            type="button"
            onClick={() => setReportType("have")}
            className={`px-3 py-1 rounded-full transition-colors ${
              reportType === "have"
                ? "bg-emerald-500 text-black"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            I HAVE this pet
          </button>
          <button
            type="button"
            onClick={() => setReportType("saw")}
            className={`px-3 py-1 rounded-full transition-colors ${
              reportType === "saw"
                ? "bg-emerald-500 text-black"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            I JUST SAW this pet
          </button>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-200">
          Let the owner know what&apos;s going on
        </label>
        <textarea
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          rows={3}
          placeholder={
            reportType === "have"
              ? `Example: I have ${placeholderName} safe at my house, please text me.`
              : `Example: I just saw ${placeholderName} near the park heading east.`
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* General area */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-200">
          General area (optional)
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          placeholder="Example: Near 5th & Main, by the park"
          value={generalLocation}
          onChange={(e) => setGeneralLocation(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
          {error}
        </p>
      )}
      {success && (
        <p className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-1">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending..." : "Send message to owner"}
      </button>
    </form>
  );
}