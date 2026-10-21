export type OnboardingState =
  | { status: 'idle'; message?: never }
  | { status: 'invalid' | 'not_completed' | 'unknown' | 'success'; message: string };

export const INITIAL_ONBOARDING_STATE: OnboardingState = { status: 'idle' };
export const MALFORMED_PACK_MESSAGE = 'The setup details are incomplete. Every required field must be present.';
export const NOT_COMPLETED_MESSAGE = 'Setup was not completed. Check the details (dates, activities, currency, time zone) and try again.';
export const UNKNOWN_OUTCOME_MESSAGE = "We couldn't confirm whether setup finished. Check setup status before trying again.";

const REQUIRED_AUTHORITY_FIELDS = [
  'organizationName', 'legalName', 'jurisdictionCode',
  'premisesName', 'premisesCode', 'addressSnapshot', 'timezone', 'currencyCode',
  'licenseNumber', 'licenseType', 'regulatorName', 'authorityReference', 'licenseEffectiveAt', 'licenseExpiresAt', 'authorizedActivities',
  'credentialType', 'credentialReference', 'credentialEffectiveAt', 'credentialExpiresAt', 'staffAllowedActivities', 'staffEvidenceHash',
  'ruleVersion', 'ruleAuthorityCitations', 'ruleEffectiveAt', 'ruleExpiresAt', 'adultMinimumAge', 'medicalMinimumAge', 'medicalEnabled',
  'operatingStartMinute', 'operatingEndMinute', 'purchaseLimits', 'taxRules', 'discountRules', 'allowedTenderTypes', 'labelRequirements',
  'returnRules', 'outagePolicy', 'privacyRules', 'retentionRules', 'pickupEnabled',
  'traceabilityProviderCode', 'traceabilityAuthorityReference', 'tenderConfigurations', 'idempotencyKey',
] as const;

const error = (message: string): OnboardingState => ({ status: 'invalid', message });
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parseAuthorityPack(raw: string): { success: true; input: Record<string, unknown> } | { success: false; state: OnboardingState } {
  if (!raw || raw.length > 256_000) return { success: false, state: error(MALFORMED_PACK_MESSAGE) };
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return { success: false, state: error('Setup details must be valid JSON.') };
  }
  if (!isRecord(input) || REQUIRED_AUTHORITY_FIELDS.some(field => !(field in input))) {
    return { success: false, state: error(MALFORMED_PACK_MESSAGE) };
  }
  return { success: true, input };
}

export const notCompletedState = (): OnboardingState => ({ status: 'not_completed', message: NOT_COMPLETED_MESSAGE });
export const unknownOutcomeState = (): OnboardingState => ({ status: 'unknown', message: UNKNOWN_OUTCOME_MESSAGE });
