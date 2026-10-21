import { READINESS_REASON_LABELS } from '@/features/keystone/domain/packageReadiness';
import type { CustodyPackage } from '@/features/platform/workspaces/lib/contract';

export type { CustodyPackage };
export const readable = (value: string) => value.replaceAll('_', ' ');
export const readinessReasons = (pkg: CustodyPackage) => pkg.readiness.reasons.map(reason => READINESS_REASON_LABELS[reason] || readable(reason));
export const hasDiscrepancy = (pkg: CustodyPackage) => pkg.balance.state === 'discrepancy' || pkg.holds.some(hold => hold.type === 'discrepancy');
