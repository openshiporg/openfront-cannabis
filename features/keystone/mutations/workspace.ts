import type { Context } from ".keystone/types";
import type { CannabisPermission } from "../access";
import { packageReadiness } from "../domain/packageReadiness";
import { isRuntimeCapabilityEnabled } from "../domain/runtimeCapabilities";
import { requireOperationalAuthority, requireReadAuthority, stableHash } from "./workflow";

export const WORKSPACE_PAGE_SIZE = 50;
const DAY_MS = 86_400_000;
const UNRESOLVED_INCIDENT = ["open", "contained", "investigating", "reported"];

// `read` sections show records for diagnosis and history while operating
// authority is lapsed; `operational` sections require current license/credential.
const sectionAuthority: Record<string, { permission: CannabisPermission; activity: string; mode: "read" | "operational" }> = {
  overview: { permission: "canAccessDashboard", activity: "authority", mode: "read" },
  authority: { permission: "canManageAuthority", activity: "authority", mode: "read" },
  compliance: { permission: "canManageCompliance", activity: "eligibility", mode: "operational" },
  inventory: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  receiving: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  menu: { permission: "canManageInventory", activity: "inventory", mode: "operational" },
  pos: { permission: "canManageSales", activity: "sale", mode: "operational" },
  cash: { permission: "canManageFinance", activity: "cash", mode: "operational" },
  reconciliation: { permission: "canViewReports", activity: "state_reporting", mode: "operational" },
  incidents: { permission: "canManageCompliance", activity: "incident", mode: "read" },
};

type Options = { cursor: string | null; search: string | null; filter: string | null; productSearch: string | null };

function readOptions(raw: unknown): Options {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const bounded = (entry: unknown, max: number) => typeof entry === "string" && entry.trim() && entry.trim().length <= max ? entry.trim() : null;
  return { cursor: bounded(value.cursor, 100), search: bounded(value.search, 100), filter: bounded(value.filter, 40), productSearch: bounded(value.productSearch, 100) };
}

/** One stable, id-tiebroken page plus the total for the same predicate. */
async function page(context: Context, list: keyof Context["query"] & string, args: { where: Record<string, unknown>; orderBy: Array<Record<string, "asc" | "desc">>; query: string; cursor?: string | null; take?: number }) {
  const take = args.take ?? WORKSPACE_PAGE_SIZE;
  const api = context.sudo().query[list] as any;
  const [rows, total] = await Promise.all([
    api.findMany({ where: args.where, orderBy: [...args.orderBy, { id: "asc" }], take: take + 1, ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}), query: args.query }),
    api.count({ where: args.where }),
  ]);
  return { items: rows.slice(0, take) as Array<Record<string, any>>, nextCursor: rows.length > take ? String(rows[take - 1].id) : null, total: Number(total) };
}

function intervalState(record: { status: string; effectiveAt: string; expiresAt: string }, now: number, activeStatus = "active") {
  if (record.status !== activeStatus) return "inactive";
  if (!(new Date(record.effectiveAt).getTime() <= now)) return "not_yet_effective";
  if (!(new Date(record.expiresAt).getTime() > now)) return "expired";
  if (new Date(record.expiresAt).getTime() < now + 30 * DAY_MS) return "expiring_soon";
  return "current";
}

function notificationState(incident: { status: string; notificationDueAt?: string | null }, now: number) {
  if (!UNRESOLVED_INCIDENT.includes(incident.status)) return "resolved";
  if (!incident.notificationDueAt) return "none";
  const due = new Date(incident.notificationDueAt).getTime();
  if (!Number.isFinite(due)) return "unknown";
  if (due <= now) return "overdue";
  if (due < now + DAY_MS) return "due_soon";
  return "upcoming";
}

const PACKAGE_SELECTION = "id packageUid sourcePackageUid productionBatchNumber lotNumber status testStatus quantityReceivedMicrounits quantityOnHandMicrounits reservedMicrounits unitOfMeasure expiresAt receivedAt manufacturedAt coaReference labName labResultReference labelVersion version product { id name sku } holds(where: { status: { equals: active } }, orderBy: [{ placedAt: desc }], take: 10) { id type reasonCode reason status placedAt } holdsCount(where: { status: { equals: active } }) events(orderBy: [{ occurredAt: desc }], take: 12) { id eventType quantityDeltaMicrounits beforeQuantityMicrounits afterQuantityMicrounits reasonCode occurredAt stateReportStatus manifest { manifestNumber status } actor { name } } eventsCount";

