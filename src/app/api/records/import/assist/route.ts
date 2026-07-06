import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AiImportKind = "message_archive" | "pasted_notes" | "custody_calendar";
type AiImportDraftKind = "note" | "exchange" | "custody_day";
type AiImportConfidence = "high" | "medium" | "low";

interface AiImportDraft {
  kind: AiImportDraftKind;
  date: string;
  time: string | null;
  title: string;
  body: string;
  category:
    | "exchange"
    | "communication"
    | "school"
    | "medical"
    | "expense"
    | "child_support"
    | "safety"
    | "schedule_change"
    | "child_item"
    | "attorney"
    | "court"
    | "other";
  tags: string[];
  includeInReports: boolean;
  confidence: AiImportConfidence;
  orderedTime: string | null;
  actualTime: string | null;
  direction: "other_parent_to_me" | "me_to_other_parent" | null;
  status:
    | "completed_on_time"
    | "completed_late"
    | "completed_early"
    | "missed"
    | "refused"
    | "modified_by_agreement"
    | "canceled"
    | "other"
    | null;
  caregiverLabel: string | null;
  color: string | null;
  sourceQuote: string;
  reviewReason: string;
}

interface AiImportResponse {
  drafts: AiImportDraft[];
}

const maxImportChars = Number(process.env.RECORDS_AI_IMPORT_MAX_CHARS || 12_000);
const maxRequestBytes = Math.max(16_000, maxImportChars * 4);

const noteCategories = new Set<AiImportDraft["category"]>([
  "exchange",
  "communication",
  "school",
  "medical",
  "expense",
  "child_support",
  "safety",
  "schedule_change",
  "child_item",
  "attorney",
  "court",
  "other",
]);

const exchangeStatuses = new Set<NonNullable<AiImportDraft["status"]>>([
  "completed_on_time",
  "completed_late",
  "completed_early",
  "missed",
  "refused",
  "modified_by_agreement",
  "canceled",
  "other",
]);

function disabledResponse() {
  return NextResponse.json(
    {
      error: "AI import assistance is not enabled.",
      detail: "Set RECORDS_AI_IMPORT_ENABLED=true and configure OPENAI_API_KEY on the server.",
    },
    { status: 501 }
  );
}

function productionReviewRequiredResponse() {
  return NextResponse.json(
    {
      error: "AI import assistance is not available yet.",
      detail: "Complete vendor/security review before enabling AI import in production.",
    },
    { status: 503 }
  );
}

function requireSupabaseResponse() {
  return NextResponse.json(
    {
      error: "AI import assistance requires authenticated records storage.",
      detail: "Set RECORDS_STORAGE_MODE=supabase before enabling AI import.",
    },
    { status: 501 }
  );
}

function openAiUnavailableResponse() {
  return NextResponse.json(
    {
      error: "AI import assistance is not configured.",
      detail: "Set OPENAI_API_KEY on the server.",
    },
    { status: 503 }
  );
}

