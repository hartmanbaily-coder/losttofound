import type { RecordsDataset } from "./types";

const datasetKeys = [
  "users",
  "matters",
  "exchangeRules",
  "scheduleExceptions",
  "custodyDayAssignments",
  "exchangeLogs",
  "dateNotes",
  "evidenceItems",
  "childSupportOrders",
  "childSupportPayments",
  "expenseItems",
  "auditLogs",
] as const satisfies ReadonlyArray<keyof RecordsDataset>;

const caseRecordKeys = [
  "exchangeRules",
  "scheduleExceptions",
  "custodyDayAssignments",
  "exchangeLogs",
  "dateNotes",
  "evidenceItems",
  "childSupportOrders",
  "childSupportPayments",
  "expenseItems",
] as const satisfies ReadonlyArray<keyof RecordsDataset>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isRecordsDataset(input: unknown): input is RecordsDataset {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<Record<keyof RecordsDataset, unknown>>;
  if (!datasetKeys.every((key) => Array.isArray(candidate[key]))) return false;
  if (
    !(candidate.users as unknown[]).every(
      (item) => isObject(item) && typeof item.userId === "string"
    ) ||
    !(candidate.matters as unknown[]).every(
      (item) =>
        isObject(item) &&
        typeof item.id === "string" &&
        typeof item.userId === "string"
    )
  ) {
    return false;
  }

  for (const key of caseRecordKeys) {
    if (
      !(candidate[key] as unknown[]).every(
        (item) =>
          isObject(item) &&
          typeof item.userId === "string" &&
          typeof item.caseId === "string"
      )
    ) {
      return false;
    }
  }

  return (candidate.auditLogs as unknown[]).every(
    (item) =>
      isObject(item) &&
      typeof item.userId === "string" &&
      (item.caseId === undefined || typeof item.caseId === "string")
  );
}

export function sanitizeRecordsDatasetForUser(
  dataset: RecordsDataset,
  userId: string
): RecordsDataset {
  const users = dataset.users.filter((item) => item.userId === userId);
  const matters = dataset.matters.filter((item) => item.userId === userId);
  const caseIds = new Set(matters.map((item) => item.id));
  const ownsCaseRecord = (item: { userId: string; caseId: string }) =>
    item.userId === userId && caseIds.has(item.caseId);

  return {
    users,
    matters,
    exchangeRules: dataset.exchangeRules.filter(ownsCaseRecord),
    scheduleExceptions: dataset.scheduleExceptions.filter(ownsCaseRecord),
    custodyDayAssignments: dataset.custodyDayAssignments.filter(ownsCaseRecord),
    exchangeLogs: dataset.exchangeLogs.filter(ownsCaseRecord),
    dateNotes: dataset.dateNotes.filter(ownsCaseRecord),
    evidenceItems: dataset.evidenceItems.filter(ownsCaseRecord),
    childSupportOrders: dataset.childSupportOrders.filter(ownsCaseRecord),
    childSupportPayments: dataset.childSupportPayments.filter(ownsCaseRecord),
    expenseItems: dataset.expenseItems.filter(ownsCaseRecord),
    auditLogs: dataset.auditLogs.filter(
      (item) => item.userId === userId && (!item.caseId || caseIds.has(item.caseId))
    ),
  };
}

export function datasetContainsForeignRecords(dataset: RecordsDataset, userId: string) {
  const isolated = sanitizeRecordsDatasetForUser(dataset, userId);
  return datasetKeys.some((key) => isolated[key].length !== dataset[key].length);
}
