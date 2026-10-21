export type BuyerCapacity = "adult_use" | "patient" | "caregiver";

export type EffectiveRulePack = {
  id: string;
  version: string;
  status: string;
  jurisdictionCode: string;
  effectiveAt: string | Date;
  expiresAt: string | Date;
  approvedAt?: string | Date | null;
  adultMinimumAge: number;
  medicalMinimumAge: number;
  medicalEnabled: boolean;
  operatingStartMinute: number;
  operatingEndMinute: number;
  purchaseLimits: Array<{ capacity: BuyerCapacity; categoryCode: string; window: "transaction" | "day" | "rolling" | "allotment"; windowDays?: number; maxEquivalencyMicrounits: number }>;
  taxRules: Array<{ categoryCode: string; capacity: BuyerCapacity | "all"; basisPoints: number }>;
  discountRules?: Array<{ code: string; categoryCode: string; capacity: BuyerCapacity | "all"; type: "basis_points" | "fixed_cents"; value: number; startsAt: string; expiresAt: string; minimumLineTotalCents?: number }>;
  allowedTenderTypes: string[];
  offlineSalesAllowed: boolean;
};

export type PackageSaleability = {
  status: string;
  testStatus: string;
  expiresAt: string | Date;
  premisesId: string;
  quantityOnHandMicrounits: number;
  reservedMicrounits: number;
  activeHoldCount: number;
  coaReference?: string | null;
  labelVersion?: string | null;
};

const asTime = (value: string | Date) => new Date(value).getTime();

export function assertEffectiveRulePack(pack: EffectiveRulePack, now = new Date()) {
  if (pack.status !== "effective" || !pack.approvedAt) throw new Error("An approved effective jurisdiction rule pack is required");
  const time = now.getTime();
  if (asTime(pack.effectiveAt) > time || asTime(pack.expiresAt) <= time) throw new Error("Jurisdiction rule pack is outside its effective interval");
  if (!pack.jurisdictionCode.trim() || !pack.version.trim()) throw new Error("Jurisdiction and rule-pack version are required");
  if (!Number.isInteger(pack.adultMinimumAge) || !Number.isInteger(pack.medicalMinimumAge)) throw new Error("Age thresholds must be integer policy data");
  if (!Array.isArray(pack.purchaseLimits) || pack.purchaseLimits.length === 0) throw new Error("At least one configured purchase limit is required");
  const limitKeys = new Set<string>();
  for (const rule of pack.purchaseLimits) {
    if (!rule || !["adult_use", "patient", "caregiver"].includes(rule.capacity) || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim()) throw new Error("Purchase-limit rules require a supported capacity and category");
    if (!["transaction", "day", "rolling", "allotment"].includes(rule.window) || !Number.isSafeInteger(rule.maxEquivalencyMicrounits) || rule.maxEquivalencyMicrounits < 0) throw new Error("Purchase-limit rules contain an unsupported window or maximum");
    if (rule.window === "rolling" && (!Number.isSafeInteger(rule.windowDays) || rule.windowDays! < 1 || rule.windowDays! > 366)) throw new Error("Rolling purchase limits require a supported explicit window in days");
    if (rule.window !== "rolling" && rule.windowDays != null) throw new Error("Only rolling purchase limits may specify windowDays");
    const key = purchaseLimitKey(rule);
    if (limitKeys.has(key)) throw new Error("Duplicate purchase-limit policy for the same capacity, category, and window");
    limitKeys.add(key);
  }
  if (!Array.isArray(pack.taxRules) || pack.taxRules.length === 0) throw new Error("At least one configured tax rule is required");
  const taxKeys = new Set<string>();
  for (const rule of pack.taxRules) {
    if (!rule || typeof rule.categoryCode !== "string" || !rule.categoryCode.trim() || !["adult_use", "patient", "caregiver", "all"].includes(rule.capacity) || !Number.isSafeInteger(rule.basisPoints) || rule.basisPoints < 0) throw new Error("Tax rules require a supported capacity/category and non-negative integer rate");
    const key = `${rule.categoryCode}:${rule.capacity}`;
    if (taxKeys.has(key)) throw new Error("Multiple tax rules match the same category and buyer capacity; supported policy is ambiguous");
    taxKeys.add(key);
  }
  if (!Array.isArray(pack.allowedTenderTypes) || pack.allowedTenderTypes.length === 0 || pack.allowedTenderTypes.some(type => typeof type !== "string" || !type.trim())) throw new Error("At least one supported tender type is required");
  return pack;
}

