/**
 * Runtime contract for cannabisOperationsWorkspace. The resolver returns JSON,
 * so every section is validated here; a malformed payload is "unavailable",
 * never an empty queue or a zero total.
 */
type Check<T> = (value: unknown, path: string) => T;

class ContractError extends Error {}
const fail = (path: string): never => { throw new ContractError(path); };

const str: Check<string> = (v, p) => typeof v === 'string' ? v : fail(p);
const optStr: Check<string | null> = (v, p) => v == null ? null : str(v, p);
const int: Check<number> = (v, p) => typeof v === 'number' && Number.isSafeInteger(v) ? v : fail(p);
const optInt: Check<number | null> = (v, p) => v == null ? null : int(v, p);
const count: Check<number> = (v, p) => int(v, p) >= 0 ? v as number : fail(p);
const bool: Check<boolean> = (v, p) => typeof v === 'boolean' ? v : fail(p);
const date: Check<string> = (v, p) => typeof v === 'string' && Number.isFinite(new Date(v).getTime()) ? v : fail(p);
const optDate: Check<string | null> = (v, p) => v == null ? null : date(v, p);
const record = (v: unknown, p: string) => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail(p);
function arr<T>(item: Check<T>, max = 200): Check<T[]> {
  return (v, p) => Array.isArray(v) && v.length <= max ? v.map((entry, index) => item(entry, `${p}[${index}]`)) : fail(p);
}
function obj<T extends Record<string, Check<unknown>>>(shape: T): Check<{ [K in keyof T]: ReturnType<T[K]> }> {
  return (v, p) => {
    const value = record(v, p);
    return Object.fromEntries(Object.entries(shape).map(([key, check]) => [key, check(value[key], `${p}.${key}`)])) as { [K in keyof T]: ReturnType<T[K]> };
  };
}
/** Rule rows are shown as data, never trusted further: kept as plain records. */
const json: Check<Record<string, unknown>> = (v, p) => record(v, p);
function nullable<T>(check: Check<T>): Check<T | null> { return (v, p) => v == null ? null : check(v, p); }
function page<T>(item: Check<T>) {
  return obj({ items: arr(item, 100), nextCursor: optStr, total: count });
}

const base = { section: str, generatedAt: date, authorityFingerprint: str, jurisdictionCode: optStr, premisesId: str, timezone: optStr, currencyCode: optStr, operating: obj({ open: bool, reason: optStr }), salesRules: obj({ version: optStr, problem: optStr }) };
const named = obj({ name: optStr });

const hold = obj({ id: str, type: str, reasonCode: str, reason: optStr, status: str, placedAt: date });
const event = obj({ id: str, eventType: str, quantityDeltaMicrounits: int, beforeQuantityMicrounits: int, afterQuantityMicrounits: int, reasonCode: str, occurredAt: date, stateReportStatus: str, manifest: nullable(obj({ manifestNumber: str, status: str })), actor: nullable(named) });
const balance: Check<{ state: 'ok'; availableMicrounits: number; onHandMicrounits: number; reservedMicrounits: number } | { state: 'discrepancy' }> = (v, p) => {
  const value = record(v, p);
  if (value.state === 'discrepancy') return { state: 'discrepancy' };
  if (value.state !== 'ok') return fail(p);
  return { state: 'ok', availableMicrounits: int(value.availableMicrounits, p), onHandMicrounits: int(value.onHandMicrounits, p), reservedMicrounits: int(value.reservedMicrounits, p) };
};
export const custodyPackage = obj({
  id: str, packageUid: str, sourcePackageUid: optStr, productionBatchNumber: str, lotNumber: str, status: str, testStatus: str,
  quantityReceivedMicrounits: int, quantityOnHandMicrounits: int, reservedMicrounits: int, unitOfMeasure: str, expiresAt: date,
  receivedAt: optDate, manufacturedAt: optDate, coaReference: optStr, labName: optStr, labResultReference: optStr, labelVersion: optStr, version: int,
  product: nullable(obj({ id: str, name: str, sku: str })), holds: arr(hold, 10), holdsCount: count, events: arr(event, 12), eventsCount: count,
  readiness: obj({ ready: bool, reasons: arr(str, 10) }), balance,
});
export type CustodyPackage = ReturnType<typeof custodyPackage>;

const product = obj({ id: str, name: str, sku: str, form: str, unitOfMeasure: str, unitQuantityMicrounits: int });
const incident = obj({ id: str, reference: str, type: str, severity: str, status: str, detectedAt: date, notificationDueAt: optDate, notificationState: str });
const interval = { id: str, status: str, effectiveAt: date, expiresAt: date, intervalState: str };