function parseRequestBody(rawBody: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return { error: "Invalid JSON body." };
  }

  const body = parsed as {
    content?: unknown;
    sourceLabel?: unknown;
    defaultYear?: unknown;
    defaultOrderedTime?: unknown;
    importKind?: unknown;
  };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sourceLabel =
    typeof body.sourceLabel === "string" && body.sourceLabel.trim()
      ? body.sourceLabel.trim().slice(0, 140)
      : "Imported text";
  const defaultYear =
    typeof body.defaultYear === "number" && Number.isFinite(body.defaultYear)
      ? Math.max(1900, Math.min(2100, Math.trunc(body.defaultYear)))
      : new Date().getUTCFullYear();
  const defaultOrderedTime =
    typeof body.defaultOrderedTime === "string" && /^\d{2}:\d{2}$/.test(body.defaultOrderedTime)
      ? body.defaultOrderedTime
      : "17:00";
  const importKind: AiImportKind =
    body.importKind === "message_archive" ||
    body.importKind === "pasted_notes" ||
    body.importKind === "custody_calendar"
      ? body.importKind
      : "pasted_notes";

  if (!content) return { error: "Import content is required." };
  if (content.length > maxImportChars) {
    return { error: `Import content is too long. Limit it to ${maxImportChars.toLocaleString()} characters.` };
  }

  return {
    input: {
      content,
      sourceLabel,
      defaultYear,
      defaultOrderedTime,
      importKind,
    },
  };
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind",
            "date",
            "time",
            "title",
            "body",
            "category",
            "tags",
            "includeInReports",
            "confidence",
            "orderedTime",
            "actualTime",
            "direction",
            "status",
            "caregiverLabel",
            "color",
            "sourceQuote",
            "reviewReason",
          ],
          properties: {
            kind: { type: "string", enum: ["note", "exchange", "custody_day"] },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
            title: { type: "string", minLength: 2, maxLength: 120 },
            body: { type: "string", minLength: 1, maxLength: 2500 },
            category: {
              type: "string",
              enum: [
                "exchange",
                "communication",
                "school",
                "medical",
                "expense",
                "child_support",
                "safety",
                "schedule_change",
                "child_item",
                "attorney",
                "court",
                "other",
              ],
            },
            tags: {
              type: "array",
              maxItems: 8,
              items: { type: "string", minLength: 1, maxLength: 40 },
            },
            includeInReports: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            orderedTime: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
            actualTime: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
            direction: {
              type: ["string", "null"],
              enum: ["other_parent_to_me", "me_to_other_parent", null],
            },
            status: {
              type: ["string", "null"],
              enum: [
                "completed_on_time",
                "completed_late",
                "completed_early",
                "missed",
                "refused",
                "modified_by_agreement",
                "canceled",
                "other",
                null,
              ],
            },
            caregiverLabel: { type: ["string", "null"], maxLength: 60 },
            color: { type: ["string", "null"], pattern: "^#[0-9a-fA-F]{6}$" },
            sourceQuote: { type: "string", minLength: 1, maxLength: 500 },
            reviewReason: { type: "string", minLength: 1, maxLength: 500 },
          },
        },
      },
    },
  };
}

function extractionPrompt(input: {
  content: string;
  sourceLabel: string;
  defaultYear: number;
  defaultOrderedTime: string;
  importKind: AiImportKind;
}) {
  const dateAndTimeInstructions =
    input.importKind === "message_archive" || input.importKind === "pasted_notes"
      ? [
          "For message archives and pasted notes, use dates and times stated in the source text.",
          "If a source date lacks a year, use the current year only as a normalization fallback and mark that uncertainty in reviewReason.",
          "Do not assume a default ordered exchange time for message archives or pasted notes. Create exchange drafts only when the source supports both the expected/agreed time and actual time.",
        ]
      : [
          "If a date lacks a year, use the provided default year.",
          "For exchange lateness, compare actual exchange time to the ordered/default exchange time when both are available.",
        ];
  return [
    "Extract draft custody-record entries from the user's import text.",
    "Return only facts supported by the source text. Do not create legal conclusions, accusations, or advice.",
    "Use neutral wording suitable for a review queue.",
    ...dateAndTimeInstructions,
    "FaceTime cancellations should usually be note drafts titled 'No FaceTime conducted'.",
    "If the source indicates the other parent only gave notice after a call was not answered, include tag 'post_call_notice'.",
    "Use exchange drafts only for actual exchange outcomes, not scheduled custody days.",
    "Use custody_day drafts only for calendar/day assignment rows.",
    "Mark uncertain extraction as low confidence and explain why in reviewReason.",
    "",
    `Source label: ${input.sourceLabel}`,
    `Import kind: ${input.importKind}`,
    ...(input.importKind === "message_archive" || input.importKind === "pasted_notes"
      ? []
      : [
          `Default year: ${input.defaultYear}`,
          `Default ordered exchange time: ${input.defaultOrderedTime}`,
        ]),
    "",
    input.content,
  ].join("\n");
}

function extractOutputText(response: unknown) {
  const candidate = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }>;
  };

  if (typeof candidate.output_text === "string") return candidate.output_text;

  for (const item of candidate.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
      if (typeof content.text === "string") return content.text;
    }
  }

  return "";
}

