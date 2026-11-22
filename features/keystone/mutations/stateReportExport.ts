import type { Context } from ".keystone/types";
import { requireReadAuthority, stableHash } from "./workflow";
import { storeMidnight } from "./salesExport";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;
const MAX_ROWS = 5000;
const UNIT: Record<string, string> = { g: "Grams", gram: "Grams", grams: "Grams", each: "Each", ea: "Each", mg: "Milligrams", oz: "Ounces", ounce: "Ounces", ml: "Milliliters", lb: "Pounds" };
const CUSTOMER_TYPE: Record<string, string> = { adult_use: "Consumer", patient: "Patient", caregiver: "Caregiver" };
// Our movement types to the state system's adjustment reasons. States keep their own lists; staff check before upload.
const ADJUSTMENT_REASON: Record<string, string> = { count: "Scale Variance", adjustment: "Entry Error", waste: "Waste", destruction: "Waste" };
const ADJUSTMENT_TYPES = Object.keys(ADJUSTMENT_REASON);
const quantity = (micro: number) => String(Number((micro / 1_000_000).toFixed(4)));

/**
 * Sales receipts and package adjustments for a date range, laid out in the column order of the state
 * track-and-trace CSV import (Metrc), so a store with no live connection can upload them by hand.
 * Each download is written to the audit log so the page can show when the store last reported.
 */
export async function cannabisStateReportExport(_root: unknown, args: { kind: string; from: string; to: string }, context: Context) {
  const authority = await requireReadAuthority(context, "canViewReports").catch(() => requireReadAuthority(context, "canManageSales"));
  const kind = args.kind === "adjustments" ? "adjustments" : args.kind === "sales" ? "sales" : null;
  if (!kind) throw new Error("Choose sales or package adjustments");
  const from = String(args.from || ""); const to = String(args.to || "");
  if (!DAY.test(from) || !DAY.test(to)) throw new Error("Choose a start and end date");
  if (to < from) throw new Error("The end date is before the start date");
  const timezone = authority.actor.premises?.timezone || "UTC";
  const start = storeMidnight(from, timezone);
  const end = new Date(storeMidnight(to, timezone).getTime() + 86_400_000);
  if (end.getTime() - start.getTime() > (MAX_DAYS + 1) * 86_400_000) throw new Error(`Export up to ${MAX_DAYS} days at a time`);
  const sudo = context.sudo();
  const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
  const local = (iso: string, withTime: boolean) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}${withTime ? ` ${parts.hour}:${parts.minute}` : ""}`;
  };

  let rows: string[][];
  if (kind === "sales") {
    // Voided sales never happened for the state; refunds are reported separately in the state system.
    const lines = await sudo.query.SaleLine.findMany({
      where: { ...scope, sale: { finalizedAt: { gte: start, lt: end }, status: { notIn: ["reversal_pending", "reversed"] } } },
      orderBy: [{ createdAt: "asc" }], take: MAX_ROWS + 1,
      query: "packageUidSnapshot quantityMicrounits totalCents taxCents package { unitOfMeasure } sale { finalizedAt customerCapacitySnapshot }",
    });
    if (lines.length > MAX_ROWS) throw new Error("Too many sales for one file. Choose a shorter date range.");
    rows = lines.map(line => [local(line.sale!.finalizedAt as string, true), CUSTOMER_TYPE[String(line.sale?.customerCapacitySnapshot)] ?? "Consumer", "", "",
      String(line.packageUidSnapshot), quantity(Number(line.quantityMicrounits)), UNIT[String(line.package?.unitOfMeasure ?? "").toLowerCase()] ?? String(line.package?.unitOfMeasure ?? ""),
      ((Number(line.totalCents) - Number(line.taxCents)) / 100).toFixed(2)]);
  } else {
    const events = await sudo.query.InventoryEvent.findMany({
      where: { ...scope, eventType: { in: ADJUSTMENT_TYPES as any }, occurredAt: { gte: start, lt: end } },
      orderBy: [{ occurredAt: "asc" }], take: MAX_ROWS + 1,
      query: "eventType quantityDeltaMicrounits reasonCode occurredAt package { packageUid unitOfMeasure } actor { name staffCredential { credentialReference } }",
    });
    if (events.length > MAX_ROWS) throw new Error("Too many adjustments for one file. Choose a shorter date range.");
    rows = events.map(event => [String(event.package?.packageUid ?? ""), quantity(Number(event.quantityDeltaMicrounits)), UNIT[String(event.package?.unitOfMeasure ?? "").toLowerCase()] ?? String(event.package?.unitOfMeasure ?? ""),
      ADJUSTMENT_REASON[String(event.eventType)], `${String(event.reasonCode).replace(/_/g, " ")}${event.actor?.name ? ` (by ${event.actor.name})` : ""}`, local(event.occurredAt as string, false), String(event.actor?.staffCredential?.credentialReference ?? "")]);
  }
  const header = kind === "sales"
    ? ["Sales Date/Time", "Sales Customer Type", "Patient Number", "Caregiver Number", "Package Label", "Quantity", "Unit of Measure", "Total Amount"]
    : ["Package Label", "Quantity", "Unit of Measure", "Adjustment Reason", "Notes", "Adjustment Date", "Employee Identification Number"];
  const evidence = { kind, from, to, rows: rows.length };
  await sudo.query.AuditEvent.createOne({ data: { organization: { connect: { id: authority.organizationId } }, premises: { connect: { id: authority.premisesId } }, actor: { connect: { id: authority.actor.id } },
    action: `state_report.${kind}_exported`, resourceType: "StateReport", resourceId: `${kind}:${from}:${to}`, correlationId: `state-report:${kind}:${from}:${to}:${Date.now()}`, reasonCode: "manual_state_report",
    evidence, evidenceHash: stableHash(evidence), occurredAt: new Date() }, query: "id" });
  return { kind, from, to, timezone, header, rows };
}