const sections = {
  overview: obj({ ...base,
    inventory: nullable(obj({ ready: arr(obj({ id: str, packageUid: str, expiresAt: date, quantityOnHandMicrounits: int, reservedMicrounits: int, unitOfMeasure: str, product: nullable(named) }), 10), readyTotal: count, heldTotal: count, receivingTotal: count })),
    incidents: nullable(obj({ open: arr(incident, 10), openTotal: count, overdueTotal: count })),
    authorityAccess: (v: unknown) => v === true,
  }),
  authority: obj({ ...base,
    self: obj({ credentialId: optStr, isOwner: bool, approvalLimitCents: int }),
    rules: nullable(obj({ id: str, version: str, effectiveAt: date, expiresAt: date, adultMinimumAge: int, medicalMinimumAge: int, medicalEnabled: bool, operatingStartMinute: int, operatingEndMinute: int,
      purchaseLimits: arr(json, 50), taxRules: arr(json, 50), discountRuleCount: count, allowedTenderTypes: arr(str, 10) })),
    licenses: page(obj({ ...interval, licenseNumber: str, licenseType: str, regulatorName: str })),
    credentials: page(obj({ ...interval, credentialType: str, approvalLimitCents: optInt, user: nullable(obj({ id: str, name: str })) })),
  }),
  compliance: obj({ ...base,
    pendingCustomers: page(obj({ id: str, kind: (v: unknown, p: string) => v === 'customer_eligibility' ? v : fail(p), reference: str, capacity: str, status: str, createdAt: date })),
    holds: page(obj({ id: str, type: str, reasonCode: str, placedAt: date, package: nullable(obj({ id: str, packageUid: str })) })),
    recalls: page(obj({ id: str, kind: (v: unknown, p: string) => v === 'recall_case' ? v : fail(p), reference: str, status: str, reason: str, openedAt: date })),
  }),
  inventory: obj({ ...base, filter: str, search: optStr,
    counts: obj({ all: count, receiving: count, held: count, ready: count, closed: count }),
    packages: page(custodyPackage),
    actions: obj({ release: obj({ available: bool, reason: optStr }) }),
  }),
  receiving: obj({ ...base, search: optStr, productSearch: optStr,
    manifests: page(obj({ id: str, manifestNumber: str, type: str, status: str, sourceLicenseNumber: optStr, destinationLicenseNumber: optStr, transporterReference: optStr, regulatorManifestId: optStr, occurredAt: date, reasonCode: str,
      packageEvents: arr(obj({ id: str, eventType: str, quantityDeltaMicrounits: int, package: nullable(obj({ packageUid: str, unitOfMeasure: str })) }), 20), packageEventsCount: count })),
    products: page(product), receivingHoldTotal: count, discrepancyTotal: count,
  }),
  menu: obj({ ...base, search: optStr, inactiveTotal: count, categories: obj({ limit: arr(str, 50), tax: arr(str, 50) }),
    products: page(obj({ id: str, name: str, sku: str, form: str, categoryCode: str, priceCents: int, status: str, unitOfMeasure: str, adultUseEligible: bool, medicalEligible: bool, updatedAt: date, publicDescription: optStr, readyPackageCount: count, readyCountComplete: bool, availableMicrounits: int })),
  }),
  pos: obj({ ...base, productSearch: optStr,
    carts: page(obj({ id: str, reference: str, source: str, status: str, expiresAt: date, totalCents: int, customer: nullable(obj({ id: str, reference: str, capacity: str })) })),
    products: page(product),
    sales: page(obj({ id: str, receiptNumber: str, status: str, totalCents: int, finalizedAt: date })),
  }),
  cash: obj({ ...base,
    shifts: page(obj({ id: str, status: str, openingFloatCents: int, expectedCashCents: optInt, actualCashCents: optInt, varianceCents: optInt, openedAt: optDate, closedAt: optDate, register: nullable(obj({ id: str, name: str, code: str })), operator: nullable(obj({ id: str, name: str })) })),
    registers: page(obj({ id: str, code: str, name: str, status: str })),
  }),
  reconciliation: obj({ ...base,
    runs: page(obj({ id: str, type: str, status: str, discrepancyCount: count, startedAt: date, completedAt: optDate })),
    pending: page(obj({ id: str, topic: str, status: str, attempts: count, availableAt: date })),
    exceptions: page(obj({ id: str, topic: str, status: str, attempts: count, availableAt: date, lastAttemptAt: optDate, lastErrorCode: optStr })),
    delivery: obj({ workerAvailable: bool, activeInstallations: count }),
  }),
  incidents: obj({ ...base, filter: str, openTotal: count, overdueTotal: count, highTotal: count,
    incidents: page(obj({ id: str, reference: str, type: str, severity: str, status: str, occurredAt: date, detectedAt: date, notificationDueAt: optDate, reportedAt: optDate, description: str, notificationState: str })),
  }),
};

export type WorkspaceSection = keyof typeof sections;
export type WorkspaceData<S extends WorkspaceSection> = ReturnType<(typeof sections)[S]>;

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return Object.hasOwn(sections, value);
}

/** Validate one section; returns null for any malformed or mismatched payload. */
export function parseWorkspace<S extends WorkspaceSection>(section: S, value: unknown): WorkspaceData<S> | null {
  try {
    const data = sections[section](value, section) as WorkspaceData<S>;
    return (data as { section: string }).section === section ? data : null;
  } catch (error) {
    if (error instanceof ContractError) return null;
    throw error;
  }
}
