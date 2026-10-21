const POLICY_IDENTITY_FIELDS = [
  "jurisdictionCode",
  "ruleVersion",
  "ruleAuthorityCitations",
  "ruleEffectiveAt",
  "ruleExpiresAt",
  "adultMinimumAge",
  "medicalMinimumAge",
  "medicalEnabled",
  "operatingStartMinute",
  "operatingEndMinute",
  "purchaseLimits",
  "taxRules",
  "discountRules",
  "allowedTenderTypes",
  "labelRequirements",
  "returnRules",
  "outagePolicy",
  "privacyRules",
  "retentionRules",
  "pickupEnabled",
  "deliveryEnabled",
  "offlineSalesAllowed",
] as const;

/** Return every owner-supplied field that can change policy enforcement. */
export function policyIdentity<T extends object>(value: T) {
  const input = value as Record<string, unknown>;
  const identity: Record<string, unknown> = {};
  for (const field of POLICY_IDENTITY_FIELDS) {
    if (!(field in input) || input[field] === undefined) throw new Error(`Policy identity is missing ${field}`);
    identity[field] = input[field];
  }
  return identity;
}
