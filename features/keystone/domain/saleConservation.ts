const MAX_DATABASE_INT = 2_147_483_647;

export type SalePackageGroup = {
  packageId: string;
  quantityMicrounits: number;
  lineIndexes: number[];
};

type SaleCartLine = { package: { id: string }; quantityMicrounits: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function groupSaleLinesByPackage(value: unknown): SalePackageGroup[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 250) throw new Error("Sale requires 1-250 exact-package lines");
  const groups = new Map<string, SalePackageGroup>();
  for (const [lineIndex, entry] of value.entries()) {
    if (!isRecord(entry) || !isRecord(entry.package) || typeof entry.package.id !== "string" || !entry.package.id || !Number.isSafeInteger(entry.quantityMicrounits) || (entry.quantityMicrounits as number) < 1 || (entry.quantityMicrounits as number) > MAX_DATABASE_INT) {
      throw new Error(`Sale line ${lineIndex + 1} has an invalid package quantity`);
    }
    const packageId = entry.package.id;
    const quantity = entry.quantityMicrounits as number;
    const group = groups.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIndexes: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT) throw new Error("Grouped package sale exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIndexes.push(lineIndex);
    groups.set(packageId, group);
  }
  return [...groups.values()].sort((left, right) => left.packageId.localeCompare(right.packageId));
}

export function assertReservedPackageForSale(input: {
  status: string;
  testStatus: string;
  expiresAt: string | Date;
  premisesId: string;
  quantityOnHandMicrounits: number;
  reservedMicrounits: number;
  activeHoldCount: number;
  coaReference?: string | null;
  labelVersion?: string | null;
}, premisesId: string, requestedMicrounits: number, now = new Date()) {
  if (input.premisesId !== premisesId) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (!Number.isSafeInteger(input.activeHoldCount) || input.activeHoldCount < 0 || input.activeHoldCount > 0) throw new Error("Package has an active hold");
  const expiresAt = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  for (const [label, quantity] of [["on-hand", input.quantityOnHandMicrounits], ["reserved", input.reservedMicrounits], ["requested", requestedMicrounits]] as const) {
    if (!Number.isSafeInteger(quantity) || quantity < (label === "requested" ? 1 : 0) || quantity > MAX_DATABASE_INT) throw new Error(`Package ${label} quantity is invalid`);
  }
  if (input.reservedMicrounits > input.quantityOnHandMicrounits) throw new Error("Package reservation exceeds physical on-hand quantity");
  if (input.quantityOnHandMicrounits < requestedMicrounits || input.reservedMicrounits < requestedMicrounits) throw new Error("Exact package reservation is insufficient for sale");
}

export function planSaleLineBalances(lines: readonly SaleCartLine[], group: SalePackageGroup, quantityOnHandMicrounits: number) {
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < group.quantityMicrounits) throw new Error("Physical on-hand quantity is insufficient for grouped sale");
  let remaining = quantityOnHandMicrounits;
  return group.lineIndexes.map(lineIndex => {
    const line = lines[lineIndex];
    if (!line || line.package.id !== group.packageId || !Number.isSafeInteger(line.quantityMicrounits) || line.quantityMicrounits < 1) throw new Error("Sale line package grouping is inconsistent");
    const before = remaining;
    remaining -= line.quantityMicrounits;
    if (remaining < 0) throw new Error("Sale line allocation exceeds physical on-hand quantity");
    return { lineIndex, before, after: remaining };
  });
}

export function assertFinalSaleCartFence(expected: { id: string; status: string; version: number }, current: { id: string; status: string; version: number }) {
  if (expected.status !== "reserved" || current.id !== expected.id || current.status !== expected.status || current.version !== expected.version) {
    throw new Error("Reserved cart state changed concurrently");
  }
}
