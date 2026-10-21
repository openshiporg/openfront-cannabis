export type PackageReadinessInput = {
  status: string; testStatus: string; expiresAt: string | Date | null; coaReference?: string | null; labelVersion?: string | null;
  quantityOnHandMicrounits: number; reservedMicrounits: number; activeHoldCount: number;
};

export type PackageBalance =
  | { state: 'ok'; onHandMicrounits: number; reservedMicrounits: number; availableMicrounits: number }
  | { state: 'discrepancy'; onHandMicrounits: unknown; reservedMicrounits: unknown };

export const READINESS_REASON_LABELS: Record<string, string> = {
  status_not_saleable: 'Not released to saleable',
  test_not_passed: 'Lab result not passed',
  active_hold: 'Active hold',
  expired: 'Expired',
  missing_coa_or_label: 'COA reference or label version missing',
  no_free_quantity: 'No unreserved quantity',
  balance_discrepancy: 'Quantity balance discrepancy',
};

/** Validated balance; an inconsistent balance is reported, never clamped. */
export function packageBalance(input: Pick<PackageReadinessInput, 'quantityOnHandMicrounits' | 'reservedMicrounits'>): PackageBalance {
  const { quantityOnHandMicrounits: onHand, reservedMicrounits: reserved } = input;
  if (!Number.isSafeInteger(onHand) || !Number.isSafeInteger(reserved) || onHand < 0 || reserved < 0 || reserved > onHand) {
    return { state: 'discrepancy', onHandMicrounits: onHand, reservedMicrounits: reserved };
  }
  return { state: 'ok', onHandMicrounits: onHand, reservedMicrounits: reserved, availableMicrounits: onHand - reserved };
}

/** The same predicates the sale path enforces (cannabisPolicy.assertPackageSaleable), as data. */
export function packageReadiness(input: PackageReadinessInput, now = new Date()) {
  const reasons: string[] = [];
  const balance = packageBalance(input);
  if (input.status !== 'saleable') reasons.push('status_not_saleable');
  if (input.testStatus !== 'passed') reasons.push('test_not_passed');
  if (input.activeHoldCount > 0) reasons.push('active_hold');
  if (!input.expiresAt || !(new Date(input.expiresAt).getTime() > now.getTime())) reasons.push('expired');
  if (!input.coaReference || !input.labelVersion) reasons.push('missing_coa_or_label');
  if (balance.state === 'discrepancy') reasons.push('balance_discrepancy');
  else if (balance.availableMicrounits <= 0) reasons.push('no_free_quantity');
  return { ready: reasons.length === 0, reasons, balance };
}
