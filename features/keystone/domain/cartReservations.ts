const MAX_DATABASE_INT = 2_147_483_647;

export const CANCELLABLE_CART_STATUSES = ["preliminarily_eligible", "reserved", "picking", "staged"] as const;

type CancellationCartSnapshot = {
  id: string;
  status: string;
  version: number;
  lines: unknown;
};

export type CartCancellationPlan =
  | { disposition: "replay"; cartId: string }
  | {
      disposition: "cancel";
      cartId: string;
      expectedStatus: string;
      expectedVersion: number;
      releases: Array<{ packageId: string; quantityMicrounits: number; lineIds: string[] }>;
      releasedLines: number;
      totalReleasedMicrounits: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function planCartCancellation(snapshot: CancellationCartSnapshot): CartCancellationPlan {
  if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id) throw new Error("Cart snapshot is invalid");
  if (snapshot.status === "cancelled") return { disposition: "replay", cartId: snapshot.id };
  if (!CANCELLABLE_CART_STATUSES.includes(snapshot.status as typeof CANCELLABLE_CART_STATUSES[number])) throw new Error("Cart is not cancellable");
  if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 1 || snapshot.version > MAX_DATABASE_INT) throw new Error("Cart version is invalid");
  if (!Array.isArray(snapshot.lines) || snapshot.lines.length > 250) throw new Error("Cart reservation lines exceed the bounded cancellation contract");

  const releases = new Map<string, { packageId: string; quantityMicrounits: number; lineIds: string[] }>();
  let totalReleasedMicrounits = 0;
  for (const [index, value] of snapshot.lines.entries()) {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id || !Number.isSafeInteger(value.quantityMicrounits) || (value.quantityMicrounits as number) < 1 || (value.quantityMicrounits as number) > MAX_DATABASE_INT || !isRecord(value.package) || typeof value.package.id !== "string" || !value.package.id) {
      throw new Error(`Cart reservation line ${index + 1} is invalid`);
    }
    const quantity = value.quantityMicrounits as number;
    const packageId = value.package.id;
    const group = releases.get(packageId) ?? { packageId, quantityMicrounits: 0, lineIds: [] };
    const groupedQuantity = group.quantityMicrounits + quantity;
    if (!Number.isSafeInteger(groupedQuantity) || groupedQuantity > MAX_DATABASE_INT) throw new Error("Grouped package release exceeds the database integer range");
    group.quantityMicrounits = groupedQuantity;
    group.lineIds.push(value.id);
    releases.set(packageId, group);
    totalReleasedMicrounits += quantity;
  }

  return {
    disposition: "cancel",
    cartId: snapshot.id,
    expectedStatus: snapshot.status,
    expectedVersion: snapshot.version,
    releases: [...releases.values()].map(group => ({ ...group, lineIds: [...group.lineIds].sort() })).sort((left, right) => left.packageId.localeCompare(right.packageId)),
    releasedLines: snapshot.lines.length,
    totalReleasedMicrounits,
  };
}

export function assertCartCancellationFence(plan: Extract<CartCancellationPlan, { disposition: "cancel" }>, current: { id: string; status: string; version: number }) {
  if (current.id !== plan.cartId || current.version !== plan.expectedVersion || current.status !== plan.expectedStatus || !CANCELLABLE_CART_STATUSES.includes(current.status as typeof CANCELLABLE_CART_STATUSES[number])) {
    throw new Error("Cart state changed concurrently");
  }
}

export function assertReservationCanBeReleased(reservedMicrounits: number, releaseMicrounits: number) {
  if (!Number.isSafeInteger(reservedMicrounits) || reservedMicrounits < 0 || reservedMicrounits > MAX_DATABASE_INT || !Number.isSafeInteger(releaseMicrounits) || releaseMicrounits < 1 || releaseMicrounits > MAX_DATABASE_INT) {
    throw new Error("Package reservation quantities are invalid");
  }
  if (reservedMicrounits < releaseMicrounits) throw new Error("Package reservation ledger is inconsistent");
  return reservedMicrounits - releaseMicrounits;
}