function projectPackage(pkg: Record<string, any>, now: Date) {
  const readiness = packageReadiness({ status: pkg.status, testStatus: pkg.testStatus, expiresAt: pkg.expiresAt, coaReference: pkg.coaReference, labelVersion: pkg.labelVersion, quantityOnHandMicrounits: pkg.quantityOnHandMicrounits, reservedMicrounits: pkg.reservedMicrounits, activeHoldCount: Number(pkg.holdsCount) || 0 }, now);
  return { ...pkg, readiness: { ready: readiness.ready, reasons: readiness.reasons }, balance: readiness.balance };
}

/** Packages that pass every sale predicate expressible in a query; balance is checked per row. */
function readyPackageWhere(now: Date) {
  return { status: { equals: "saleable" }, testStatus: { equals: "passed" }, expiresAt: { gt: now }, holds: { none: { status: { equals: "active" } } }, coaReference: { not: { equals: "" } }, labelVersion: { not: { equals: "" } } };
}

const PACKAGE_FILTERS: Record<string, (now: Date) => Record<string, unknown>> = {
  all: () => ({}),
  receiving: () => ({ status: { in: ["expected_inbound", "receiving_hold"] } }),
  held: () => ({ OR: [{ holds: { some: { status: { equals: "active" } } } }, { status: { in: ["quarantined", "recalled"] } }] }),
  ready: readyPackageWhere,
  closed: () => ({ status: { in: ["depleted", "destroyed"] } }),
};