function normalizeDraft(draft: AiImportDraft) {
  const kind: AiImportDraftKind =
    draft.kind === "exchange" || draft.kind === "custody_day" ? draft.kind : "note";
  const category = noteCategories.has(draft.category) ? draft.category : "other";
  const status =
    draft.status && exchangeStatuses.has(draft.status) ? draft.status : kind === "exchange" ? "other" : null;
  const direction =
    draft.direction === "me_to_other_parent" || draft.direction === "other_parent_to_me"
      ? draft.direction
      : kind === "exchange"
        ? "other_parent_to_me"
        : null;

  return {
    kind,
    date: /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : "",
    time: draft.time && /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : null,
    title: String(draft.title || "Imported draft").slice(0, 120),
    body: String(draft.body || draft.sourceQuote || "Imported draft needs review.").slice(0, 2500),
    category,
    tags: Array.isArray(draft.tags)
      ? draft.tags
          .map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    includeInReports: Boolean(draft.includeInReports),
    confidence:
      draft.confidence === "high" || draft.confidence === "medium" || draft.confidence === "low"
        ? draft.confidence
        : "low",
    orderedTime:
      draft.orderedTime && /^\d{2}:\d{2}$/.test(draft.orderedTime) ? draft.orderedTime : null,
    actualTime: draft.actualTime && /^\d{2}:\d{2}$/.test(draft.actualTime) ? draft.actualTime : null,
    direction,
    status,
    caregiverLabel:
      typeof draft.caregiverLabel === "string" && draft.caregiverLabel.trim()
        ? draft.caregiverLabel.trim().slice(0, 60)
        : null,
    color:
      typeof draft.color === "string" && /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : null,
    sourceQuote: String(draft.sourceQuote || "").slice(0, 500),
    reviewReason: String(draft.reviewReason || "Review extracted draft before saving.").slice(0, 500),
  };
}

function validateAiResponse(value: unknown): AiImportResponse {
  const body = value as Partial<AiImportResponse>;
  const drafts = Array.isArray(body.drafts) ? body.drafts : [];
  return {
    drafts: drafts
      .map((draft) => normalizeDraft(draft as AiImportDraft))
      .filter((draft) => draft.date && draft.title && draft.body)
      .slice(0, 40),
  };
}

async function callOpenAiImport(input: {
  content: string;
  sourceLabel: string;
  defaultYear: number;
  defaultOrderedTime: string;
  importKind: AiImportKind;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("missing_openai_api_key");

  const model = process.env.OPENAI_IMPORT_MODEL || "gpt-5.5";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a careful records import assistant for a custody documentation app. Extract draft records only. You do not provide legal advice.",
        },
        {
          role: "user",
          content: extractionPrompt(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "records_import_drafts",
          strict: true,
          schema: responseSchema(),
        },
      },
    }),
  });

  const parsed = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(parsed.error?.message || `OpenAI import request failed with ${response.status}.`);
  }

  const outputText = extractOutputText(parsed);
  if (!outputText) throw new Error("OpenAI import response did not include structured text.");

  return validateAiResponse(JSON.parse(outputText) as unknown);
}

export async function POST(request: NextRequest) {
  if (process.env.RECORDS_AI_IMPORT_ENABLED !== "true") return disabledResponse();
  if (!isSupabaseRecordsMode()) return requireSupabaseResponse();
  if (process.env.NODE_ENV === "production" && process.env.VENDOR_SECURITY_REVIEW_APPROVED !== "true") {
    return productionReviewRequiredResponse();
  }
  if (!process.env.OPENAI_API_KEY) return openAiUnavailableResponse();

  const ipRateLimit = checkRateLimit(request, {
    id: "records-ai-import-ip",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (ipRateLimit.limited) return rateLimitExceededResponse(ipRateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const userRateLimit = checkRateLimit(request, {
    id: "records-ai-import-user",
    key: context.userId,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (userRateLimit.limited) return rateLimitExceededResponse(userRateLimit);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > maxRequestBytes) {
    return NextResponse.json({ error: "AI import request is too large." }, { status: 413 });
  }

  const parsed = parseRequestBody(rawBody);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await callOpenAiImport(parsed.input);
    const response = NextResponse.json(
      {
        drafts: result.drafts,
        sourceLabel: parsed.input.sourceLabel,
        reviewedBy: "openai",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
    return attachRefreshedRecordsSession(request, response, context);
  } catch (error) {
    if (error instanceof Error && error.message === "missing_openai_api_key") {
      return openAiUnavailableResponse();
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI import assistance failed.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
