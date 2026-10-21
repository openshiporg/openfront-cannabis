export type ReconciliationJsonValue = string | number | boolean | null | ReconciliationJsonValue[] | { [key: string]: ReconciliationJsonValue };
type ReconciliationClaim = { [key: string]: ReconciliationJsonValue };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): value is ReconciliationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every(child => isJsonValue(child, ancestors))
    : Object.values(value).every(child => isJsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}

/**
 * Validate only the transport shape of operator-submitted discrepancy claims.
 * Their presence is not a source comparison, so no submission can claim a
 * completed or balanced reconciliation in the absence of trusted computation.
 */
export function validateReconciliationSubmission(discrepancies: unknown) {
  if (!Array.isArray(discrepancies)) throw new Error("Discrepancies must be supplied as an array");

  for (const [index, discrepancy] of discrepancies.entries()) {
    if (!isPlainRecord(discrepancy) || Object.keys(discrepancy).length === 0 || !isJsonValue(discrepancy)) {
      throw new Error(`Discrepancy claim ${index + 1} must be a non-empty JSON object`);
    }
  }

  return {
    discrepancies: discrepancies as ReconciliationClaim[],
    discrepancyCount: discrepancies.length,
    status: "pending" as const,
  };
}