export function assertOperatingWindow(pack: EffectiveRulePack, localMinute: number) {
  if (!Number.isInteger(localMinute) || localMinute < 0 || localMinute > 1439) throw new Error("Local operating minute is invalid");
  const { operatingStartMinute: start, operatingEndMinute: end } = pack;
  const open = start <= end ? localMinute >= start && localMinute < end : localMinute >= start || localMinute < end;
  if (!open) throw new Error("The premises is outside its configured operating window");
}

export function assertEligibility(input: { capacity: BuyerCapacity; age: number; identityValid: boolean; registryValid?: boolean; representedPatientValid?: boolean }, pack: EffectiveRulePack) {
  if (!input.identityValid) throw new Error("Current identity evidence is required");
  const medical = input.capacity !== "adult_use";
  if (medical && !pack.medicalEnabled) throw new Error("Medical sales are not enabled by the active rule pack");
  const minimumAge = medical ? pack.medicalMinimumAge : pack.adultMinimumAge;
  if (!Number.isInteger(input.age) || input.age < minimumAge) throw new Error("Buyer does not meet the configured age requirement");
  if (medical && !input.registryValid) throw new Error("Current medical registry evidence is required");
  if (input.capacity === "caregiver" && !input.representedPatientValid) throw new Error("Current caregiver-to-patient authority is required");
}

export function assertPackageSaleable(input: PackageSaleability, premisesId: string, requestedMicrounits: number, now = new Date()) {
  if (input.premisesId !== premisesId) throw new Error("Package belongs to a different licensed premises");
  if (input.status !== "saleable" || input.testStatus !== "passed") throw new Error("Package is not released and saleable");
  if (input.activeHoldCount > 0) throw new Error("Package has an active hold");
  if (asTime(input.expiresAt) <= now.getTime()) throw new Error("Package is expired");
  if (!input.coaReference || !input.labelVersion) throw new Error("Authoritative COA and label version are required");
  if (!Number.isSafeInteger(requestedMicrounits) || requestedMicrounits <= 0) throw new Error("Requested package quantity must be a positive integer");
  if (input.quantityOnHandMicrounits - input.reservedMicrounits < requestedMicrounits) throw new Error("Insufficient exact-package available quantity");
}

export function purchaseLimitKey(rule: { capacity?: string; window: string; categoryCode: string; windowDays?: number }) {
  return `${rule.capacity ?? "all"}:${rule.window}:${rule.categoryCode}:${rule.window === "rolling" ? rule.windowDays ?? "missing" : ""}`;
}