export default async function cannabisOperationsWorkspace(_root: unknown, args: { section: string; options?: unknown }, context: Context) {
  const section = String(args.section || ""); const required = sectionAuthority[section];
  if (!required) throw new Error("Unsupported workspace section");
  const options = readOptions(args.options);
  let readAuthority: Awaited<ReturnType<typeof requireReadAuthority>>;
  try { readAuthority = await requireReadAuthority(context, required.permission); }
  catch { return { section, state: "forbidden" }; }
  let operatingClosedReason: string | null = null;
  try { await requireOperationalAuthority(context, required.permission, required.activity); }
  catch (error) { operatingClosedReason = error instanceof Error ? error.message : "Operating authority is not current"; }
  if (required.mode === "operational" && operatingClosedReason) return { section, state: "operating_closed", reason: operatingClosedReason };

  const authority = readAuthority; const sudo = context.sudo();
  const now = new Date(); const nowMs = now.getTime();
  const scope = { organization: { id: { equals: authority.organizationId } }, premises: { id: { equals: authority.premisesId } } };
  const base = {
    section, state: "ok", generatedAt: now.toISOString(),
    authorityFingerprint: stableHash([authority.actor.id, authority.organizationId, authority.premisesId]),
    jurisdictionCode: authority.actor.organization?.jurisdictionCode ?? null, premisesId: authority.premisesId,
    timezone: authority.actor.premises?.timezone ?? null, currencyCode: authority.actor.premises?.currencyCode ?? null,
    operating: { open: !operatingClosedReason, reason: operatingClosedReason },
  };

  if (section === "overview") {
    const role = (await sudo.query.User.findOne({ where: { id: authority.actor.id }, query: "role { canManageInventory canManageCompliance canManageAuthority }" }))?.role;
    const result: Record<string, unknown> = { ...base };
    if (role?.canManageInventory === true && !operatingClosedReason) {
      const ready = await page(context, "InventoryPackage", { where: { ...scope, ...readyPackageWhere(now) }, orderBy: [{ expiresAt: "asc" }], take: 10, query: "id packageUid expiresAt quantityOnHandMicrounits reservedMicrounits unitOfMeasure product { name }" });
      const [held, receiving] = await Promise.all([
        sudo.query.InventoryPackage.count({ where: { ...scope, ...PACKAGE_FILTERS.held(now) } as any }),
        sudo.query.InventoryPackage.count({ where: { ...scope, ...PACKAGE_FILTERS.receiving(now) } as any }),
      ]);
      result.inventory = { ready: ready.items, readyTotal: ready.total, heldTotal: held, receivingTotal: receiving };
    }
    if (role?.canManageCompliance === true) {
      const open = await page(context, "ComplianceIncident", { where: { ...scope, status: { in: UNRESOLVED_INCIDENT } }, orderBy: [{ detectedAt: "desc" }], take: 10, query: "id reference type severity status detectedAt notificationDueAt" });
      const overdue = await sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT as any }, notificationDueAt: { lte: now } } });
      result.incidents = { open: open.items.map(incident => ({ ...incident, notificationState: notificationState(incident as any, nowMs) })), openTotal: open.total, overdueTotal: overdue };
    }
    if (role?.canManageAuthority === true) result.authorityAccess = true;
    return result;
  }

  if (section === "authority") {
    const licenses = await page(context, "CannabisLicense", { where: scope, orderBy: [{ expiresAt: "asc" }], query: "id licenseNumber licenseType status effectiveAt expiresAt regulatorName" });
    const credentials = await page(context, "StaffCredential", { where: scope, orderBy: [{ expiresAt: "asc" }], cursor: options.cursor, query: "id credentialType status effectiveAt expiresAt approvalLimitCents user { id name }" });
    const states = credentials.items.map(credential => intervalState(credential as any, nowMs));
    return {
      ...base,
      licenses: { ...licenses, items: licenses.items.map(license => ({ ...license, intervalState: intervalState(license as any, nowMs) })) },
      credentials: { ...credentials, items: credentials.items.map((credential, index) => ({ ...credential, intervalState: states[index] })) },
    };
  }

  if (section === "compliance") {
    const pendingCustomers = await page(context, "Customer", { where: { ...scope, status: { equals: "pending_verification" } }, orderBy: [{ createdAt: "asc" }], cursor: options.cursor, query: "id reference capacity status createdAt" });
    const holds = await page(context, "PackageHold", { where: { ...scope, status: { equals: "active" } }, orderBy: [{ placedAt: "asc" }], query: "id type reasonCode placedAt package { id packageUid }" });
    const recalls = await page(context, "RecallCase", { where: scope, orderBy: [{ openedAt: "desc" }], query: "id reference status reason openedAt" });
    return {
      ...base,
      pendingCustomers: { ...pendingCustomers, items: pendingCustomers.items.map(customer => ({ ...customer, kind: "customer_eligibility" })) },
      holds,
      recalls: { ...recalls, items: recalls.items.map(recall => ({ ...recall, kind: "recall_case" })) },
    };
  }

  if (section === "inventory") {
    const filter = options.filter && PACKAGE_FILTERS[options.filter] ? options.filter : "all";
    const search = options.search ? { OR: [{ packageUid: { contains: options.search, mode: "insensitive" } }, { lotNumber: { contains: options.search, mode: "insensitive" } }, { product: { name: { contains: options.search, mode: "insensitive" } } }] } : {};
    const packages = await page(context, "InventoryPackage", { where: { AND: [scope, PACKAGE_FILTERS[filter](now), search] }, orderBy: [{ expiresAt: "asc" }], cursor: options.cursor, query: PACKAGE_SELECTION });
    const counts = Object.fromEntries(await Promise.all(Object.entries(PACKAGE_FILTERS).map(async ([key, where]) => [key, await sudo.query.InventoryPackage.count({ where: { AND: [scope, where(now)] } as any })])));
    const releaseAvailable = isRuntimeCapabilityEnabled("inventory.event-specific-custody");
    return {
      ...base, filter, search: options.search, counts,
      packages: { ...packages, items: packages.items.map(pkg => projectPackage(pkg, now)) },
      actions: { release: releaseAvailable ? { available: true } : { available: false, reason: "Releasing packages to saleable is not available yet. It needs verified lab evidence and an independent approval workflow." } },
    };
  }

  if (section === "receiving") {
    const inbound = { type: { in: ["receiving", "transfer_in"] } };
    const search = options.search ? { manifestNumber: { contains: options.search, mode: "insensitive" } } : {};
    const manifests = await page(context, "RegulatedManifest", { where: { AND: [scope, inbound, search] }, orderBy: [{ occurredAt: "desc" }], cursor: options.cursor, query: "id manifestNumber type status sourceLicenseNumber destinationLicenseNumber transporterReference regulatorManifestId occurredAt reasonCode packageEvents(orderBy: [{ occurredAt: asc }], take: 20) { id eventType quantityDeltaMicrounits package { packageUid unitOfMeasure } } packageEventsCount" });
    const productSearch = options.productSearch ? { OR: [{ name: { contains: options.productSearch, mode: "insensitive" } }, { sku: { contains: options.productSearch, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, productSearch] }, orderBy: [{ name: "asc" }], take: 100, query: "id name sku form unitOfMeasure unitQuantityMicrounits" });
    const [receivingHoldTotal, discrepancyTotal] = await Promise.all([
      sudo.query.InventoryPackage.count({ where: { ...scope, status: { equals: "receiving_hold" } } }),
      sudo.query.RegulatedManifest.count({ where: { AND: [scope, inbound, { status: { in: ["partially_accepted", "rejected"] } }] } as any }),
    ]);
    return { ...base, search: options.search, productSearch: options.productSearch, manifests, products, receivingHoldTotal, discrepancyTotal };
  }

  if (section === "menu") {
    const search = options.search ? { OR: [{ name: { contains: options.search, mode: "insensitive" } }, { sku: { contains: options.search, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, search] }, orderBy: [{ name: "asc" }], cursor: options.cursor, query: `id name sku form categoryCode priceCents status unitOfMeasure adultUseEligible medicalEligible updatedAt publicDescription packages(where: { status: { equals: saleable }, testStatus: { equals: passed }, expiresAt: { gt: "${now.toISOString()}" } }, orderBy: [{ expiresAt: asc }], take: 20) { id quantityOnHandMicrounits reservedMicrounits status testStatus expiresAt coaReference labelVersion holdsCount(where: { status: { equals: active } }) }` });
    const items = products.items.map(product => {
      const candidates = Array.isArray(product.packages) ? product.packages : [];
      const ready = candidates.filter((pkg: any) => packageReadiness({ ...pkg, activeHoldCount: Number(pkg.holdsCount) || 0 }, now).ready);
      const availableMicrounits = ready.reduce((sum: number, pkg: any) => sum + (pkg.quantityOnHandMicrounits - pkg.reservedMicrounits), 0);
      const { packages: _packages, ...rest } = product;
      return { ...rest, readyPackageCount: ready.length, readyCountComplete: candidates.length < 20, availableMicrounits };
    });
    const inactiveTotal = await sudo.query.Product.count({ where: { ...scope, status: { in: ["draft", "inactive"] } } });
    return { ...base, search: options.search, products: { ...products, items }, inactiveTotal };
  }

  if (section === "pos") {
    const carts = await page(context, "Cart", { where: { ...scope, status: { in: ["preliminarily_eligible", "reserved", "picking", "staged", "final_verification"] } }, orderBy: [{ createdAt: "asc" }], cursor: options.cursor, query: "id reference source status expiresAt totalCents customer { id reference capacity }" });
    const productSearch = options.productSearch ? { OR: [{ name: { contains: options.productSearch, mode: "insensitive" } }, { sku: { contains: options.productSearch, mode: "insensitive" } }] } : {};
    const products = await page(context, "Product", { where: { AND: [scope, { status: { equals: "active" } }, productSearch] }, orderBy: [{ name: "asc" }], take: 100, query: "id name sku form unitQuantityMicrounits unitOfMeasure" });
    const sales = await page(context, "Sale", { where: scope, orderBy: [{ finalizedAt: "desc" }], take: 25, query: "id receiptNumber status totalCents finalizedAt" });
    return { ...base, carts, products, sales, productSearch: options.productSearch };
  }

  if (section === "cash") {
    const shifts = await page(context, "RegisterShift", { where: scope, orderBy: [{ createdAt: "desc" }], cursor: options.cursor, query: "id status openingFloatCents expectedCashCents actualCashCents varianceCents openedAt closedAt register { id name code } operator { id name }" });
    const registers = await page(context, "Register", { where: scope, orderBy: [{ code: "asc" }], take: 100, query: "id code name status" });
    return { ...base, shifts, registers };
  }

  if (section === "reconciliation") {
    const runs = await page(context, "ReconciliationRun", { where: scope, orderBy: [{ startedAt: "desc" }], cursor: options.cursor, query: "id type status discrepancyCount startedAt completedAt" });
    const pending = await page(context, "OutboxEvent", { where: { ...scope, status: { in: ["queued", "sending"] } }, orderBy: [{ availableAt: "asc" }], take: 25, query: "id topic status attempts availableAt" });
    const exceptions = await page(context, "OutboxEvent", { where: { ...scope, status: { in: ["rejected", "retryable", "dead_letter"] } }, orderBy: [{ availableAt: "asc" }], query: "id topic status attempts availableAt lastAttemptAt lastErrorCode" });
    // No delivery worker or provider adapter exists in this repository, so queued events are not sent.
    const installations = await sudo.query.IntegrationInstallation.count({ where: { ...scope, status: { equals: "active" } } });
    return { ...base, runs, pending, exceptions, delivery: { workerAvailable: false, activeInstallations: installations } };
  }

  // incidents
  const filter = options.filter === "all" ? "all" : "open";
  const incidents = await page(context, "ComplianceIncident", { where: { ...scope, ...(filter === "open" ? { status: { in: UNRESOLVED_INCIDENT } } : {}) }, orderBy: [{ detectedAt: "desc" }], cursor: options.cursor, query: "id reference type severity status occurredAt detectedAt notificationDueAt reportedAt description" });
  const [openTotal, overdueTotal, highTotal] = await Promise.all([
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT as any } } }),
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT as any }, notificationDueAt: { lte: now } } }),
    sudo.query.ComplianceIncident.count({ where: { ...scope, status: { in: UNRESOLVED_INCIDENT as any }, severity: { in: ["high", "critical"] } } }),
  ]);
  return { ...base, filter, incidents: { ...incidents, items: incidents.items.map(incident => ({ ...incident, notificationState: notificationState(incident as any, nowMs) })) }, openTotal, overdueTotal, highTotal };
}
