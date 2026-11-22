import type { Context } from ".keystone/types";
import { requireReadAuthority } from "./workflow";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;
const MAX_LINES = 5000;

/** The UTC instant of local midnight for a store date, found by correcting a UTC guess with the zone's offset. */
function storeMidnight(day: string, timeZone: string) {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(guess).map(part => [part.type, part.value]));
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/**
 * Every sold package line between two store dates (inclusive), for the store's own records and for
 * entering sales in the state track-and-trace system by hand. One row per package sold.
 */
export async function cannabisSalesExport(_root: unknown, args: { from: string; to: string }, context: Context) {
  // Whoever can open Sales or the reports pages can take the file.
  const authority = await requireReadAuthority(context, "canManageSales").catch(() => requireReadAuthority(context, "canViewReports"));
  const from = String(args.from || ""); const to = String(args.to || "");
  if (!DAY.test(from) || !DAY.test(to)) throw new Error("Choose a start and end date");
  if (to < from) throw new Error("The end date is before the start date");
  const timezone = authority.actor.premises?.timezone || "UTC";
  const start = storeMidnight(from, timezone);
  const end = new Date(storeMidnight(to, timezone).getTime() + 86_400_000);
  if (end.getTime() - start.getTime() > (MAX_DAYS + 1) * 86_400_000) throw new Error(`Export up to ${MAX_DAYS} days at a time`);
  const sudo = context.sudo();
  const lines = await sudo.query.SaleLine.findMany({
    where: { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } }, sale: { finalizedAt: { gte: start, lt: end } } },
    orderBy: [{ createdAt: "asc" }], take: MAX_LINES + 1,
    query: "id titleSnapshot skuSnapshot categoryCodeSnapshot packageUidSnapshot batchSnapshot quantityMicrounits unitPriceCents discountCents taxCents totalCents package { unitOfMeasure } sale { receiptNumber status finalizedAt customerCapacitySnapshot refundedCents }",
  });
  if (lines.length > MAX_LINES) throw new Error("Too many sales for one file. Choose a shorter date range.");
  return {
    from, to, timezone, currencyCode: authority.actor.premises?.currencyCode ?? "USD",
    rows: lines.map(line => ({
      finalizedAt: line.sale?.finalizedAt ?? null, receiptNumber: line.sale?.receiptNumber ?? "", status: line.sale?.status ?? "", customerType: line.sale?.customerCapacitySnapshot ?? "",
      packageUid: line.packageUidSnapshot, batch: line.batchSnapshot, product: line.titleSnapshot, sku: line.skuSnapshot, category: line.categoryCodeSnapshot,
      quantityMicrounits: line.quantityMicrounits, unit: line.package?.unitOfMeasure ?? "", unitPriceCents: line.unitPriceCents, discountCents: line.discountCents, taxCents: line.taxCents, totalCents: line.totalCents,
      saleRefundedCents: line.sale?.refundedCents ?? 0,
    })),
  };
}