export function evaluatePurchaseLimits(input: { capacity: BuyerCapacity; categoryTotals: Record<string, number>; priorWindowTotals: Record<string, number> }, pack: EffectiveRulePack) {
  const applicableRules = pack.purchaseLimits.filter(rule => rule.capacity === input.capacity);
  if (applicableRules.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const unmatchedCategory = Object.entries(input.categoryTotals).find(([category, quantity]) => quantity > 0 && !applicableRules.some(rule => rule.categoryCode === category));
  if (unmatchedCategory) throw new Error(`No purchase-limit policy exists for purchased category ${unmatchedCategory[0]}`);
  const decisions = applicableRules.map(rule => {
    const current = input.categoryTotals[rule.categoryCode] || 0;
    const prior = rule.window === "transaction" ? 0 : input.priorWindowTotals[purchaseLimitKey(rule)] || 0;
    const total = current + prior;
    return { ...rule, current, prior, total, allowed: total <= rule.maxEquivalencyMicrounits };
  });
  if (decisions.length === 0) throw new Error("No purchase-limit policy exists for this buyer capacity");
  const denied = decisions.find(decision => !decision.allowed);
  if (denied) throw new Error(`Configured ${denied.window} purchase limit exceeded for ${denied.categoryCode}`);
  return decisions;
}

export function requireTaxRule(taxRules: EffectiveRulePack["taxRules"], categoryCode: string, capacity: BuyerCapacity) {
  const matches = taxRules.filter(rule => rule.categoryCode === categoryCode && (rule.capacity === capacity || rule.capacity === "all"));
  if (matches.length !== 1) throw new Error("Exactly one supported tax rule must match the product category and buyer capacity");
  return matches[0];
}

export function calculateDiscountCents(subtotalCents: number, rule: NonNullable<EffectiveRulePack["discountRules"]>[number], now = new Date()) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 || !Number.isSafeInteger(rule.value) || rule.value < 0) throw new Error("Discount inputs must be non-negative safe integers");
  if (asTime(rule.startsAt) > now.getTime() || asTime(rule.expiresAt) <= now.getTime()) throw new Error("Discount rule is outside its effective interval");
  const discount = rule.type === "basis_points" ? Math.round((subtotalCents * rule.value) / 10_000) : rule.value;
  if (discount > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  if (rule.minimumLineTotalCents != null && subtotalCents - discount < rule.minimumLineTotalCents) throw new Error("Discount would violate the configured minimum line total");
  return discount;
}

export function calculateTaxCents(subtotalCents: number, discountCents: number, basisPoints: number) {
  for (const [label, value] of Object.entries({ subtotalCents, discountCents, basisPoints })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  }
  if (discountCents > subtotalCents) throw new Error("Discount cannot exceed subtotal");
  return Math.round(((subtotalCents - discountCents) * basisPoints) / 10_000);
}

export function assertTenderAllowed(type: string, amountCents: number, totalCents: number, allowed: string[]) {
  if (!allowed.includes(type)) throw new Error("Tender type is not enabled by the active authority pack");
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(totalCents) || amountCents < 0 || totalCents < 0) throw new Error("Tender amounts must be non-negative integer cents");
}

export function assertTransition(current: string, next: string, transitions: Record<string, string[]>) {
  if (!transitions[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}`);
}

export function assertInventoryEventQuantityDelta(eventType: string, deltaMicrounits: number) {
  if (["release", "reserve", "release_reservation"].includes(eventType) && deltaMicrounits !== 0) {
    throw new Error(`Inventory ${eventType} cannot change physical package quantity`);
  }
}

export function assertInventoryDestructionQuantityDelta(eventType: string, quantityOnHandMicrounits: number, deltaMicrounits: number) {
  if (eventType !== "destruction") return;
  if (!Number.isSafeInteger(quantityOnHandMicrounits) || quantityOnHandMicrounits < 0 || !Number.isSafeInteger(deltaMicrounits) || deltaMicrounits !== -quantityOnHandMicrounits) {
    throw new Error("Destruction must remove all remaining physical package quantity");
  }
}

export const PACKAGE_TRANSITIONS: Record<string, string[]> = {
  expected_inbound: ["receiving_hold"], receiving_hold: ["quarantined", "saleable"], quarantined: ["saleable", "recalled", "waste_pending"],
  saleable: ["reserved", "transfer_allocated", "quarantined", "recalled", "waste_pending", "depleted"], reserved: ["saleable", "staged"], staged: ["saleable", "depleted"],
  transfer_allocated: ["saleable", "in_transit"], in_transit: ["receiving_hold"], waste_pending: ["destroyed"], recalled: ["quarantined", "destroyed"], depleted: [], destroyed: [],
};

export const CART_TRANSITIONS: Record<string, string[]> = {
  draft: ["preliminarily_eligible", "cancelled"], preliminarily_eligible: ["reserved", "rejected"], reserved: ["picking", "expired", "cancelled"],
  picking: ["staged", "cancelled"], staged: ["final_verification", "cancelled"], final_verification: ["completed", "rejected"], completed: [], expired: [], cancelled: [], rejected: [],
};
